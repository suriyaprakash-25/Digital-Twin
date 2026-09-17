const { getDb } = require('../db');

/**
 * Ensures indexes for payment webhook events tracking.
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
 * Records a webhook event idempotently.
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
      const existing = await webhookEvents.findOne({ eventId: String(eventId) });
      return { isDuplicate: true, eventDoc: existing };
    }
    throw err;
  }
}

/**
 * Claims an event for processing. A new event is processed once. A duplicate
 * event that is already RECEIVED/PROCESSED is skipped. A previously FAILED
 * event can be atomically reclaimed for a retry by exactly one worker.
 */
async function beginWebhookEvent(params) {
  const db = params.dbInstance || getDb();
  const webhookEvents = db.collection('payment_webhook_events');
  const recorded = await recordWebhookEvent(params);

  if (!params.eventId) {
    return { shouldProcess: true, isDuplicate: false, eventDoc: null };
  }

  if (!recorded.isDuplicate) {
    return { shouldProcess: true, isDuplicate: false, eventDoc: recorded.eventDoc };
  }

  const existing = recorded.eventDoc;
  if (!existing || existing.processingStatus !== 'FAILED') {
    return { shouldProcess: false, isDuplicate: true, eventDoc: existing };
  }

  const retryResult = await webhookEvents.updateOne(
    { eventId: String(params.eventId), processingStatus: 'FAILED' },
    {
      $set: {
        processingStatus: 'RECEIVED',
        failureReason: null,
        receivedAt: new Date(),
        processedAt: null
      },
      $inc: { retryCount: 1 }
    }
  );

  const eventDoc = await webhookEvents.findOne({ eventId: String(params.eventId) });
  return {
    shouldProcess: retryResult.modifiedCount === 1,
    isDuplicate: true,
    eventDoc
  };
}

/**
 * Marks a recorded webhook event as processed or failed.
 */
async function markWebhookEventProcessed(eventId, { status = 'PROCESSED', failureReason = null, dbInstance } = {}) {
  if (!eventId) return;

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
  beginWebhookEvent,
  markWebhookEventProcessed
};
