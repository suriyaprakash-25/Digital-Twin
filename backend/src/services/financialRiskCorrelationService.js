const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { RISK_LEVEL } = require('../models/RiskEvent');
const { generateRiskCaseNumber } = require('../utils/riskCaseNumber');
const { logFinancialAudit } = require('./auditService');

const ADVANCED_RISK_SIGNALS = {
  PAYMENT_VELOCITY: 'PAYMENT_VELOCITY',
  REFUND_VELOCITY: 'REFUND_VELOCITY',
  DISPUTE_VELOCITY: 'DISPUTE_VELOCITY',
  RAPID_PAYMENT_REFUND: 'RAPID_PAYMENT_REFUND',
  HIGH_SETTLEMENT_FREQUENCY: 'HIGH_SETTLEMENT_FREQUENCY',
  UNUSUAL_SETTLEMENT_AMOUNT: 'UNUSUAL_SETTLEMENT_AMOUNT',
  REPEATED_FAILED_PAYMENTS: 'REPEATED_FAILED_PAYMENTS',
  SUSPICIOUS_GARAGE_ACTIVITY: 'SUSPICIOUS_GARAGE_ACTIVITY'
};

const RISK_WEIGHTS = {
  [ADVANCED_RISK_SIGNALS.PAYMENT_VELOCITY]: 25,
  [ADVANCED_RISK_SIGNALS.REFUND_VELOCITY]: 30,
  [ADVANCED_RISK_SIGNALS.DISPUTE_VELOCITY]: 30,
  [ADVANCED_RISK_SIGNALS.RAPID_PAYMENT_REFUND]: 35,
  [ADVANCED_RISK_SIGNALS.HIGH_SETTLEMENT_FREQUENCY]: 25,
  [ADVANCED_RISK_SIGNALS.UNUSUAL_SETTLEMENT_AMOUNT]: 25,
  [ADVANCED_RISK_SIGNALS.REPEATED_FAILED_PAYMENTS]: 25,
  [ADVANCED_RISK_SIGNALS.SUSPICIOUS_GARAGE_ACTIVITY]: 30
};

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * Correlates risk signals across User, Garage, Vehicle, Payment, Dispute & Settlement
 */
