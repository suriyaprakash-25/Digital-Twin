const fs = require('fs');

const path = 'backend/src/routes/payments.js';
let text = fs.readFileSync(path, 'utf8');

function replaceOnce(oldValue, newValue, label) {
  const first = text.indexOf(oldValue);
  const last = text.lastIndexOf(oldValue);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one match`);
  }
  text = text.replace(oldValue, newValue);
}

replaceOnce(
  "const { logFinancialAudit } = require('../services/auditService');",
  "const { logFinancialAudit } = require('../services/auditService');\nconst { beginWebhookEvent, markWebhookEventProcessed } = require('../models/PaymentWebhookEvent');\nconst { isPaymentOrderAuthorized, isGarageUserAuthorizedForPayment } = require('../security/paymentAuthorization');",
  'payment security imports'
);

replaceOnce(
`    const isOwner = (vehicle && String(vehicle.ownerId) === String(req.user.id)) ||
                    (targetDoc.ownerId && String(targetDoc.ownerId) === String(req.user.id)) ||
                    (targetDoc.userId && String(targetDoc.userId) === String(req.user.id)) ||
                    (targetDoc.customerId && String(targetDoc.customerId) === String(req.user.id)) ||
                    (req.user.role === 'ADMIN') ||
                    (!targetDoc.userId && !targetDoc.ownerId && !targetDoc.customerId);

    if (!isOwner) {`,
`    const isOwner = isPaymentOrderAuthorized({
      user: req.user,
      vehicle,
      targetDoc
    });

    if (!isOwner) {`,
  'create-order ownership fallback'
);

replaceOnce(
`    // Authorization: Garage owner who created the service OR Admin
    const isAuthorized = (payment.garageId && String(payment.garageId) === String(req.user.id)) ||
                         (req.user.role === 'ADMIN') ||
                         (req.user.role === 'GARAGE' && String(payment.garageId) === String(req.user.id));

    if (!isAuthorized) {`,
`    // Authorization: real garage owner or administrator.
    const isAuthorized = await isGarageUserAuthorizedForPayment({
      user: req.user,
      payment,
      db
    });

    if (!isAuthorized) {`,
  'refund garage ownership'
);

replaceOnce(
`  const eventPayload = req.body || {};
  const eventName = eventPayload.event;
  const eventId = eventPayload.event_id || (eventPayload.payload?.payment?.entity?.id ? \`${'${eventPayload.payload.payment.entity.id}_${eventName}'}\` : null);

  const db = getDb();
  const webhookEvents = db.collection('webhookEvents');
  const payments = db.collection('payments');
  const services = db.collection('services');

  // Idempotency: skip already processed webhook events
  if (eventId) {
    const existing = await webhookEvents.findOne({ eventId });
    if (existing) {
      return res.status(200).json({ status: 'ok', message: 'Webhook already processed' });
    }
  }

  try {
    const paymentEntity = eventPayload.payload?.payment?.entity;
    const refundEntity = eventPayload.payload?.refund?.entity;
    const orderId = paymentEntity?.order_id || refundEntity?.order_id;
    const paymentId = paymentEntity?.id || refundEntity?.payment_id;

    if (eventName === 'payment.captured' || eventName === 'order.paid') {`,
`  const eventPayload = req.body || {};
  const eventName = eventPayload.event;
  const paymentEntity = eventPayload.payload?.payment?.entity;
  const refundEntity = eventPayload.payload?.refund?.entity;
  const orderId = paymentEntity?.order_id || refundEntity?.order_id;
  const paymentId = paymentEntity?.id || refundEntity?.payment_id;
  const eventId = eventPayload.event_id ||
    (refundEntity?.id ? \`${'${refundEntity.id}_${eventName}'}\` : null) ||
    (paymentEntity?.id ? \`${'${paymentEntity.id}_${eventName}'}\` : null) ||
    (orderId ? \`${'${orderId}_${eventName}'}\` : null);

  const db = getDb();
  const payments = db.collection('payments');
  const services = db.collection('services');

  try {
    const claim = await beginWebhookEvent({
      eventId,
      eventType: eventName || 'unknown',
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      dbInstance: db
    });

    if (!claim.shouldProcess) {
      return res.status(200).json({ status: 'ok', message: 'Webhook already processed or currently processing' });
    }
  } catch (claimErr) {
    console.error('Webhook idempotency claim failed:', claimErr);
    return res.status(500).json({ error: 'Unable to establish webhook idempotency' });
  }

  try {
    if (eventName === 'payment.captured' || eventName === 'order.paid') {`,
  'webhook idempotency preamble'
);

replaceOnce(
`    // Record webhook event as processed
    if (eventId) {
      await webhookEvents.insertOne({
        eventId,
        event: eventName,
        orderId,
        paymentId,
        createdAt: new Date()
      });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Error handling webhook event:', err);
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }`,
`    await markWebhookEventProcessed(eventId, {
      status: 'PROCESSED',
      dbInstance: db
    });

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    if (eventId) {
      try {
        await markWebhookEventProcessed(eventId, {
          status: 'FAILED',
          failureReason: String(err?.message || err).slice(0, 500),
          dbInstance: db
        });
      } catch (markErr) {
        console.error('Failed to mark webhook event as failed:', markErr.message);
      }
    }
    console.error('Error handling webhook event:', err);
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }`,
  'webhook completion state'
);

fs.writeFileSync(path, text);
console.log('Payment route hardening transformation applied.');
