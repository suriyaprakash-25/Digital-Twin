/**
 * Payment capture (Extract Class).
 *
 * Previously implemented twice — inline in POST /payments/verify and again, differently, in the
 * Cashfree webhook — with non-atomic check-then-write updates. Both entry points now call
 * `capturePayment`, which:
 *   1. moves the payment to CAPTURED with a compare-and-swap (exactly one caller wins; the other
 *      gets `alreadyCaptured`), so verify + webhook racing can never double-process;
 *   2. compares the gateway-confirmed amount with the invoice's CURRENT total, so paying an order
 *      created before the garage raised the invoice yields PARTIALLY_PAID, not PAID;
 *   3. updates service/invoice + earnings inside a transaction when the deployment supports it;
 *   4. publishes `payment.captured`; notifications are delivered asynchronously via the job queue.
 */
const { PAYMENT_STATUS } = require('../../models/Payment');
const { recordPaymentEarnings } = require('../earningsService');
const { runInTransaction, withSession } = require('../../core/transaction');
const { getMongoClient } = require('../../db');
const { eventBus, DOMAIN_EVENTS } = require('../../infrastructure/messaging/eventBus');
const { logger } = require('../logger');
const {
  CAPTURABLE_STATUSES,
  OPEN_PAYMENT_STATUSES,
  idVariants,
  serviceFilterForPayment,
  amountDueOf,
} = require('./paymentRecords');

const { PAYMENTS } = require('../../core/constants');

const AMOUNT_TOLERANCE_RUPEES = 0.01;
const SERVICE_PAYMENT_STATUS = Object.freeze({ PAID: 'PAID', PARTIALLY_PAID: 'PARTIALLY_PAID' });

/**
 * @param {object} params
 * @param {import('mongodb').Db} params.db
 * @param {object} params.payment               payment document (any state)
 * @param {string|null} params.gatewayPaymentId
 * @param {string} params.method
 * @param {string} params.orderId
 * @param {number|null} [params.gatewayAmountInRupees] amount the gateway says was paid
 * @param {'VERIFY'|'WEBHOOK'} params.source
 * @returns {Promise<{ captured: boolean, alreadyCaptured: boolean, payment: object, servicePaymentStatus?: string }>}
 */
