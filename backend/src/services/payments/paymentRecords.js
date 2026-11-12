/**
 * Payment record lookups (Extract Method).
 * The same "match this id in any of its historical shapes" logic was copy-pasted ~10 times across
 * routes/payments.js; it now lives here once.
 */
const { ObjectId } = require('mongodb');
const { PAYMENT_STATUS } = require('../../models/Payment');

const OPEN_PAYMENT_STATUSES = Object.freeze([PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING]);
const CAPTURABLE_STATUSES = Object.freeze([PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.AUTHORIZED, PAYMENT_STATUS.FAILED]);
const REFUNDABLE_STATUSES = Object.freeze([PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.PARTIALLY_REFUNDED]);
const PAID_STATUSES = Object.freeze([PAYMENT_STATUS.CAPTURED, 'PAID']);

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  try {
    return ObjectId.isValid(String(id)) && String(id).length === 24 ? new ObjectId(String(id)) : null;
  } catch {
    return null;
  }
}

/** String + ObjectId variants of an id, for collections that stored either form. */
function idVariants(id) {
  if (id === undefined || id === null || id === '') return [];
  const variants = [String(id)];
  const objectId = toObjectId(id);
  if (objectId) variants.push(objectId);
  return variants;
}

/** Filter matching the service/invoice a payment belongs to. Returns null if nothing to match. */
function serviceFilterForPayment(payment, fallbackServiceId) {
  const serviceId = payment.serviceId || fallbackServiceId || payment.invoiceId;
  const clauses = [];
  if (serviceId) {
    clauses.push({ _id: { $in: idVariants(serviceId) } }, { id: String(serviceId) });
  }
  if (payment.invoiceNumber && payment.invoiceNumber !== '—') clauses.push({ invoiceNumber: payment.invoiceNumber });
  return clauses.length ? { $or: clauses } : null;
}

function findPaymentByOrderId(payments, orderId, options) {
  return payments.findOne({ $or: [{ cfOrderId: orderId }, { cashfreeOrderId: orderId }] }, options);
}

function findPaymentByAnyId(payments, id) {
  const clauses = [{ cfOrderId: id }, { cashfreePaymentId: id }];
  const objectId = toObjectId(id);
  if (objectId) clauses.unshift({ _id: objectId });
  return payments.findOne({ $or: clauses });
}

/** Payer, payee garage, or admin. */
function canViewPayment(user, payment) {
  if (!user || !payment) return false;
  return String(payment.userId) === String(user.id)
    || (payment.garageId && String(payment.garageId) === String(user.id))
    || user.role === 'ADMIN';
}

/** Authoritative amount of a service/invoice document (legacy rows used several field names). */
function amountDueOf(doc) {
  if (!doc) return null;
  for (const field of ['totalAmount', 'totalCost', 'amount', 'price', 'cost']) {
    if (doc[field] !== undefined && doc[field] !== null && doc[field] !== '') {
      const value = Number(doc[field]);
      return Number.isFinite(value) ? value : null;
    }
  }
  return null;
}

module.exports = {
  OPEN_PAYMENT_STATUSES,
  CAPTURABLE_STATUSES,
  REFUNDABLE_STATUSES,
  PAID_STATUSES,
  toObjectId,
  idVariants,
  serviceFilterForPayment,
  findPaymentByOrderId,
  findPaymentByAnyId,
  canViewPayment,
  amountDueOf,
};
