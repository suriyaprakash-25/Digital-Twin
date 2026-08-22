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
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED'
};

/**
 * Ensures unique and search indexes on the 'payments' collection
 */
async function ensurePaymentIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const payments = db.collection('payments');

    // Safely migrate legacy unique indexes to partialFilterExpression
    try {
      const existingIndexes = await payments.indexes();
      for (const idx of existingIndexes) {
        if ((idx.name === 'razorpayPaymentId_1' || idx.name === 'razorpayOrderId_1') && !idx.partialFilterExpression) {
          console.log(`Migrating legacy index: ${idx.name}`);
          await payments.dropIndex(idx.name).catch(() => {});
        }
      }
    } catch (dropErr) {
      console.warn('Index migration check notice:', dropErr.message);
    }

    // Unique index on razorpayOrderId (ignores null/undefined/missing)
    await payments.createIndex(
      { razorpayOrderId: 1 },
      { unique: true, partialFilterExpression: { razorpayOrderId: { $type: 'string' } } }
    );

    // Unique index on razorpayPaymentId (ignores null/undefined/missing)
    await payments.createIndex(
      { razorpayPaymentId: 1 },
      { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
    );

    // Lookup indexes
    await payments.createIndex({ userId: 1, createdAt: -1 });
    await payments.createIndex({ garageId: 1, createdAt: -1 });
    await payments.createIndex({ vehicleId: 1, createdAt: -1 });
    await payments.createIndex({ serviceId: 1 });
    await payments.createIndex({ invoiceId: 1 });
    await payments.createIndex({ invoiceNumber: 1 });
    await payments.createIndex({ status: 1 });
    await payments.createIndex({ 'refunds.refundId': 1 }, { sparse: true });

    // Ensure service indexes for invoicing
    const services = db.collection('services');
    await services.createIndex({ invoiceNumber: 1 }, { sparse: true });
    await services.createIndex({ createdBy: 1, invoiceStatus: 1 });
    await services.createIndex({ vehicleId: 1, paymentStatus: 1 });

    // Processed webhook events idempotency collection
    const webhookEvents = db.collection('webhookEvents');
    await webhookEvents.createIndex({ eventId: 1 }, { unique: true });
    await webhookEvents.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30 days TTL

    console.log('✅ Payment & Invoice collection indexes verified.');
  } catch (err) {
    console.error('Error creating payment indexes:', err.message);
  }
}

module.exports = {
  PAYMENT_STATUS,
  ensurePaymentIndexes
};
