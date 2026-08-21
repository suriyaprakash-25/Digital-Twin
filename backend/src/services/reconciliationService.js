const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { RECONCILIATION_STATUS, MISMATCH_TYPE } = require('../models/Reconciliation');
const { fetchPaymentDetails } = require('./razorpayService');
const { PAYMENT_STATUS } = require('../models/Payment');

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * Reconciles a single DrivePortz payment against Razorpay, Invoice, and Garage Earnings
 * @param {Object} params
 * @param {Object} params.payment - Payment document
 * @param {Object} [params.dbInstance]
 * @param {Object} [params.razorpayData] - Optional mock/pre-fetched Razorpay payment data
 * @returns {Promise<Object>} Reconciliation document
 */
async function reconcilePayment({ payment, dbInstance, razorpayData }) {
  if (!payment) throw new Error('Missing payment object to reconcile');

  const db = dbInstance || getDb();
  const services = db.collection('services');
  const earnings = db.collection('garage_earnings');
  const settlements = db.collection('settlements');
  const reconciliations = db.collection('payment_reconciliations');

  const paymentIdStr = String(payment._id || payment.paymentId || payment.razorpayPaymentId);
  const now = new Date();

  // 1. Fetch Service / Invoice record
  let serviceDoc = null;
  if (payment.serviceId) {
    const sId = safeObjectId(payment.serviceId);
    serviceDoc = sId
      ? await services.findOne({ $or: [{ _id: sId }, { _id: String(payment.serviceId) }] })
      : await services.findOne({ _id: String(payment.serviceId) });
  }

  // 2. Fetch Garage Earnings record
  const earningDoc = await earnings.findOne({
    $or: [
      { paymentId: paymentIdStr },
      { razorpayPaymentId: payment.razorpayPaymentId || paymentIdStr }
    ]
  });

  // 3. Fetch Settlement record if attached
  let settlementDoc = null;
  if (earningDoc?.settlementId) {
    settlementDoc = await settlements.findOne({ settlementId: earningDoc.settlementId });
  }

  // 4. Fetch Razorpay Payment Record from Gateway
  let rzpPayment = razorpayData || null;
  let rzpFetchError = null;

  if (!rzpPayment && payment.razorpayPaymentId && payment.razorpayPaymentId.startsWith('pay_')) {
    try {
      rzpPayment = await fetchPaymentDetails(payment.razorpayPaymentId);
    } catch (err) {
      rzpFetchError = err.message || 'Payment not found on Razorpay';
    }
  }

  // Integer Paise Calculations
  const expectedAmountPaise = payment.amountInPaise || Math.round((parseFloat(payment.amount) || 0) * 100);
  const razorpayAmountPaise = rzpPayment ? Math.round(Number(rzpPayment.amount) || 0) : null;

  const expectedRefundAmountPaise = Math.round((parseFloat(payment.totalRefundedAmount) || 0) * 100);
  const razorpayRefundAmountPaise = rzpPayment ? Math.round(Number(rzpPayment.amount_refunded) || 0) : 0;

  const expectedPaymentStatus = String(payment.status || '').toUpperCase();
  const razorpayPaymentStatus = rzpPayment ? String(rzpPayment.status || '').toLowerCase() : (rzpFetchError ? 'NOT_FOUND' : 'UNKNOWN');

  const expectedCurrency = (payment.currency || 'INR').toUpperCase();
  const razorpayCurrency = rzpPayment ? String(rzpPayment.currency || 'INR').toUpperCase() : 'INR';

  // 5. Evaluate Inconsistencies & Mismatch Detection
  const mismatches = [];

  if (!rzpPayment && !razorpayData) {
    mismatches.push({
      type: MISMATCH_TYPE.PAYMENT_NOT_FOUND,
      description: `Payment ${payment.razorpayPaymentId || paymentIdStr} could not be retrieved from Razorpay gateway.`
    });
  }

  if (payment.serviceId && !serviceDoc) {
    mismatches.push({
      type: MISMATCH_TYPE.INVOICE_NOT_FOUND,
      description: `Associated service record ${payment.serviceId} was not found in database.`
    });
  }

  if (rzpPayment && razorpayAmountPaise !== expectedAmountPaise) {
    mismatches.push({
      type: MISMATCH_TYPE.AMOUNT_MISMATCH,
      description: `Amount mismatch: Expected ₹${expectedAmountPaise / 100} (${expectedAmountPaise} paise), Razorpay has ₹${razorpayAmountPaise / 100} (${razorpayAmountPaise} paise).`
    });
  }

  if (rzpPayment && razorpayRefundAmountPaise !== expectedRefundAmountPaise) {
    mismatches.push({
      type: MISMATCH_TYPE.REFUND_MISMATCH,
      description: `Refund mismatch: Expected ₹${expectedRefundAmountPaise / 100} refunded, Razorpay has ₹${razorpayRefundAmountPaise / 100}.`
    });
  }

  if (rzpPayment && razorpayCurrency !== expectedCurrency) {
    mismatches.push({
      type: MISMATCH_TYPE.CURRENCY_MISMATCH,
      description: `Currency mismatch: Expected ${expectedCurrency}, Razorpay returned ${razorpayCurrency}.`
    });
  }

  // Status mapping verification: CAPTURED -> captured, REFUNDED -> captured / refunded
  if (rzpPayment) {
    const isRzpCaptured = rzpPayment.status === 'captured';
    const isDpCaptured = expectedPaymentStatus === PAYMENT_STATUS.CAPTURED || expectedPaymentStatus === PAYMENT_STATUS.REFUNDED || expectedPaymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED;

    if (isDpCaptured && !isRzpCaptured && rzpPayment.status !== 'refunded') {
      mismatches.push({
        type: MISMATCH_TYPE.STATUS_MISMATCH,
        description: `Status mismatch: DrivePortz is ${expectedPaymentStatus}, but Razorpay is ${rzpPayment.status}.`
      });
    }
  }

  // Earnings gross consistency
  if (earningDoc && earningDoc.grossPaise && earningDoc.grossPaise !== expectedAmountPaise) {
    mismatches.push({
      type: MISMATCH_TYPE.EARNINGS_MISMATCH,
      description: `Earnings ledger mismatch: Payment amount is ${expectedAmountPaise} paise, but earnings gross is ${earningDoc.grossPaise} paise.`
    });
  }

  // Final Reconciliation Classification
  let reconciliationStatus = RECONCILIATION_STATUS.MATCHED;
  let mismatchType = MISMATCH_TYPE.NONE;

  if (mismatches.length > 0) {
    if (mismatches.some(m => m.type === MISMATCH_TYPE.PAYMENT_NOT_FOUND)) {
      reconciliationStatus = RECONCILIATION_STATUS.MISSING;
      mismatchType = MISMATCH_TYPE.PAYMENT_NOT_FOUND;
    } else {
      reconciliationStatus = RECONCILIATION_STATUS.MISMATCH;
      mismatchType = mismatches.length === 1 ? mismatches[0].type : MISMATCH_TYPE.MULTIPLE_MISMATCH;
    }
  }

  const reconciliationDoc = {
    paymentId: paymentIdStr,
    razorpayPaymentId: payment.razorpayPaymentId || rzpPayment?.id || '—',
    razorpayOrderId: payment.razorpayOrderId || rzpPayment?.order_id || '—',
    invoiceId: String(payment.invoiceId || payment.serviceId || ''),
    invoiceNumber: payment.invoiceNumber || serviceDoc?.invoiceNumber || '—',
    userId: String(payment.userId || ''),
    garageId: String(payment.garageId || earningDoc?.garageId || ''),
    garageName: payment.garageName || earningDoc?.garageName || 'Authorized Service Center',
    serviceType: payment.serviceType || serviceDoc?.serviceType || 'Automotive Service',
    vehicleNumber: payment.vehicleNumber || 'N/A',

    expectedAmountPaise,
    expectedAmount: expectedAmountPaise / 100,
    razorpayAmountPaise: razorpayAmountPaise !== null ? razorpayAmountPaise : 0,
    razorpayAmount: razorpayAmountPaise !== null ? razorpayAmountPaise / 100 : 0,
    amountDifferencePaise: razorpayAmountPaise !== null ? Math.abs(expectedAmountPaise - razorpayAmountPaise) : expectedAmountPaise,
    amountDifference: razorpayAmountPaise !== null ? Math.abs(expectedAmountPaise - razorpayAmountPaise) / 100 : expectedAmountPaise / 100,

    expectedPaymentStatus,
    razorpayPaymentStatus,

    expectedRefundAmountPaise,
    expectedRefundAmount: expectedRefundAmountPaise / 100,
    razorpayRefundAmountPaise,
    razorpayRefundAmount: razorpayRefundAmountPaise / 100,

    expectedCurrency,
    razorpayCurrency,

    earningsSnapshot: earningDoc ? {
      grossAmount: earningDoc.grossAmount,
      platformCommission: earningDoc.platformCommission,
      garageNetAmount: earningDoc.garageNetAmount,
      status: earningDoc.status
    } : null,

    settlementSnapshot: settlementDoc ? {
      settlementId: settlementDoc.settlementId,
      status: settlementDoc.status,
      requestedAmount: settlementDoc.requestedAmount
    } : null,

    reconciliationStatus,
    mismatchType,
    mismatchDetails: mismatches,

    checkedAt: now,
    updatedAt: now
  };

  // Upsert reconciliation record
  await reconciliations.updateOne(
    { paymentId: paymentIdStr },
    {
      $set: reconciliationDoc,
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  return await reconciliations.findOne({ paymentId: paymentIdStr });
}

/**
 * Executes a batch reconciliation across recent payments
 * @param {Object} params
 * @param {number} [params.hours=24] - How many hours back to look
 * @param {number} [params.limit=50] - Maximum records in batch
 * @param {Object} [params.dbInstance]
 */
async function runBatchReconciliation({ hours = 24, limit = 50, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const payments = db.collection('payments');

  const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 50); // Cap at 50 per batch
  const sinceDate = new Date(Date.now() - (hours * 60 * 60 * 1000));

  const targetPayments = await payments
    .find({
      $or: [
        { paidAt: { $gte: sinceDate } },
        { createdAt: { $gte: sinceDate } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(maxLimit)
    .toArray();

  let matched = 0;
  let mismatched = 0;
  let missing = 0;
  const results = [];

  for (const p of targetPayments) {
    try {
      const rec = await reconcilePayment({ payment: p, dbInstance: db });
      if (rec.reconciliationStatus === RECONCILIATION_STATUS.MATCHED) matched++;
      else if (rec.reconciliationStatus === RECONCILIATION_STATUS.MISMATCH) mismatched++;
      else if (rec.reconciliationStatus === RECONCILIATION_STATUS.MISSING) missing++;
      results.push(rec);
    } catch (err) {
      console.warn(`Error reconciling payment ${p._id}:`, err.message);
    }
  }

  return {
    totalChecked: targetPayments.length,
    matched,
    mismatched,
    missing,
    results
  };
}

module.exports = {
  reconcilePayment,
  runBatchReconciliation
};
