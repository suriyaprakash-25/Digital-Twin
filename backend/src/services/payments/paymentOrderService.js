/**
 * Checkout order creation (Extract Class from routes/payments.js POST /create-order).
 *
 * Responsibilities: resolve what is being paid for, authorise the payer, derive the amount from the
 * database (never from the client), create the gateway order and persist the attempt.
 */
const { PAYMENT_STATUS } = require('../../models/Payment');
const { evaluateTransactionRisk } = require('../paymentRiskService');
const { logFinancialAudit } = require('../auditService');
const { isPaymentOrderAuthorized } = require('../../security/paymentAuthorization');
const { ForbiddenError, NotFoundError, ValidationError, UpstreamError } = require('../../core/errors');
const { PAYMENTS } = require('../../core/constants');
const { logger } = require('../logger');
const { getDefaultGateway } = require('./gateways');
const { PAID_STATUSES, OPEN_PAYMENT_STATUSES, idVariants, toObjectId, amountDueOf } = require('./paymentRecords');

const ORDER_ID_PREFIX = 'DP';
const DEFAULT_GARAGE_NAME = 'Authorized Service Center';
const DEFAULT_SERVICE_TYPE = 'Automotive Service';

function buildTargetFilters(targetId, invoiceId) {
  const ids = idVariants(targetId);
  const filters = [
    { _id: { $in: ids } },
    { id: { $in: ids } },
    { invoiceNumber: String(targetId) },
    { invoiceId: { $in: ids } },
  ];
  if (invoiceId && invoiceId !== targetId) {
    const invIds = idVariants(invoiceId);
    filters.push({ _id: { $in: invIds } }, { invoiceNumber: String(invoiceId) }, { invoiceId: { $in: invIds } });
  }
  return filters;
}

/** Finds the payable document in services -> invoices -> payments (legacy rows live in all three). */
async function resolvePayableTarget(db, { targetId, invoiceId }) {
  const filters = buildTargetFilters(targetId, invoiceId);
  const services = db.collection('services');

  const service = await services.findOne({ $or: filters, isArchived: { $ne: true } });
  if (service) return service;

  const invoice = await db.collection('invoices').findOne({ $or: filters });
  if (invoice) return invoice;

  const payment = await db.collection('payments').findOne({ $or: filters });
  if (payment && payment.serviceId) {
    const linked = await services.findOne({ _id: { $in: idVariants(payment.serviceId) } });
    return linked ? { ...linked, ...payment } : payment;
  }
  return payment || null;
}

async function resolveVehicle(db, target) {
  const vehicles = db.collection('vehicles');
  if (target.vehicleId) {
    const objectId = toObjectId(target.vehicleId);
    return objectId
      ? vehicles.findOne({ _id: objectId, isArchived: { $ne: true } })
      : vehicles.findOne({ $or: [{ _id: String(target.vehicleId) }, { id: String(target.vehicleId) }], isArchived: { $ne: true } });
  }
  if (target.vehicleNumber) return vehicles.findOne({ vehicleNumber: target.vehicleNumber, isArchived: { $ne: true } });
  return null;
}

function assertPayable(target) {
  if (target.invoiceStatus === 'CANCELLED' || target.status === 'CANCELLED') {
    throw new ValidationError('Cannot pay for a cancelled invoice');
  }
  if (target.paymentStatus === 'PAID' || PAID_STATUSES.includes(target.status)) {
    throw new ValidationError('This service invoice is already paid');
  }
}

function newGatewayOrderId(target, fallbackId) {
  // Cashfree: max 50 chars, alphanumeric + _ -
  return `${ORDER_ID_PREFIX}_${String(target._id || fallbackId).slice(-10)}_${Date.now().toString().slice(-7)}`;
}

/**
 * @returns {Promise<object>} API response body (shape kept backward compatible with the SPA)
 */