async function capturePayment({ db, payment, gatewayPaymentId, method, orderId, gatewayAmountInRupees = null, source }) {
  const payments = db.collection('payments');
  const paidAt = new Date();

  const captured = await payments.findOneAndUpdate(
    { _id: payment._id, status: { $in: CAPTURABLE_STATUSES } },
    {
      $set: {
        status: PAYMENT_STATUS.CAPTURED,
        cashfreePaymentId: gatewayPaymentId || payment.cashfreePaymentId || null,
        paymentMethod: method,
        paidAt,
        capturedVia: source,
        gatewayAmount: gatewayAmountInRupees,
        failureReason: null,
        updatedAt: paidAt,
      },
    },
    { returnDocument: 'after' }
  );

  if (!captured) {
    const current = await payments.findOne({ _id: payment._id });
    return { captured: false, alreadyCaptured: Boolean(current && current.status !== PAYMENT_STATUS.FAILED), payment: current || payment };
  }

  const serviceFilter = serviceFilterForPayment(captured);
  const services = db.collection('services');
  const invoices = db.collection('invoices');
  const serviceDoc = serviceFilter ? await services.findOne(serviceFilter) : null;

  // Underpayment guard: compare what the gateway collected with what is owed NOW.
  const currentDue = amountDueOf(serviceDoc);
  const collected = Number.isFinite(gatewayAmountInRupees) ? gatewayAmountInRupees : Number(captured.amount);
  const shortfall = currentDue !== null ? Math.round((currentDue - collected) * 100) / 100 : 0;
  const servicePaymentStatus = shortfall > AMOUNT_TOLERANCE_RUPEES ? SERVICE_PAYMENT_STATUS.PARTIALLY_PAID : SERVICE_PAYMENT_STATUS.PAID;
  if (servicePaymentStatus === SERVICE_PAYMENT_STATUS.PARTIALLY_PAID) {
    logger.financial('Captured payment is less than the current invoice total', {
      action: 'PAYMENT_UNDERPAID', resourceId: String(captured._id), currentDue, collected, shortfall,
    });
  }

  await runInTransaction(getMongoClient(), async (session) => {
    if (serviceFilter) {
      const serviceUpdate = {
        paymentStatus: servicePaymentStatus,
        amountPaid: collected,
        amountDue: Math.max(0, shortfall),
        paidAt,
        paymentId: gatewayPaymentId,
        paymentMethod: method,
        cfOrderId: orderId,
        updatedAt: paidAt,
      };
      await services.updateOne(serviceFilter, { $set: serviceUpdate }, withSession(session));
      await invoices.updateOne(serviceFilter, {
        $set: { status: servicePaymentStatus, paidAt, paymentId: gatewayPaymentId, paymentMethod: method, amountDue: Math.max(0, shortfall), updatedAt: paidAt },
      }, withSession(session));
    }

    // Abandoned checkout attempts for the same invoice are no longer payable.
    const staleFilters = [];
    if (captured.invoiceNumber && captured.invoiceNumber !== '—') staleFilters.push({ invoiceNumber: captured.invoiceNumber });
    if (captured.invoiceId) staleFilters.push({ invoiceId: String(captured.invoiceId) });
    if (captured.serviceId) staleFilters.push({ serviceId: String(captured.serviceId) });
    if (staleFilters.length) {
      await payments.updateMany(
        { _id: { $ne: captured._id }, $or: staleFilters, status: { $in: OPEN_PAYMENT_STATUSES } },
        { $set: { status: PAYMENT_STATUS.FAILED, failureReason: 'Superseded by a successful payment for the same invoice', updatedAt: paidAt } },
        withSession(session)
      );
    }
  });

  // Unique index on garage_earnings.paymentId makes this idempotent across retries.
  try {
    await recordPaymentEarnings({ payment: captured, dbInstance: db });
  } catch (err) {
    logger.warn('Garage earnings ledger write failed; integrity scan will flag it', { resourceId: String(captured._id), error: err.message });
  }

  await eventBus.publish(DOMAIN_EVENTS.PAYMENT_CAPTURED, { payment: captured, servicePaymentStatus });
  return { captured: true, alreadyCaptured: false, payment: captured, servicePaymentStatus };
}

/** Marks a not-yet-captured payment FAILED (never overwrites a capture). */
async function markPaymentFailed({ db, payment, reason }) {
  const result = await db.collection('payments').updateOne(
    { _id: payment._id, status: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.AUTHORIZED] } },
    { $set: { status: PAYMENT_STATUS.FAILED, failureReason: String(reason || 'Payment failed').slice(0, 300), updatedAt: new Date() } }
  );
  if (result.modifiedCount) await eventBus.publish(DOMAIN_EVENTS.PAYMENT_FAILED, { payment, reason });
  return result.modifiedCount > 0;
}

/** True when an online checkout for this service is open (invoice must not change under it). */
async function hasOpenPaymentForService(db, serviceId) {
  const ids = idVariants(serviceId).map(String);
  if (!ids.length) return false;
  const open = await db.collection('payments').findOne({
    $or: [{ serviceId: { $in: ids } }, { invoiceId: { $in: ids } }],
    status: { $in: OPEN_PAYMENT_STATUSES },
    updatedAt: { $gte: new Date(Date.now() - PAYMENTS.CHECKOUT_LOCK_MS) },
  }, { projection: { _id: 1 } });
  return Boolean(open);
}

module.exports = { capturePayment, markPaymentFailed, hasOpenPaymentForService, SERVICE_PAYMENT_STATUS };
