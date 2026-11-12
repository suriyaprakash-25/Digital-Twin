/**
 * Refunds (Extract Class + Introduce Interface).
 *
 * One implementation shared by POST /payments/:id/refund, dispute resolutions and gateway refund
 * webhooks. Fixes three defects of the previous copies:
 *   - Concurrency: the refundable balance is RESERVED atomically ($expr guard + $inc) before the
 *     gateway is called, so two concurrent refunds can never exceed the captured amount.
 *   - Gateway coverage: the gateway is resolved polymorphically, so Cashfree payments refunded via a
 *     dispute now actually move money (previously only `pay_` Razorpay ids were refunded and every
 *     other payment was marked "processed" without a gateway call).
 *   - Webhooks update the matching refund entry by refund id instead of guessing totals.
 */
const { PAYMENT_STATUS } = require('../../models/Payment');
const { reconcileRefundEarnings } = require('../earningsService');
const { eventBus, DOMAIN_EVENTS } = require('../../infrastructure/messaging/eventBus');
const { ConflictError, UpstreamError, ValidationError } = require('../../core/errors');
const { PAYMENTS } = require('../../core/constants');
const { logger } = require('../logger');
const { resolveGatewayForPayment } = require('./gateways');
const { REFUNDABLE_STATUSES, serviceFilterForPayment } = require('./paymentRecords');

const roundRupees = (value) => Math.round((Number(value) || 0) * PAYMENTS.PAISE_PER_RUPEE) / PAYMENTS.PAISE_PER_RUPEE;
const REFUND_ENTRY_STATUS = Object.freeze({ PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAILED: 'FAILED', MANUAL: 'MANUAL_PAYOUT_REQUIRED' });

function refundableBalance(payment) {
  return roundRupees((Number(payment.amount) || 0) - (Number(payment.totalRefundedAmount) || 0) - (Number(payment.pendingRefundAmount) || 0));
}

function newRefundReference(payment) {
  return `ref_${String(payment._id).slice(-6)}_${Date.now().toString(36)}`;
}

async function syncServiceRefundState(db, payment) {
  const filter = serviceFilterForPayment(payment);
  if (!filter) return;
  await db.collection('services').updateOne(filter, {
    $set: { paymentStatus: payment.status, totalRefundedAmount: payment.totalRefundedAmount, refundedAt: payment.refundedAt, updatedAt: new Date() },
  });
}

/**
 * @param {object} params
 * @param {import('mongodb').Db} params.db
 * @param {object} params.payment
 * @param {number} [params.amount] rupees; defaults to the full refundable balance
 * @param {string} params.reason
 * @param {{ id: string, role: string }} params.actor
 * @param {object} [params.context] extra fields stored on the refund entry (e.g. disputeNumber)
 */
async function initiateRefund({ db, payment, amount, reason, actor, context = {} }) {
  const payments = db.collection('payments');

  if (!REFUNDABLE_STATUSES.includes(payment.status)) {
    throw new ValidationError(`Only captured payments can be refunded. Current status is ${payment.status}`);
  }
  const balance = refundableBalance(payment);
  if (balance <= 0) throw new ValidationError('This payment has already been fully refunded');

  const requested = amount === undefined || amount === null || amount === '' ? balance : roundRupees(amount);
  if (!Number.isFinite(requested) || requested <= 0 || requested > balance) {
    throw new ValidationError(`Invalid refund amount. Must be between ₹0.01 and ₹${balance}`);
  }

  // 1. Reserve the amount atomically. Fails if another refund consumed the balance meanwhile.
  const reserved = await payments.findOneAndUpdate(
    {
      _id: payment._id,
      status: { $in: REFUNDABLE_STATUSES },
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ['$totalRefundedAmount', 0] }, { $ifNull: ['$pendingRefundAmount', 0] }, requested] },
          { $add: [{ $toDouble: '$amount' }, 0.001] },
        ],
      },
    },
    { $inc: { pendingRefundAmount: requested }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!reserved) throw new ConflictError('Refund exceeds the remaining refundable balance or another refund is in progress', 'REFUND_CONFLICT');

  // 2. Move the money through whichever gateway captured it.
  const gateway = resolveGatewayForPayment(reserved);
  const reference = newRefundReference(reserved);
  let gatewayResult;
  try {
    gatewayResult = gateway
      ? await gateway.refund({ payment: reserved, refundId: reference, amountInRupees: requested, reason })
      : { refundId: reference, gatewayRefundId: null, status: REFUND_ENTRY_STATUS.MANUAL };
  } catch (err) {
    await payments.updateOne({ _id: payment._id }, { $inc: { pendingRefundAmount: -requested } });
    logger.error('Gateway refund failed; reservation released', { resourceId: String(payment._id), gateway: gateway && gateway.name, error: err.message });
    throw new UpstreamError('Failed to process refund with the payment gateway', 'REFUND_GATEWAY_FAILED');
  }

  // 3. Commit the reservation into the ledger.
  const now = new Date();
  const entry = {
    refundId: gatewayResult.refundId,
    gatewayRefundId: gatewayResult.gatewayRefundId,
    cfRefundId: gateway && gateway.name === 'cashfree' ? gatewayResult.gatewayRefundId : null,
    gateway: gateway ? gateway.name : 'manual',
    amount: requested,
    currency: PAYMENTS.CURRENCY,
    reason: String(reason || '').slice(0, 300),
    status: String(gatewayResult.status || REFUND_ENTRY_STATUS.PENDING).toUpperCase(),
    receipt: reference,
    initiatedBy: actor ? String(actor.id) : 'SYSTEM',
    createdAt: now,
    ...context,
  };
  const committed = await payments.findOneAndUpdate(
    { _id: payment._id },
    [
      {
        $set: {
          totalRefundedAmount: { $round: [{ $add: [{ $ifNull: ['$totalRefundedAmount', 0] }, requested] }, 2] },
          pendingRefundAmount: { $round: [{ $subtract: [{ $ifNull: ['$pendingRefundAmount', 0] }, requested] }, 2] },
          refunds: { $concatArrays: [{ $ifNull: ['$refunds', []] }, [{ $literal: entry }]] },
          refundedAt: now,
          updatedAt: now,
        },
      },
      {
        $set: {
          status: {
            $cond: [{ $gte: ['$totalRefundedAmount', { $subtract: [{ $toDouble: '$amount' }, 0.001] }] }, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED],
          },
        },
      },
    ],
    { returnDocument: 'after' }
  );

  await syncServiceRefundState(db, committed);
  try {
    await reconcileRefundEarnings({ payment: committed, refundAmount: requested, dbInstance: db });
  } catch (err) {
    logger.warn('Refund earnings reconciliation failed; integrity scan will flag it', { resourceId: String(payment._id), error: err.message });
  }

  await eventBus.publish(DOMAIN_EVENTS.REFUND_INITIATED, { payment: committed, refund: entry });
  return { refund: entry, payment: committed, remainingAmount: refundableBalance(committed) };
}