async function createCheckoutOrder({ db, user, targetId, invoiceId, req }) {
  if (!targetId) throw new ValidationError('Service or Invoice ID is required');
  const payments = db.collection('payments');

  const target = await resolvePayableTarget(db, { targetId, invoiceId });
  if (!target) throw new NotFoundError('Service record or invoice not found');

  const vehicle = await resolveVehicle(db, target);
  if (!isPaymentOrderAuthorized({ user, vehicle, targetDoc: target })) {
    throw new ForbiddenError('Forbidden: You are not authorized to pay for this invoice');
  }
  assertPayable(target);

  const targetKey = String(target._id || targetId);
  const serviceKey = String(target.serviceId || target._id || targetId);
  const alreadyPaid = await payments.findOne({
    $or: [{ serviceId: targetKey }, { invoiceId: targetKey }, ...(target.invoiceNumber ? [{ invoiceNumber: target.invoiceNumber }] : [])],
    status: { $in: PAID_STATUSES },
  }, { projection: { _id: 1 } });
  if (alreadyPaid) throw new ValidationError('This service invoice is already paid');

  // Authoritative amount from the database. If a partial payment was captured, only the balance is due.
  const total = Number.isFinite(Number(target.amountDue)) && target.paymentStatus === 'PARTIALLY_PAID'
    ? Number(target.amountDue)
    : amountDueOf(target);
  if (!Number.isFinite(total) || total <= 0) {
    throw new ValidationError('Invalid service amount. Invoice total must be greater than zero.');
  }

  const invoiceNumber = target.invoiceNumber || `DP-INV-${new Date().getFullYear()}-${String(target._id).slice(-6).toUpperCase()}`;
  const garageId = target.garageId ? String(target.garageId) : (target.createdBy ? String(target.createdBy) : null);
  const garageName = target.garageName || DEFAULT_GARAGE_NAME;
  const serviceType = target.serviceType || target.title || DEFAULT_SERVICE_TYPE;
  const vehicleNumber = (vehicle && vehicle.vehicleNumber) || target.vehicleNumber || 'N/A';

  try {
    await evaluateTransactionRisk({ userId: user.id, garageId, invoiceId: target._id, amount: total, operation: 'PAYMENT', dbInstance: db });
  } catch (riskErr) {
    logger.warn('Risk evaluation warning', { error: riskErr.message });
  }

  const gateway = getDefaultGateway();
  const orderId = newGatewayOrderId(target, targetId);
  let order;
  try {
    order = await gateway.createOrder({
      orderId,
      amountInRupees: total,
      customer: { id: String(user.id), name: user.name || 'Customer', email: user.email || '', phone: user.phone || '' },
      meta: {
        serviceId: serviceKey,
        invoiceNumber,
        vehicleId: String(target.vehicleId || (vehicle ? vehicle._id : '')),
        userId: String(user.id),
        vehicleNumber,
        note: `Invoice ${invoiceNumber} - ${serviceType}`,
      },
    });
  } catch (err) {
    logger.error('Gateway order creation failed', { gateway: gateway.name, error: err && err.response ? JSON.stringify(err.response.data) : err.message });
    throw new UpstreamError('Failed to create payment order with the payment gateway. Please try again.', 'GATEWAY_ORDER_FAILED');
  }

  const now = new Date();
  const amountPaise = Math.round(total * PAYMENTS.PAISE_PER_RUPEE);
  const attemptFields = {
    cfOrderId: orderId,
    cashfreeOrderId: order.gatewayOrderId,
    paymentSessionId: order.sessionId,
    gateway: gateway.name,
    amount: total,
    amountPaise,
    invoiceNumber,
    vehicleNumber,
    garageName,
    serviceType,
    status: PAYMENT_STATUS.CREATED,
    updatedAt: now,
  };

  // Each checkout gets its own attempt record (previously a re-checkout overwrote the earlier
  // order id, so paying the older order captured money against no record). Older open attempts
  // stay verifiable until one is captured; capture supersedes the rest.
  const insert = await payments.insertOne({
    ...attemptFields,
    invoiceId: targetKey,
    serviceId: serviceKey,
    vehicleId: String(target.vehicleId || (vehicle ? vehicle._id : '')),
    userId: String(user.id),
    garageId,
    currency: PAYMENTS.CURRENCY,
    paymentMethod: null,
    failureReason: null,
    paidAt: null,
    createdAt: now,
  });
  const paymentRecordId = String(insert.insertedId);

  const openAttempts = await payments.countDocuments({ serviceId: serviceKey, status: { $in: OPEN_PAYMENT_STATUSES } });
  if (openAttempts > 1) logger.info('Multiple open checkout attempts for invoice', { resourceId: serviceKey, openAttempts });

  try {
    await logFinancialAudit({
      actorId: user.id, actorRole: 'USER', action: 'PAYMENT_ORDER_CREATED', resourceType: 'PAYMENT',
      resourceId: paymentRecordId, afterState: { cfOrderId: orderId, amount: total }, req, dbInstance: db,
    });
  } catch (auditErr) {
    logger.warn('Audit logging warning', { error: auditErr.message });
  }

  const cashfreeMode = String(process.env.CASHFREE_ENV || 'TEST').toUpperCase() === 'PRODUCTION' ? 'production' : 'sandbox';
  return {
    success: true,
    message: 'Payment order created successfully',
    cfOrderId: orderId,
    orderId,
    paymentSessionId: order.sessionId,
    amount: total,
    currency: PAYMENTS.CURRENCY,
    invoiceNumber,
    gateway: gateway.name,
    cashfreeMode,
    keyId: order.sessionId,
    order: {
      id: orderId,
      keyId: order.sessionId,
      cfOrderId: orderId,
      orderId,
      paymentSessionId: order.sessionId,
      amount: total,
      amountPaise,
      currency: PAYMENTS.CURRENCY,
      invoiceNumber,
      garageName,
      serviceType,
      paymentRecordId,
      cashfreeMode,
    },
  };
}

module.exports = { createCheckoutOrder, resolvePayableTarget };
