/**
 * Payment HTTP routes — thin adapters (parse, authorise, delegate, format).
 * Business logic lives in services/payments/* (order creation, capture, refunds, gateways).
 */
const crypto = require('crypto');
const express = require('express');
const { getDb } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { verifyCashfreeWebhook } = require('../services/cashfreeService');
const { PAYMENT_STATUS } = require('../models/Payment');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { paymentCreationLimiter, refundLimiter } = require('../middleware/financialRateLimit');
const { limiters } = require('../infrastructure/rateLimit/rateLimiters');
const { logFinancialAudit } = require('../services/auditService');
const { beginWebhookEvent, markWebhookEventProcessed } = require('../models/PaymentWebhookEvent');
const { isGarageUserAuthorizedForPayment } = require('../security/paymentAuthorization');
const { asyncHandler, ForbiddenError, NotFoundError, ValidationError } = require('../core/errors');
const { parsePagination, setPaginationHeaders } = require('../core/pagination');
const { safeSearchRegex } = require('../core/text');
const { logger } = require('../services/logger');
const { createCheckoutOrder } = require('../services/payments/paymentOrderService');
const { capturePayment, markPaymentFailed } = require('../services/payments/paymentCaptureService');
const { initiateRefund, applyRefundStatusEvent } = require('../services/payments/refundService');
const { getGateway } = require('../services/payments/gateways');
const {
  PAID_STATUSES,
  OPEN_PAYMENT_STATUSES,
  findPaymentByOrderId,
  findPaymentByAnyId,
  canViewPayment,
  toObjectId,
} = require('../services/payments/paymentRecords');

const router = express.Router();

const HISTORY_DEFAULT_LIMIT = 100;
const RECENT_ACTIVITY_COUNT = 10;
const DEFAULT_GARAGE_NAME = 'Authorized Service Center';
const DEFAULT_SERVICE_TYPE = 'Automotive Service';
const HISTORY_STATUS_FILTERS = Object.freeze({
  PAID: PAYMENT_STATUS.CAPTURED,
  FAILED: PAYMENT_STATUS.FAILED,
  REFUNDED: { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED] },
  PENDING: { $in: OPEN_PAYMENT_STATUSES },
});

// ---------------------------------------------------------------------------
// View formatting (Extract Method: was duplicated in 5 handlers)
// ---------------------------------------------------------------------------
function toPaymentListItem(p) {
  return {
    id: String(p._id),
    invoiceNumber: p.invoiceNumber || '—',
    cfOrderId: p.cfOrderId,
    cashfreePaymentId: p.cashfreePaymentId || '—',
    orderId: p.cfOrderId,
    paymentId: p.cashfreePaymentId || '—',
    amount: p.amount,
    currency: p.currency || 'INR',
    serviceType: p.serviceType || DEFAULT_SERVICE_TYPE,
    garageName: p.garageName || DEFAULT_GARAGE_NAME,
    vehicleNumber: p.vehicleNumber || 'N/A',
    vehicleId: p.vehicleId,
    serviceId: p.serviceId,
    status: p.status,
    paymentMethod: p.paymentMethod || 'Online / Cashfree',
    totalRefundedAmount: p.totalRefundedAmount || 0,
    refunds: p.refunds || [],
    date: p.paidAt || p.createdAt,
  };
}

function toCaptureView(payment, orderId) {
  return {
    id: String(payment._id),
    invoiceNumber: payment.invoiceNumber,
    cfOrderId: orderId || payment.cfOrderId,
    paymentId: payment.cashfreePaymentId || null,
    amount: payment.amount,
    currency: payment.currency || 'INR',
    serviceType: payment.serviceType,
    garageName: payment.garageName,
    vehicleNumber: payment.vehicleNumber,
    status: payment.status,
    paidAt: payment.paidAt,
  };
}