/**
 * Applies a gateway refund-status webhook. Idempotent: matches the refund by id; unknown successful
 * refunds (e.g. issued from the gateway dashboard) are recorded once, bounded by the captured amount.
 */
async function applyRefundStatusEvent({ db, payment, refundId, gatewayRefundId, status, amount }) {
  const payments = db.collection('payments');
  const normalizedStatus = String(status || '').toUpperCase();
  const existing = (payment.refunds || []).find((r) => (refundId && r.refundId === refundId) || (gatewayRefundId && String(r.cfRefundId || r.gatewayRefundId) === String(gatewayRefundId)));

  if (existing) {
    await payments.updateOne(
      { _id: payment._id },
      { $set: { 'refunds.$[r].status': normalizedStatus, 'refunds.$[r].statusUpdatedAt': new Date(), updatedAt: new Date() } },
      { arrayFilters: [{ 'r.refundId': existing.refundId }] }
    );
    return { applied: true, recordedNew: false };
  }

  if (normalizedStatus !== REFUND_ENTRY_STATUS.SUCCESS || !(Number(amount) > 0)) return { applied: false, recordedNew: false };

  const requested = roundRupees(amount);
  const updated = await payments.findOneAndUpdate(
    {
      _id: payment._id,
      'refunds.refundId': { $ne: refundId },
      $expr: { $lte: [{ $add: [{ $ifNull: ['$totalRefundedAmount', 0] }, requested] }, { $add: [{ $toDouble: '$amount' }, 0.001] }] },
    },
    [
      {
        $set: {
          totalRefundedAmount: { $round: [{ $add: [{ $ifNull: ['$totalRefundedAmount', 0] }, requested] }, 2] },
          refunds: { $concatArrays: [{ $ifNull: ['$refunds', []] }, [{ $literal: { refundId, cfRefundId: gatewayRefundId || null, amount: requested, status: normalizedStatus, source: 'GATEWAY_WEBHOOK', createdAt: new Date() } }]] },
          refundedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { $set: { status: { $cond: [{ $gte: ['$totalRefundedAmount', { $subtract: [{ $toDouble: '$amount' }, 0.001] }] }, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED] } } },
    ],
    { returnDocument: 'after' }
  );
  if (!updated) return { applied: false, recordedNew: false };

  await syncServiceRefundState(db, updated);
  await reconcileRefundEarnings({ payment: updated, refundAmount: requested, dbInstance: db }).catch((err) => logger.warn('Webhook refund reconciliation failed', { error: err.message }));
  await eventBus.publish(DOMAIN_EVENTS.REFUND_SETTLED, { payment: updated, refund: { refundId, amount: requested } });
  return { applied: true, recordedNew: true };
}

module.exports = { initiateRefund, applyRefundStatusEvent, refundableBalance, REFUND_ENTRY_STATUS };
