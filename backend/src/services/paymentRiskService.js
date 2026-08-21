const { getDb } = require('../db');
const { RISK_LEVEL, RISK_FLAGS } = require('../models/RiskEvent');
const { loadConfig } = require('../config');

const config = loadConfig();

const RISK_CONFIG = {
  enabled: process.env.PAYMENT_RISK_ENABLED !== 'false',
  maxAttemptsPerInvoice: parseInt(process.env.PAYMENT_MAX_ATTEMPTS_PER_INVOICE, 10) || 5,
  attemptWindowMinutes: parseInt(process.env.PAYMENT_ATTEMPT_WINDOW_MINUTES, 10) || 15,
  maxRefundsPerPayment: parseInt(process.env.PAYMENT_MAX_REFUNDS_PER_PAYMENT, 10) || 5,
  disputeRiskThreshold: parseInt(process.env.DISPUTE_RISK_THRESHOLD, 10) || 3,
  highValueThreshold: parseFloat(process.env.HIGH_VALUE_PAYMENT_THRESHOLD) || 100000,
  refundRiskThresholdPercent: parseFloat(process.env.REFUND_RISK_THRESHOLD_PERCENT) || 80
};

/**
 * Evaluates the fraud & financial risk for a payment, refund, or settlement transaction
 * @param {Object} params
 * @param {string} [params.userId]
 * @param {string} [params.garageId]
 * @param {string} [params.invoiceId]
 * @param {number} [params.amount] - Amount in Rupees
 * @param {string} [params.paymentId]
 * @param {string} [params.operation] - 'PAYMENT' | 'REFUND' | 'SETTLEMENT' | 'DISPUTE'
 * @param {Object} [params.dbInstance]
 * @returns {Promise<Object>} Risk evaluation result
 */
async function evaluateTransactionRisk({
  userId,
  garageId,
  invoiceId,
  amount = 0,
  paymentId,
  operation = 'PAYMENT',
  dbInstance
}) {
  if (!RISK_CONFIG.enabled) {
    return {
      riskScore: 0,
      riskLevel: RISK_LEVEL.LOW,
      riskFlags: [],
      requiresReview: false,
      riskEvaluatedAt: new Date()
    };
  }

  const db = dbInstance || getDb();
  const payments = db.collection('payments');
  const disputes = db.collection('payment_disputes');
  const riskEvents = db.collection('payment_risk_events');

  let score = 0;
  const flags = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - (RISK_CONFIG.attemptWindowMinutes * 60 * 1000));

  // 1. Check Multiple Attempts for Same Invoice
  if (invoiceId) {
    const recentAttempts = await payments.countDocuments({
      $or: [{ invoiceId: String(invoiceId) }, { serviceId: String(invoiceId) }],
      createdAt: { $gte: windowStart }
    });

    if (recentAttempts >= RISK_CONFIG.maxAttemptsPerInvoice) {
      score += 35;
      flags.push(RISK_FLAGS.MULTIPLE_PAYMENT_ATTEMPTS);
    }

    const successfulPayments = await payments.countDocuments({
      $or: [{ invoiceId: String(invoiceId) }, { serviceId: String(invoiceId) }],
      status: { $in: ['CAPTURED', 'PAID'] }
    });

    if (successfulPayments > 1) {
      score += 50;
      flags.push(RISK_FLAGS.MULTIPLE_SUCCESSFUL_PAYMENTS);
    }
  }

  // 2. High Value Transaction Check
  if (amount >= RISK_CONFIG.highValueThreshold) {
    score += 25;
    flags.push(RISK_FLAGS.HIGH_VALUE_TRANSACTION);
  }

  // 3. User Repeated Disputes Check
  if (userId) {
    const userDisputeCount = await disputes.countDocuments({
      userId: String(userId),
      createdAt: { $gte: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) } // 30 days
    });

    if (userDisputeCount >= RISK_CONFIG.disputeRiskThreshold) {
      score += 30;
      flags.push(RISK_FLAGS.REPEATED_DISPUTES);
    }
  }

  // 4. Refund Checks
  if (operation === 'REFUND' && paymentId) {
    const targetPayment = await payments.findOne({
      $or: [{ _id: String(paymentId) }, { paymentId: String(paymentId) }, { razorpayPaymentId: String(paymentId) }]
    });

    if (targetPayment) {
      const origAmt = parseFloat(targetPayment.amount) || 1;
      const currentRefunded = parseFloat(targetPayment.totalRefundedAmount) || 0;
      const proposedTotal = currentRefunded + (parseFloat(amount) || 0);
      const ratioPercent = (proposedTotal / origAmt) * 100;

      if (ratioPercent >= RISK_CONFIG.refundRiskThresholdPercent) {
        score += 35;
        flags.push(RISK_FLAGS.HIGH_REFUND_RATIO);
      }

      if (Array.isArray(targetPayment.refunds) && targetPayment.refunds.length >= RISK_CONFIG.maxRefundsPerPayment) {
        score += 40;
        flags.push(RISK_FLAGS.EXCESSIVE_REFUNDS);
      }
    }
  }

  // Normalize final score between 0 and 100
  const finalScore = Math.min(Math.max(score, 0), 100);

  let riskLevel = RISK_LEVEL.LOW;
  if (finalScore >= 80) riskLevel = RISK_LEVEL.CRITICAL;
  else if (finalScore >= 60) riskLevel = RISK_LEVEL.HIGH;
  else if (finalScore >= 30) riskLevel = RISK_LEVEL.MEDIUM;

  const requiresReview = riskLevel === RISK_LEVEL.HIGH || riskLevel === RISK_LEVEL.CRITICAL;

  const riskResult = {
    riskScore: finalScore,
    riskLevel,
    riskFlags: flags,
    requiresReview,
    riskEvaluatedAt: now
  };

  // Record in payment_risk_events if MEDIUM or above
  if (finalScore >= 30) {
    try {
      await riskEvents.insertOne({
        paymentId: paymentId ? String(paymentId) : null,
        userId: userId ? String(userId) : null,
        garageId: garageId ? String(garageId) : null,
        invoiceId: invoiceId ? String(invoiceId) : null,
        operation,
        amount,
        riskScore: finalScore,
        riskLevel,
        riskFlags: flags,
        status: 'OPEN', // OPEN | REVIEWED | CLEARED | ESCALATED
        createdAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null
      });
    } catch (err) {
      console.warn('Error saving risk event log:', err.message);
    }
  }

  return riskResult;
}

module.exports = {
  RISK_CONFIG,
  evaluateTransactionRisk
};