/** Hides abandoned checkout attempts for invoices that were eventually paid. */
function withoutSupersededAttempts(payments) {
  const paidKeys = new Set();
  payments.forEach((p) => {
    if (PAID_STATUSES.includes(p.status)) {
      if (p.invoiceNumber && p.invoiceNumber !== '—') paidKeys.add(p.invoiceNumber);
      if (p.serviceId) paidKeys.add(String(p.serviceId));
      if (p.invoiceId) paidKeys.add(String(p.invoiceId));
    }
  });
  return payments.filter((p) => {
    if (!OPEN_PAYMENT_STATUSES.includes(p.status)) return true;
    return !(paidKeys.has(p.invoiceNumber) || paidKeys.has(String(p.serviceId)) || paidKeys.has(String(p.invoiceId)));
  });
}

// ---------------------------------------------------------------------------
// POST /api/payments/create-order
// ---------------------------------------------------------------------------
router.post('/create-order', requireAuth, paymentCreationLimiter, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { invoiceId, serviceId } = req.body || {};
  const body = await createCheckoutOrder({ db: getDb(), user: req.user, targetId: serviceId || invoiceId, invoiceId, req });
  res.status(200).json(body);
}));

// ---------------------------------------------------------------------------
// POST /api/payments/verify — re-verifies with the gateway server-side, then captures.
// ---------------------------------------------------------------------------
router.post('/verify', limiters.paymentVerify, optionalAuth, asyncHandler(async (req, res) => {
  const { cfOrderId, orderId } = req.body || {};
  const resolvedOrderId = typeof (cfOrderId || orderId) === 'string' ? (cfOrderId || orderId) : null;
  if (!resolvedOrderId) throw new ValidationError('Payment verification failed: cfOrderId is required');

  const db = getDb();
  const payment = await findPaymentByOrderId(db.collection('payments'), resolvedOrderId);
  if (!payment) throw new NotFoundError('Payment record not found for this order ID');
  if (req.user && String(payment.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
    throw new ForbiddenError('Forbidden: Unauthorized payment verification attempt');
  }

  if (payment.status === PAYMENT_STATUS.CAPTURED) {
    return res.status(200).json({ success: true, message: 'Payment is already verified and confirmed', payment: toCaptureView(payment, resolvedOrderId) });
  }

  const gateway = getGateway(payment.gateway || 'cashfree');
  const verification = await gateway.verifyOrderPayment(resolvedOrderId);
  if (!verification.verified) {
    if (!['ACTIVE', 'PENDING'].includes(verification.status)) {
      await markPaymentFailed({ db, payment, reason: `Gateway order status: ${verification.status}` });
    }
    return res.status(400).json({
      success: false,
      status: verification.status,
      msg: `Payment not confirmed by the gateway. Status: ${verification.status}`,
      message: `Payment not confirmed by the gateway. Status: ${verification.status}`,
    });
  }

  const result = await capturePayment({
    db,
    payment,
    gatewayPaymentId: verification.gatewayPaymentId,
    method: verification.method,
    orderId: resolvedOrderId,
    gatewayAmountInRupees: verification.amountInRupees,
    source: 'VERIFY',
  });
  return res.status(200).json({
    success: true,
    message: result.alreadyCaptured ? 'Payment is already verified and confirmed' : 'Payment verified and captured successfully!',
    servicePaymentStatus: result.servicePaymentStatus,
    payment: toCaptureView(result.payment, resolvedOrderId),
  });
}));

// ---------------------------------------------------------------------------
// POST /api/payments/:paymentId/refund
// ---------------------------------------------------------------------------
router.post('/:paymentId/refund', requireAuth, refundLimiter, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { amount, reason = 'Customer requested refund' } = req.body || {};
  const db = getDb();
  const payment = await findPaymentByAnyId(db.collection('payments'), req.params.paymentId);
  if (!payment) throw new NotFoundError('Payment record not found');

  const authorized = await isGarageUserAuthorizedForPayment({ user: req.user, payment, db });
  if (!authorized) throw new ForbiddenError('Forbidden: You are not authorized to refund this payment');

  const before = { status: payment.status, totalRefundedAmount: payment.totalRefundedAmount || 0 };
  const result = await initiateRefund({ db, payment, amount, reason: String(reason), actor: req.user });

  await logFinancialAudit({
    actorId: req.user.id,
    actorRole: req.user.role || 'ADMIN',
    action: 'REFUND_COMPLETED',
    resourceType: 'PAYMENT',
    resourceId: String(payment._id),
    beforeState: before,
    afterState: { status: result.payment.status, totalRefundedAmount: result.payment.totalRefundedAmount, refundAmount: result.refund.amount },
    req,
    dbInstance: db,
  }).catch((err) => logger.warn('Refund audit log failed', { error: err.message }));

  res.status(200).json({
    success: true,
    message: `Refund of ₹${result.refund.amount} initiated successfully`,
    refund: result.refund,
    payment: {
      id: String(payment._id),
      status: result.payment.status,
      totalRefundedAmount: result.payment.totalRefundedAmount,
      remainingAmount: result.remainingAmount,
    },
  });
}));