async function correlateAndEvaluateFinancialRisk({
  userId = null,
  garageId = null,
  vehicleId = null,
  paymentId = null,
  settlementId = null,
  amount = 0,
  dbInstance
}) {
  const db = dbInstance || getDb();
  const payments = db.collection('payments');
  const disputes = db.collection('payment_disputes');
  const settlements = db.collection('settlements');
  const riskCases = db.collection('risk_cases');
  const now = new Date();

  let riskScore = 0;
  const signals = [];
  const evidence = {};

  // 1. Payment Velocity Check: >= 3 payments in last 10 minutes
  if (userId) {
    const tenMinsAgo = new Date(now.getTime() - (10 * 60 * 1000));
    const recentPaymentsCount = await payments.countDocuments({
      userId: String(userId),
      createdAt: { $gte: tenMinsAgo }
    });

    if (recentPaymentsCount >= 3) {
      signals.push(ADVANCED_RISK_SIGNALS.PAYMENT_VELOCITY);
      riskScore += RISK_WEIGHTS[ADVANCED_RISK_SIGNALS.PAYMENT_VELOCITY];
      evidence.recentPaymentsIn10Min = recentPaymentsCount;
    }
  }

  // 2. Dispute Velocity Check: >= 2 disputes in last 7 days
  if (userId || garageId) {
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const disputeQuery = { createdAt: { $gte: sevenDaysAgo } };
    if (userId) disputeQuery.userId = String(userId);
    if (garageId) disputeQuery.garageId = String(garageId);

    const recentDisputesCount = await disputes.countDocuments(disputeQuery);
    if (recentDisputesCount >= 2) {
      signals.push(ADVANCED_RISK_SIGNALS.DISPUTE_VELOCITY);
      riskScore += RISK_WEIGHTS[ADVANCED_RISK_SIGNALS.DISPUTE_VELOCITY];
      evidence.recentDisputesIn7Days = recentDisputesCount;
    }
  }

  // 3. High Settlement Frequency: >= 3 settlement requests in 24 hours
  if (garageId) {
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const recentSettlementsCount = await settlements.countDocuments({
      garageId: String(garageId),
      createdAt: { $gte: oneDayAgo }
    });

    if (recentSettlementsCount >= 3) {
      signals.push(ADVANCED_RISK_SIGNALS.HIGH_SETTLEMENT_FREQUENCY);
      riskScore += RISK_WEIGHTS[ADVANCED_RISK_SIGNALS.HIGH_SETTLEMENT_FREQUENCY];
      evidence.recentSettlementsIn24h = recentSettlementsCount;
    }
  }

  // 4. Unusual High-Value Settlement: >= ₹150,000
  const amountRupees = parseFloat(amount) || 0;
  if (amountRupees >= 150000) {
    signals.push(ADVANCED_RISK_SIGNALS.UNUSUAL_SETTLEMENT_AMOUNT);
    riskScore += RISK_WEIGHTS[ADVANCED_RISK_SIGNALS.UNUSUAL_SETTLEMENT_AMOUNT];
    evidence.amountRupees = amountRupees;
  }

  // Bound score [0, 100]
  riskScore = Math.min(100, Math.max(0, riskScore));

  // Determine Level
  let riskLevel = RISK_LEVEL.LOW;
  if (riskScore >= 80) riskLevel = RISK_LEVEL.CRITICAL;
  else if (riskScore >= 60) riskLevel = RISK_LEVEL.HIGH;
  else if (riskScore >= 30) riskLevel = RISK_LEVEL.MEDIUM;

  // Determine Recommended Action
  let recommendedAction = 'ALLOW';
  if (riskLevel === RISK_LEVEL.CRITICAL) recommendedAction = 'HOLD_SETTLEMENT';
  else if (riskLevel === RISK_LEVEL.HIGH) recommendedAction = 'REVIEW';
  else if (riskLevel === RISK_LEVEL.MEDIUM) recommendedAction = 'MONITOR';

  let createdCaseNumber = null;

  // If HIGH or CRITICAL: Create or update correlated Risk Case
  if (riskScore >= 60) {
    const entityMatch = {
      status: { $in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] }
    };
    if (userId) entityMatch['entities.userId'] = String(userId);
    if (garageId) entityMatch['entities.garageId'] = String(garageId);

    const existingCase = await riskCases.findOne(entityMatch);

    if (existingCase) {
      // Update existing case
      createdCaseNumber = existingCase.riskCaseNumber;
      await riskCases.updateOne(
        { _id: existingCase._id },
        {
          $set: {
            riskLevel,
            score: Math.max(existingCase.score || 0, riskScore),
            signals: Array.from(new Set([...(existingCase.signals || []), ...signals])),
            evidence: { ...(existingCase.evidence || {}), ...evidence },
            recommendedAction,
            updatedAt: now
          }
        }
      );
    } else {
      // Create new consolidated risk case
      createdCaseNumber = await generateRiskCaseNumber(db);
      const caseDoc = {
        riskCaseNumber: createdCaseNumber,
        riskLevel,
        score: riskScore,
        entities: {
          userId: userId ? String(userId) : null,
          garageId: garageId ? String(garageId) : null,
          vehicleId: vehicleId ? String(vehicleId) : null,
          paymentId: paymentId ? String(paymentId) : null,
          settlementId: settlementId ? String(settlementId) : null
        },
        signals,
        evidence,
        status: 'OPEN',
        assignedAdmin: null,
        recommendedAction,
        actionsTaken: [],
        createdAt: now,
        updatedAt: now,
        resolvedAt: null
      };

      await riskCases.insertOne(caseDoc);

      await logFinancialAudit({
        actorId: 'RISK_CORRELATION_ENGINE',
        actorRole: 'SYSTEM',
        garageId: garageId ? String(garageId) : null,
        action: 'RISK_CASE_CREATED',
        resourceType: 'RISK_CASE',
        resourceId: createdCaseNumber,
        afterState: { riskCaseNumber: createdCaseNumber, riskLevel, riskScore, recommendedAction },
        dbInstance: db
      });
    }
  }

  return {
    riskScore,
    riskLevel,
    signals,
    evidence,
    recommendedAction,
    riskCaseNumber: createdCaseNumber,
    requiresAdminReview: riskScore >= 60
  };
}

module.exports = {
  ADVANCED_RISK_SIGNALS,
  RISK_WEIGHTS,
  correlateAndEvaluateFinancialRisk
};
