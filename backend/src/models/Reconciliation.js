const { getDb } = require('../db');

/**
 * Reconciliation Status Constants
 */
const RECONCILIATION_STATUS = {
  MATCHED: 'MATCHED',
  MISMATCH: 'MISMATCH',
  MISSING: 'MISSING',
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED'
};

/**
 * Reconciliation Mismatch Types
 */
const MISMATCH_TYPE = {
  NONE: 'NONE',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  STATUS_MISMATCH: 'STATUS_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  REFUND_MISMATCH: 'REFUND_MISMATCH',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  EARNINGS_MISMATCH: 'EARNINGS_MISMATCH',
  SETTLEMENT_MISMATCH: 'SETTLEMENT_MISMATCH',
  MULTIPLE_MISMATCH: 'MULTIPLE_MISMATCH'
};

/**
 * Ensures indexes for payment_reconciliations and reconciliation_audit_logs
 */
async function ensureReconciliationIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const reconciliations = db.collection('payment_reconciliations');
    const auditLogs = db.collection('reconciliation_audit_logs');

    await reconciliations.createIndex({ paymentId: 1 }, { unique: true, sparse: true });
    await reconciliations.createIndex({ razorpayPaymentId: 1 }, { sparse: true });
    await reconciliations.createIndex({ razorpayOrderId: 1 }, { sparse: true });
    await reconciliations.createIndex({ invoiceId: 1 }, { sparse: true });
    await reconciliations.createIndex({ invoiceNumber: 1 }, { sparse: true });
    await reconciliations.createIndex({ garageId: 1, createdAt: -1 });
    await reconciliations.createIndex({ reconciliationStatus: 1, createdAt: -1 });
    await reconciliations.createIndex({ mismatchType: 1 });

    await auditLogs.createIndex({ reconciliationId: 1, createdAt: -1 });
    await auditLogs.createIndex({ adminId: 1, createdAt: -1 });

    console.log('✅ Payment Reconciliation collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring reconciliation indexes:', err.message);
  }
}

module.exports = {
  RECONCILIATION_STATUS,
  MISMATCH_TYPE,
  ensureReconciliationIndexes
};