// ---------------------------------------------------------------------------
// GET /api/payments/:paymentId/refund-status
// ---------------------------------------------------------------------------
router.get('/:paymentId/refund-status', requireAuth, asyncHandler(async (req, res) => {
  const payment = await findPaymentByAnyId(getDb().collection('payments'), req.params.paymentId);
  if (!payment) throw new NotFoundError('Payment record not found');
  if (!canViewPayment(req.user, payment)) throw new ForbiddenError();
  res.status(200).json({
    success: true,
    cfOrderId: payment.cfOrderId,
    cashfreePaymentId: payment.cashfreePaymentId,
    status: payment.status,
    originalAmount: payment.amount,
    totalRefundedAmount: payment.totalRefundedAmount || 0,
    refunds: payment.refunds || [],
  });
}));

// ---------------------------------------------------------------------------
// GET /api/payments/details/:id
// ---------------------------------------------------------------------------
router.get('/details/:id', requireAuth, asyncHandler(async (req, res) => {
  const db = getDb();
  const payment = await findPaymentByAnyId(db.collection('payments'), req.params.id);
  if (!payment) throw new NotFoundError('Payment record not found');
  if (!canViewPayment(req.user, payment)) throw new ForbiddenError();

  const serviceObjectId = payment.serviceId ? toObjectId(payment.serviceId) : null;
  const service = serviceObjectId ? await db.collection('services').findOne({ _id: serviceObjectId }, { projection: { invoiceNumber: 1, garageGstin: 1, gstin: 1 } }) : null;

  res.status(200).json({
    success: true,
    payment: {
      ...toPaymentListItem(payment),
      invoiceNumber: payment.invoiceNumber || (service && service.invoiceNumber) || '—',
      garageGstin: (service && (service.garageGstin || service.gstin)) || null,
      userId: payment.userId,
      garageId: payment.garageId,
      failureReason: payment.failureReason,
      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
    },
  });
}));

// ---------------------------------------------------------------------------
// POST /api/payments/cashfree-webhook — HMAC-SHA256 signed, timestamp-fresh, deduplicated.
// ---------------------------------------------------------------------------
const WEBHOOK_EVENT = Object.freeze({
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS_WEBHOOK',
  PAYMENT_FAILED: 'PAYMENT_FAILED_WEBHOOK',
  REFUND_STATUS: 'REFUND_STATUS_WEBHOOK',
});

