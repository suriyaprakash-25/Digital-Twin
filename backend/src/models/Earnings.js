const { getDb } = require('../db');

/**
 * Status constants for Garage Earnings records
 */
const EARNINGS_STATUS = {
  PENDING_SETTLEMENT: 'PENDING_SETTLEMENT',
  AVAILABLE: 'AVAILABLE',
  SETTLEMENT_PENDING: 'SETTLEMENT_PENDING',
  SETTLED: 'SETTLED',
  REFUND_ADJUSTMENT: 'REFUND_ADJUSTMENT',
  CANCELLED: 'CANCELLED'
};

/**
 * Status constants for Settlement payouts
 */
const SETTLEMENT_STATUS = {
  REQUESTED: 'REQUESTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

/**
 * Ensures indexes for earnings, settlements, and payout profiles
 */
async function ensureEarningsIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const earnings = db.collection('garage_earnings');
    const settlements = db.collection('settlements');
    const payoutProfiles = db.collection('garage_payout_profiles');

    // Earnings collection indexes
    await earnings.createIndex({ paymentId: 1 }, { unique: true, sparse: true });
    await earnings.createIndex({ invoiceId: 1 });
    await earnings.createIndex({ garageId: 1, status: 1 });
    await earnings.createIndex({ garageId: 1, createdAt: -1 });
    await earnings.createIndex({ settlementId: 1 }, { sparse: true });
    await earnings.createIndex({ status: 1 });

    // Settlements collection indexes
    await settlements.createIndex({ settlementId: 1 }, { unique: true, sparse: true });
    await settlements.createIndex({ garageId: 1, status: 1 });
    await settlements.createIndex({ garageId: 1, createdAt: -1 });
    await settlements.createIndex({ status: 1, requestedAt: -1 });

    // Payout profiles
    await payoutProfiles.createIndex({ garageId: 1 }, { unique: true });

    console.log('✅ Earnings & Settlement collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring earnings indexes:', err.message);
  }
}

module.exports = {
  EARNINGS_STATUS,
  SETTLEMENT_STATUS,
  ensureEarningsIndexes
};
