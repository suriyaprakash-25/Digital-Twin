const { getDb } = require('../db');

/**
 * Risk Level Classifications
 */
const RISK_LEVEL = {
  LOW: 'LOW',         // 0–29
  MEDIUM: 'MEDIUM',   // 30–59
  HIGH: 'HIGH',       // 60–79
  CRITICAL: 'CRITICAL' // 80–100
};

/**
 * Risk Signal Flags
 */
const RISK_FLAGS = {
  MULTIPLE_PAYMENT_ATTEMPTS: 'MULTIPLE_PAYMENT_ATTEMPTS',
  MULTIPLE_SUCCESSFUL_PAYMENTS: 'MULTIPLE_SUCCESSFUL_PAYMENTS',
  EXCESSIVE_REFUNDS: 'EXCESSIVE_REFUNDS',
  HIGH_REFUND_RATIO: 'HIGH_REFUND_RATIO',
  REPEATED_DISPUTES: 'REPEATED_DISPUTES',
  HIGH_VALUE_TRANSACTION: 'HIGH_VALUE_TRANSACTION',
  MULTIPLE_FAILED_ATTEMPTS: 'MULTIPLE_FAILED_ATTEMPTS',
  RAPID_ORDER_CREATION: 'RAPID_ORDER_CREATION',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  SETTLEMENT_OVER_BALANCE: 'SETTLEMENT_OVER_BALANCE'
};

/**
 * Ensures indexes for payment_risk_events and idempotency_keys
 */
async function ensureRiskIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const riskEvents = db.collection('payment_risk_events');
    const idempotency = db.collection('idempotency_keys');

    await riskEvents.createIndex({ paymentId: 1 }, { sparse: true });
    await riskEvents.createIndex({ orderId: 1 }, { sparse: true });
    await riskEvents.createIndex({ userId: 1, createdAt: -1 });
    await riskEvents.createIndex({ garageId: 1, createdAt: -1 });
    await riskEvents.createIndex({ riskLevel: 1, createdAt: -1 });
    await riskEvents.createIndex({ status: 1, createdAt: -1 });

    await idempotency.createIndex({ key: 1, userId: 1 }, { unique: true });
    await idempotency.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

    console.log('✅ Payment Risk and Idempotency collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring risk indexes:', err.message);
  }
}

module.exports = {
  RISK_LEVEL,
  RISK_FLAGS,
  ensureRiskIndexes
};