/** Strategy map: one handler per webhook type (Replace Conditional with Polymorphism). */
const webhookHandlers = {
  async [WEBHOOK_EVENT.PAYMENT_SUCCESS]({ db, data, cfOrderId }) {
    const payment = await findPaymentByOrderId(db.collection('payments'), cfOrderId);
    if (!payment) return;
    await capturePayment({
      db,
      payment,
      gatewayPaymentId: data.payment && data.payment.cf_payment_id ? String(data.payment.cf_payment_id) : null,
      method: data.payment && data.payment.payment_method && data.payment.payment_method.type ? String(data.payment.payment_method.type).toUpperCase() : 'ONLINE',
      orderId: cfOrderId,
      gatewayAmountInRupees: Number.isFinite(Number(data.payment && data.payment.payment_amount)) ? Number(data.payment.payment_amount) : null,
      source: 'WEBHOOK',
    });
  },
  async [WEBHOOK_EVENT.PAYMENT_FAILED]({ db, data, cfOrderId }) {
    const payment = await findPaymentByOrderId(db.collection('payments'), cfOrderId);
    if (!payment) return;
    const reason = (data.payment && data.payment.error_details && data.payment.error_details.error_description) || 'Payment failed via webhook';
    await markPaymentFailed({ db, payment, reason });
  },
  async [WEBHOOK_EVENT.REFUND_STATUS]({ db, data, cfOrderId }) {
    const refund = data.refund || {};
    const payment = await findPaymentByOrderId(db.collection('payments'), cfOrderId || refund.order_id);
    if (!payment) return;
    await applyRefundStatusEvent({
      db,
      payment,
      refundId: refund.refund_id,
      gatewayRefundId: refund.cf_refund_id,
      status: refund.refund_status,
      amount: refund.refund_amount,
    });
  },
};

