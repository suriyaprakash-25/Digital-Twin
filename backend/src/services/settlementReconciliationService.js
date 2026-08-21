const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { logFinancialAudit } = require('./auditService');

const DISCREPANCY_TYPES = {
  SETTLEMENT_AMOUNT_MISMATCH: 'SETTLEMENT_AMOUNT_MISMATCH',
  SETTLEMENT_STATUS_MISMATCH: 'SETTLEMENT_STATUS_MISMATCH',
  PROVIDER_REFERENCE_MISSING: 'PROVIDER_REFERENCE_MISSING',
  SETTLEMENT_NOT_FOUND: 'SETTLEMENT_NOT_FOUND',
  EARNINGS_LOCK_MISMATCH: 'EARNINGS_LOCK_MISMATCH'
};

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * Reconciles a settlement against linked earnings and provider metadata
 */
async function reconcileSettlement(settlementId, dbInstance) {
  const db = dbInstance || getDb();
  const settlements = db.collection('settlements');
  const earnings = db.collection('garage_earnings');
  const reconciliations = db.collection('settlement_reconciliation');
  const now = new Date();

  const sId = safeObjectId(settlementId);
  const settlement = sId
    ? await settlements.findOne({ _id: sId })
    : await settlements.findOne({ settlementId });

  if (!settlement) {
    const disc = {
      settlementId,
      discrepancyType: DISCREPANCY_TYPES.SETTLEMENT_NOT_FOUND,
      status: 'OPEN',
      notes: 'Settlement document missing during reconciliation audit',
      createdAt: now
    };
    await reconciliations.insertOne(disc);
    return { reconciled: false, discrepancies: [disc] };
  }

  const discrepancies = [];

  // 1. Check earnings lock consistency
  if (settlement.earningsIds && settlement.earningsIds.length > 0) {
    const eObjectIds = settlement.earningsIds.map(eid => safeObjectId(eid)).filter(Boolean);
    const linkedEarnings = await earnings.find({ _id: { $in: eObjectIds } }).toArray();

    let earningsTotalPaise = 0;
    linkedEarnings.forEach(e => {
      const net = e.netAfterRefundPaise !== undefined ? e.netAfterRefundPaise : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
      earningsTotalPaise += net;
    });

    const expectedPaise = settlement.requestedPaise || Math.round((parseFloat(settlement.requestedAmount) || 0) * 100);

    // Amount check
    if (earningsTotalPaise !== expectedPaise) {
      discrepancies.push({
        settlementId: settlement.settlementId,
        garageId: settlement.garageId,
        discrepancyType: DISCREPANCY_TYPES.SETTLEMENT_AMOUNT_MISMATCH,
        expectedAmountPaise: expectedPaise,
        actualAmountPaise: earningsTotalPaise,
        status: 'OPEN',
        notes: `Earnings sum (₹${(earningsTotalPaise / 100).toFixed(2)}) does not match settlement amount (₹${(expectedPaise / 100).toFixed(2)})`,
        createdAt: now
      });
    }

    // Status lock check
    const invalidStatusEarnings = linkedEarnings.filter(e => {
      if (settlement.status === 'SETTLED') return e.status !== 'SETTLED';
      if (['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'RETRY_PENDING'].includes(settlement.status)) {
        return e.status !== 'SETTLEMENT_PENDING';
      }
      return false;
    });

    if (invalidStatusEarnings.length > 0) {
      discrepancies.push({
        settlementId: settlement.settlementId,
        garageId: settlement.garageId,
        discrepancyType: DISCREPANCY_TYPES.EARNINGS_LOCK_MISMATCH,
        expectedStatus: settlement.status === 'SETTLED' ? 'SETTLED' : 'SETTLEMENT_PENDING',
        actualStatus: invalidStatusEarnings[0].status,
        status: 'OPEN',
        notes: `${invalidStatusEarnings.length} linked earnings rows have inconsistent lock status`,
        createdAt: now
      });
    }
  }

  // 2. Check Provider Reference if SETTLED or COMPLETED
  if (['SETTLED', 'COMPLETED'].includes(settlement.status)) {
    const hasTransferRef = Boolean(settlement.transferId || settlement.providerTransactionId);
    if (!hasTransferRef) {
      discrepancies.push({
        settlementId: settlement.settlementId,
        garageId: settlement.garageId,
        discrepancyType: DISCREPANCY_TYPES.PROVIDER_REFERENCE_MISSING,
        status: 'OPEN',
        notes: 'Settled settlement is missing provider transfer ID / reference',
        createdAt: now
      });
    }
  }

  // Store discrepancies
  if (discrepancies.length > 0) {
    await reconciliations.insertMany(discrepancies);
    await logFinancialAudit({
      actorId: 'SETTLEMENT_RECONCILIATION_ENGINE',
      actorRole: 'SYSTEM',
      garageId: settlement.garageId,
      settlementId: settlement.settlementId,
      action: 'SETTLEMENT_RECONCILIATION_MISMATCH',
      resourceType: 'SETTLEMENT',
      resourceId: String(settlement._id),
      afterState: { discrepanciesCount: discrepancies.length },
      dbInstance: db
    });
    return { reconciled: false, discrepancies };
  }

  return { reconciled: true, discrepancies: [] };
}

module.exports = {
  DISCREPANCY_TYPES,
  reconcileSettlement
};
