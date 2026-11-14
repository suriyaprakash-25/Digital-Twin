/**
 * Payment notifications moved off the request path (Observer + async messaging).
 *
 * Event subscribers only ENQUEUE durable jobs (fast, can't fail the payment); the job worker then
 * delivers push/in-app notifications with retries. `dedupeKey` makes enqueueing idempotent, so a
 * verify call and a webhook for the same capture produce exactly one notification per recipient.
 */
const { eventBus, DOMAIN_EVENTS } = require('../../infrastructure/messaging/eventBus');
const { enqueue } = require('../../infrastructure/messaging/jobQueue');

const JOB_TYPES = Object.freeze({ SEND_NOTIFICATION: 'notification.send' });

function formatRupees(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

async function onPaymentCaptured({ payment, servicePaymentStatus }) {
  const paymentId = String(payment._id);
  const data = { type: 'PAYMENT_SUCCESS', paymentId: payment.cashfreePaymentId || paymentId, serviceId: String(payment.serviceId || ''), invoiceNumber: payment.invoiceNumber || '' };
  const jobs = [];
  if (payment.userId) {
    const partial = servicePaymentStatus === 'PARTIALLY_PAID';
    jobs.push(enqueue(JOB_TYPES.SEND_NOTIFICATION, {
      userId: String(payment.userId),
      title: partial ? 'Payment Received – Balance Due' : 'Payment Successful',
      body: partial
        ? `We received ${formatRupees(payment.gatewayAmount || payment.amount)} for invoice ${payment.invoiceNumber || 'N/A'}. The invoice was updated, so a balance is still due.`
        : `Your payment of ${formatRupees(payment.amount)} for ${payment.serviceType || 'Service'} has been confirmed. (Invoice: ${payment.invoiceNumber || 'N/A'})`,
      data,
    }, { dedupeKey: `payment-captured:${paymentId}:user` }));
  }
  if (payment.garageId) {
    jobs.push(enqueue(JOB_TYPES.SEND_NOTIFICATION, {
      userId: String(payment.garageId),
      title: 'Payment Received',
      body: `Payment of ${formatRupees(payment.gatewayAmount || payment.amount)} received from customer for ${payment.vehicleNumber || 'Vehicle'}.`,
      data,
    }, { dedupeKey: `payment-captured:${paymentId}:garage` }));
  }
  await Promise.all(jobs);
}

async function onRefundInitiated({ payment, refund }) {
  if (!payment.userId) return;
  const fullyRefunded = payment.status === 'REFUNDED';
  await enqueue(JOB_TYPES.SEND_NOTIFICATION, {
    userId: String(payment.userId),
    title: fullyRefunded ? 'Payment Refunded' : 'Partial Refund Processed',
    body: `A refund of ${formatRupees(refund.amount)} has been initiated for your invoice ${payment.invoiceNumber || ''}.`,
    data: { type: 'REFUND_COMPLETED', cfOrderId: payment.cfOrderId || '', refundId: refund.refundId, amount: String(refund.amount) },
  }, { dedupeKey: `refund:${refund.refundId}:user` });
}

let registered = false;
/** Wires subscribers once per process. Returns job handlers for the worker. */
function registerPaymentNotifications({ notifyUser = require('../notifications').notifyUser } = {}) {
  if (!registered) {
    eventBus.subscribe(DOMAIN_EVENTS.PAYMENT_CAPTURED, onPaymentCaptured);
    eventBus.subscribe(DOMAIN_EVENTS.REFUND_INITIATED, onRefundInitiated);
    registered = true;
  }
  return {
    [JOB_TYPES.SEND_NOTIFICATION]: async ({ userId, title, body, data }) => {
      await notifyUser(userId, { title, body, data });
    },
  };
}

module.exports = { registerPaymentNotifications, JOB_TYPES, onPaymentCaptured, onRefundInitiated };