router.post('/cashfree-webhook', asyncHandler(async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  if (!signature || !timestamp) return res.status(400).json({ error: 'Missing Cashfree webhook headers' });

  const rawBody = req.rawBody || JSON.stringify(req.body);
  if (!verifyCashfreeWebhook({ rawBody, timestamp, signature })) {
    logger.security('Cashfree webhook rejected (bad signature or stale timestamp)', { requestId: req.requestId });
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body || {};
  const eventType = event.type || 'unknown';
  const data = event.data || {};
  const cfOrderId = (data.order && data.order.order_id) || (data.refund && data.refund.order_id) || null;
  // Deterministic id: a gateway redelivery of the same body always maps to the same event.
  const bodyHash = crypto.createHash('sha256').update(Buffer.isBuffer(rawBody) ? rawBody : String(rawBody)).digest('hex').slice(0, 16);
  const eventId = `${cfOrderId}_${eventType}_${event.event_time || bodyHash}`;
  const db = getDb();

  const claim = await beginWebhookEvent({
    eventId,
    eventType,
    cashfreePaymentId: data.payment && data.payment.cf_payment_id ? String(data.payment.cf_payment_id) : null,
    cfOrderId,
    dbInstance: db,
  });
  if (!claim.shouldProcess) return res.status(200).json({ status: 'ok', message: 'Webhook already processed or currently processing' });

  try {
    const handler = webhookHandlers[eventType];
    if (handler && cfOrderId) await handler({ db, data, cfOrderId });
    await markWebhookEventProcessed(eventId, { status: 'PROCESSED', dbInstance: db });
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    await markWebhookEventProcessed(eventId, { status: 'FAILED', failureReason: String(err && err.message || err).slice(0, 500), dbInstance: db })
      .catch((markErr) => logger.error('Failed to mark webhook event as failed', { error: markErr.message }));
    logger.error('Error handling Cashfree webhook event', { eventType, error: err.message });
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/payments/status/:orderId
// ---------------------------------------------------------------------------
router.get('/status/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const payment = await findPaymentByOrderId(getDb().collection('payments'), req.params.orderId);
  if (!payment) throw new NotFoundError('Payment order not found');
  if (String(payment.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') throw new ForbiddenError();
  const view = toPaymentListItem(payment);
  res.status(200).json({ success: true, payment: { ...view, cashfreePaymentId: payment.cashfreePaymentId, paymentId: payment.cashfreePaymentId, paidAt: payment.paidAt } });
}));

// ---------------------------------------------------------------------------
// GET /api/payments/history — paginated (?page&limit), headers carry totals.
// ---------------------------------------------------------------------------
router.get('/history', requireAuth, asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const payments = getDb().collection('payments');
  const query = { userId: String(req.user.id) };

  if (typeof status === 'string' && status !== 'ALL') {
    query.status = HISTORY_STATUS_FILTERS[status] || status;
  }
  const regex = safeSearchRegex(search);
  if (regex) {
    query.$or = ['invoiceNumber', 'vehicleNumber', 'garageName', 'serviceType', 'cashfreePaymentId', 'cfOrderId'].map((field) => ({ [field]: regex }));
  }

  const page = parsePagination(req.query, { defaultLimit: HISTORY_DEFAULT_LIMIT });
  const [rows, total] = await Promise.all([
    payments.find(query).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).toArray(),
    payments.countDocuments(query),
  ]);
  setPaginationHeaders(res, { total, page: page.page, limit: page.limit });
  res.status(200).json({ success: true, payments: withoutSupersededAttempts(rows).map(toPaymentListItem) });
}));

// ---------------------------------------------------------------------------
// GET /api/payments/customer/financial-summary
// ---------------------------------------------------------------------------
const SUMMARY_PROJECTION = Object.freeze({
  status: 1, amount: 1, amountPaise: 1, totalRefundedAmount: 1, refundedPaise: 1, invoiceNumber: 1, serviceId: 1, invoiceId: 1,
  vehicleNumber: 1, createdAt: 1, paidAt: 1, cfOrderId: 1, cashfreePaymentId: 1, serviceType: 1, garageName: 1, refunds: 1, currency: 1, vehicleId: 1, paymentMethod: 1,
});

router.get('/customer/financial-summary', requireAuth, asyncHandler(async (req, res) => {
  const db = getDb();
  const userId = String(req.user.id);
  const [userPayments, invoicesCount] = await Promise.all([
    db.collection('payments').find({ userId }, { projection: SUMMARY_PROJECTION }).sort({ createdAt: -1 }).toArray(),
    db.collection('invoices').countDocuments({ customerId: userId }),
  ]);
  const active = withoutSupersededAttempts(userPayments);

  let totalPaidPaise = 0;
  let pendingPaise = 0;
  let refundPaise = 0;
  const statusDistribution = { PENDING: 0, AUTHORIZED: 0, CAPTURED: 0, FAILED: 0, PARTIALLY_REFUNDED: 0, REFUNDED: 0 };
  const vehicles = new Set();

  active.forEach((p) => {
    const amtPaise = Math.round(Number(p.amountPaise || p.amount * 100) || 0);
    const refPaise = Math.round(Number(p.refundedPaise || (p.totalRefundedAmount || 0) * 100) || 0);
    if (PAID_STATUSES.includes(p.status)) {
      totalPaidPaise += amtPaise - refPaise; statusDistribution.CAPTURED += 1;
    } else if (p.status === PAYMENT_STATUS.REFUNDED) {
      refundPaise += amtPaise; statusDistribution.REFUNDED += 1;
    } else if (p.status === PAYMENT_STATUS.PARTIALLY_REFUNDED) {
      totalPaidPaise += amtPaise - refPaise; refundPaise += refPaise; statusDistribution.PARTIALLY_REFUNDED += 1;
    } else if (OPEN_PAYMENT_STATUSES.includes(p.status)) {
      pendingPaise += amtPaise; statusDistribution.PENDING += 1;
    } else if (p.status === PAYMENT_STATUS.AUTHORIZED) {
      pendingPaise += amtPaise; statusDistribution.AUTHORIZED += 1;
    } else if (p.status === PAYMENT_STATUS.FAILED) {
      statusDistribution.FAILED += 1;
    }
    if (p.vehicleNumber) vehicles.add(p.vehicleNumber);
  });

  res.status(200).json({
    success: true,
    summary: {
      totalPaidAmount: totalPaidPaise / 100,
      totalPaidPaise,
      pendingAmount: pendingPaise / 100,
      pendingPaise,
      refundAmount: refundPaise / 100,
      refundPaise,
      transactionsCount: userPayments.length,
      invoicesCount: invoicesCount || userPayments.length,
      statusDistribution,
      vehicles: Array.from(vehicles),
      recentActivity: active.slice(0, RECENT_ACTIVITY_COUNT).map(toPaymentListItem),
    },
  });
}));

module.exports = router;
module.exports.webhookHandlers = webhookHandlers;
