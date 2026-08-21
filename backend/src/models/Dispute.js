const { getDb } = require('../db');

/**
 * Dispute Categories
 */
const DISPUTE_CATEGORY = {
  INCORRECT_AMOUNT: 'INCORRECT_AMOUNT',
  DUPLICATE_PAYMENT: 'DUPLICATE_PAYMENT',
  SERVICE_NOT_PROVIDED: 'SERVICE_NOT_PROVIDED',
  POOR_SERVICE: 'POOR_SERVICE',
  REFUND_NOT_RECEIVED: 'REFUND_NOT_RECEIVED',
  WRONG_REFUND_AMOUNT: 'WRONG_REFUND_AMOUNT',
  PAYMENT_FAILED_BUT_CHARGED: 'PAYMENT_FAILED_BUT_CHARGED',
  INVOICE_ISSUE: 'INVOICE_ISSUE',
  OTHER: 'OTHER'
};

/**
 * Dispute Statuses
 */
const DISPUTE_STATUS = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  WAITING_FOR_GARAGE: 'WAITING_FOR_GARAGE',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

/**
 * Dispute Resolution Actions
 */
const DISPUTE_RESOLUTION = {
  NO_ACTION: 'NO_ACTION',
  REFUND_FULL: 'REFUND_FULL',
  REFUND_PARTIAL: 'REFUND_PARTIAL',
  INVOICE_CORRECTION: 'INVOICE_CORRECTION',
  REJECT_DISPUTE: 'REJECT_DISPUTE'
};

/**
 * Ensures indexes for payment_disputes and dispute_events
 */
async function ensureDisputeIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const disputes = db.collection('payment_disputes');
    const events = db.collection('dispute_events');

    await disputes.createIndex({ disputeNumber: 1 }, { unique: true });
    await disputes.createIndex({ paymentId: 1 });
    await disputes.createIndex({ invoiceId: 1 }, { sparse: true });
    await disputes.createIndex({ userId: 1, createdAt: -1 });
    await disputes.createIndex({ garageId: 1, createdAt: -1 });
    await disputes.createIndex({ status: 1, createdAt: -1 });
    await disputes.createIndex({ category: 1 });

    await events.createIndex({ disputeId: 1, createdAt: 1 });
    await events.createIndex({ actorId: 1 });

    console.log('✅ Payment Dispute collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring dispute indexes:', err.message);
  }
}

module.exports = {
  DISPUTE_CATEGORY,
  DISPUTE_STATUS,
  DISPUTE_RESOLUTION,
  ensureDisputeIndexes
};
