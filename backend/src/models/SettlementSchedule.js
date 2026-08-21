const { getDb } = require('../db');

/**
 * Settlement Schedule Frequency Types
 */
const SCHEDULE_TYPE = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MANUAL: 'MANUAL'
};

/**
 * Settlement Hold Reason Codes
 */
const HOLD_REASON = {
  RISK_REVIEW: 'RISK_REVIEW',
  RECONCILIATION_ISSUE: 'RECONCILIATION_ISSUE',
  DISPUTE: 'DISPUTE',
  KYC_REVIEW: 'KYC_REVIEW',
  PAYOUT_PROFILE_ISSUE: 'PAYOUT_PROFILE_ISSUE',
  MANUAL_ADMIN_HOLD: 'MANUAL_ADMIN_HOLD'
};

/**
 * Ensures indexes for settlement operations and governance collections
 */
async function ensureSettlementOperationIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const settlements = db.collection('settlements');
    const schedules = db.collection('settlement_schedules');
    const holds = db.collection('settlement_holds');
    const approvals = db.collection('settlement_approvals');
    const reconciliation = db.collection('settlement_reconciliation');

    await settlements.createIndex({ garageId: 1, status: 1, createdAt: -1 });
    await settlements.createIndex({ status: 1, nextRetryAt: 1 });
    await settlements.createIndex({ settlementId: 1 }, { unique: true, sparse: true });
    await settlements.createIndex({ providerTransactionId: 1 }, { sparse: true });

    await schedules.createIndex({ garageId: 1 }, { unique: true });
    await schedules.createIndex({ enabled: 1, nextRunAt: 1 });

    await holds.createIndex({ settlementId: 1, active: 1 });
    await holds.createIndex({ garageId: 1, active: 1 });

    await approvals.createIndex({ settlementId: 1, adminId: 1 });

    await reconciliation.createIndex({ settlementId: 1 });
    await reconciliation.createIndex({ discrepancyType: 1, status: 1 });

    console.log('✅ Settlement Operations and Governance collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring settlement operation indexes:', err.message);
  }
}

module.exports = {
  SCHEDULE_TYPE,
  HOLD_REASON,
  ensureSettlementOperationIndexes
};
