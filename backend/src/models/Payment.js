const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

/**
 * Payment Statuses
 */
const PAYMENT_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

/**
 * Ensures unique and search indexes on the 'payments' collection
 */
async function ensurePaymentIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const payments = db.collection('payments');

    // Unique index on razorpayOrderId
    await payments.createIndex({ razorpayOrderId: 1 }, { unique: true, sparse: true });

    // Sparse unique index on razorpayPaymentId
    await payments.createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

    // Lookup indexes
    await payments.createIndex({ userId: 1, createdAt: -1 });
    await payments.createIndex({ serviceId: 1 });
    await payments.createIndex({ invoiceId: 1 });
    await payments.createIndex({ vehicleId: 1 });
    await payments.createIndex({ status: 1 });

    // Processed webhook events idempotency collection
    const webhookEvents = db.collection('webhookEvents');
    await webhookEvents.createIndex({ eventId: 1 }, { unique: true });
    await webhookEvents.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30 days TTL

    console.log('✅ Payment collection indexes verified.');
  } catch (err) {
    console.error('Error creating payment indexes:', err.message);
  }
}

module.exports = {
  PAYMENT_STATUS,
  ensurePaymentIndexes
};
