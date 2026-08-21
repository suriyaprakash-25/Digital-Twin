const { getDb } = require('../db');

/**
 * Ensures indexes for payment webhook events tracking
 */
async function ensureWebhookEventIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const webhookEvents = db.collection('payment_webhook_events');

    await webhookEvents.createIndex({ eventId: 1 }, { unique: true });
    await webhookEvents.createIndex({ eventType: 1, receivedAt: -1 });
    await webhookEvents.createIndex({ razorpayPaymentId: 1 }, { sparse: true });
    await webhookEvents.createIndex({ razorpayOrderId: 1 }, { sparse: true });
    await webhookEvents.createIndex({ processingStatus: 1 });

    console.log('✅ Payment Webhook Event tracking indexes verified.');
  } catch (err) {
    console.error('Error ensuring webhook event indexes:', err.message);
  }
}

/**
 * Records a webhook event idempotently
 * @param {Object} params
 * @param {string} params.eventId
 * @param {string} params.eventType
 * @param {string} [params.razorpayPaymentId]
 * @param {string} [params.razorpayOrderId]
 * @param {string} [params.payloadHash]
 * @param {Object} [params.payload]
 * @param {Object} [params.dbInstance]
 * @returns {Promise<{ isDuplicate: boolean, eventDoc: Object }>}
 */
async function recordWebhookEvent({
  eventId,
  eventType,
  razorpayPaymentId = null,
  razorpayOrderId = null,
  payloadHash = null,
  payload = null,
  dbInstance
}) {
  const db = dbInstance || getDb();
  const webhookEvents = db.collection('payment_webhook_events');
  const now = new Date();

  if (!eventId) {
    return { isDuplicate: false, eventDoc: null };
  }

  try {
    const eventDoc = {
      eventId: String(eventId),
      eventType: String(eventType),
      razorpayPaymentId: razorpayPaymentId ? String(razorpayPaymentId) : null,
      razorpayOrderId: razorpayOrderId ? String(razorpayOrderId) : null,
      payloadHash,
      payload,
      receivedAt: now,
      processedAt: null,
      processingStatus: 'RECEIVED',
      failureReason: null,
      retryCount: 0
    };

    await webhookEvents.insertOne(eventDoc);
    return { isDuplicate: false, eventDoc };
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate event detected
      const existing = await webhookEvents.findOne({ eventId: String(eventId) });
      return { isDuplicate: true, eventDoc: existing };
    }
    throw err;
  }
}

/**
 * Marks a recorded webhook event as processed
 */
async function markWebhookEventProcessed(eventId, { status = 'PROCESSED', failureReason = null, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const webhookEvents = db.collection('payment_webhook_events');
  const now = new Date();

  await webhookEvents.updateOne(
    { eventId: String(eventId) },
    {
      $set: {
        processedAt: now,
        processingStatus: status,
        failureReason
      }
    }
  );
}

module.exports = {
  ensureWebhookEventIndexes,
  recordWebhookEvent,
  markWebhookEventProcessed
};
