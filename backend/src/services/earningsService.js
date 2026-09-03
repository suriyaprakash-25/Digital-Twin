const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { loadConfig } = require('../config');
const { EARNINGS_STATUS } = require('../models/Earnings');

/**
 * Calculates platform commission and net garage earnings strictly using integer paise
 * @param {Object} params
 * @param {number} params.amountInPaise - Gross transaction amount in paise
 * @param {number} [params.commissionRate] - Commission rate percentage (default from config)
 * @returns {Object} Calculated commission breakdown
 */
function calculateCommission({ amountInPaise, commissionRate }) {
  const config = loadConfig();
  const rate = commissionRate !== undefined ? Number(commissionRate) : (config.commission?.rate || 5);
  const grossPaise = Math.round(Number(amountInPaise) || 0);

  // Integer paise arithmetic
  const commissionPaise = Math.round((grossPaise * rate) / 100);
  const garageNetPaise = grossPaise - commissionPaise;

  return {
    grossPaise,
    grossAmount: grossPaise / 100,
    commissionRate: rate,
    commissionType: config.commission?.type || 'PERCENTAGE',
    commissionPaise,
    commissionAmount: commissionPaise / 100,
    garageNetPaise,
    garageNetAmount: garageNetPaise / 100,
    currency: 'INR'
  };
}

/**
 * Creates or updates the garage earnings ledger entry upon payment capture
 * Snapshots the commission rate so historical transactions are immutable.
 * @param {Object} params
 * @param {Object} params.payment - Captured Payment document
 * @param {Object} [params.service] - Service record
 * @param {Object} [params.dbInstance] - MongoDB db instance
 * @returns {Promise<Object>} Created or existing earnings record
 */
async function recordPaymentEarnings({ payment, service, dbInstance }) {
  if (!payment) throw new Error('Missing payment document');

  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');
  const payments = db.collection('payments');

  const paymentIdStr = String(payment._id || payment.paymentId || payment.razorpayPaymentId);
  const garageIdStr = String(payment.garageId || service?.createdBy || '');

  if (!garageIdStr) {
    console.warn(`Cannot create earnings ledger: missing garageId for payment ${paymentIdStr}`);
    return null;
  }

  // Idempotency: check if earnings record already exists
  const existing = await earnings.findOne({
    $or: [
      { paymentId: paymentIdStr },
      { razorpayPaymentId: payment.razorpayPaymentId || paymentIdStr }
    ]
  });

  if (existing) {
    return existing;
  }

  // Amount in paise
  const amountInPaise = payment.amountInPaise || Math.round((parseFloat(payment.amount) || 0) * 100);
  const config = loadConfig();
  const currentCommissionRate = config.commission?.rate || 5;

  const calculated = calculateCommission({
    amountInPaise,
    commissionRate: currentCommissionRate
  });

  const now = new Date();

  // Immutable Commission Snapshot
  const commissionSnapshot = {
    rate: calculated.commissionRate,
    type: calculated.commissionType,
    commissionPaise: calculated.commissionPaise,
    commissionAmount: calculated.commissionAmount,
    garageNetPaise: calculated.garageNetPaise,
    garageNetAmount: calculated.garageNetAmount,
    calculatedAt: now
  };

  const earningDoc = {
    garageId: garageIdStr,
    userId: String(payment.userId || ''),
    vehicleId: String(payment.vehicleId || ''),
    serviceId: String(payment.serviceId || ''),
    invoiceId: String(payment.invoiceId || payment.serviceId || ''),
    invoiceNumber: payment.invoiceNumber || service?.invoiceNumber || '—',
    paymentId: paymentIdStr,
    razorpayPaymentId: payment.razorpayPaymentId || '',
    serviceType: payment.serviceType || service?.serviceType || 'Automotive Service',
    vehicleNumber: payment.vehicleNumber || 'N/A',
    garageName: payment.garageName || 'Authorized Service Center',
    grossPaise: calculated.grossPaise,
    grossAmount: calculated.grossAmount,
    platformCommissionPaise: calculated.commissionPaise,
    platformCommission: calculated.commissionAmount,
    garageNetPaise: calculated.garageNetPaise,
    garageNetAmount: calculated.garageNetAmount,
    refundAmountPaise: 0,
    refundAmount: 0,
    netAfterRefundPaise: calculated.garageNetPaise,
    netAfterRefund: calculated.garageNetAmount,
    currency: 'INR',
    commissionRate: calculated.commissionRate,
    commissionType: calculated.commissionType,
    commissionSnapshot,
    status: EARNINGS_STATUS.AVAILABLE,
    settlementId: null,
    settledAt: null,
    createdAt: payment.paidAt || now,
    updatedAt: now
  };

  try {
    const result = await earnings.insertOne(earningDoc);
    const saved = { id: String(result.insertedId), ...earningDoc };

    // Update payment record with commission snapshot
    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          commissionSnapshot,
          platformCommission: calculated.commissionAmount,
          garageNetAmount: calculated.garageNetAmount,
          earningsId: String(result.insertedId)
        }
      }
    );

    return saved;
  } catch (err) {
    // If unique collision on paymentId occurred simultaneously
    if (err.code === 11000) {
      return await earnings.findOne({ paymentId: paymentIdStr });
    }
    throw err;
  }
}

/**
 * Reconciles garage earnings ledger when a partial or full refund occurs
 * @param {Object} params
 * @param {Object} params.payment - Payment document
 * @param {number} params.refundAmount - Refund amount in rupees
 * @param {Object} [params.dbInstance]
 */
async function reconcileRefundEarnings({ payment, refundAmount, dbInstance }) {
  if (!payment) return null;

  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');

  const paymentIdStr = String(payment._id || payment.paymentId || payment.razorpayPaymentId);
  const earning = await earnings.findOne({
    $or: [
      { paymentId: paymentIdStr },
      { razorpayPaymentId: payment.razorpayPaymentId || paymentIdStr }
    ]
  });

  if (!earning) return null;

  const totalRefundedInRupees = payment.totalRefundedAmount !== undefined
    ? parseFloat(payment.totalRefundedAmount)
    : (parseFloat(earning.refundAmount || 0) + parseFloat(refundAmount || 0));
  const totalRefundedPaise = Math.round(totalRefundedInRupees * 100);

  const rate = earning.commissionRate || 5;
  const refundCommissionPaise = Math.round((totalRefundedPaise * rate) / 100);
  const refundGarageDeductionPaise = totalRefundedPaise - refundCommissionPaise;

  const newNetPaise = Math.max(0, earning.garageNetPaise - refundGarageDeductionPaise);
  const isFullyRefunded = totalRefundedInRupees >= earning.grossAmount;
  const newStatus = isFullyRefunded
    ? EARNINGS_STATUS.CANCELLED
    : EARNINGS_STATUS.REFUND_ADJUSTMENT;

  const now = new Date();

  await earnings.updateOne(
    { _id: earning._id },
    {
      $set: {
        refundAmountPaise: totalRefundedPaise,
        refundAmount: totalRefundedPaise / 100,
        netAfterRefundPaise: newNetPaise,
        netAfterRefund: newNetPaise / 100,
        status: earning.status === EARNINGS_STATUS.SETTLED ? EARNINGS_STATUS.SETTLED : newStatus,
        refundAdjustedAt: now,
        updatedAt: now
      }
    }
  );

  return await earnings.findOne({ _id: earning._id });
}

/**
 * Aggregates verified financial totals for a garage
 * @param {string} garageId 
 * @param {Object} [dbInstance]
 */
async function getGarageEarningsSummary(garageId, dbInstance) {
  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');
  const { resolveGarageIds } = require('../utils/garageResolver');

  const garageIds = await resolveGarageIds(garageId, db);
  const allEarnings = await earnings.find({ garageId: { $in: garageIds } }).toArray();

  let totalGrossRevenue = 0;
  let platformCommissionTotal = 0;
  let netGarageEarnings = 0;
  let availableBalance = 0;
  let pendingSettlement = 0;
  let settledAmount = 0;
  let totalRefundAdjustments = 0;

  allEarnings.forEach(e => {
    const gross = parseFloat(e.grossAmount) || 0;
    const comm = parseFloat(e.platformCommission) || 0;
    const net = parseFloat(e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount) || 0;
    const ref = parseFloat(e.refundAmount) || 0;

    totalGrossRevenue += gross;
    platformCommissionTotal += comm;
    netGarageEarnings += net;
    totalRefundAdjustments += ref;

    if (e.status === EARNINGS_STATUS.AVAILABLE) {
      availableBalance += net;
    } else if (e.status === EARNINGS_STATUS.SETTLEMENT_PENDING || e.status === EARNINGS_STATUS.PENDING_SETTLEMENT) {
      pendingSettlement += net;
    } else if (e.status === EARNINGS_STATUS.SETTLED) {
      settledAmount += net;
    } else if (e.status === EARNINGS_STATUS.REFUND_ADJUSTMENT) {
      // Partial refunds that remain available
      availableBalance += net;
    }
  });

  return {
    totalGrossRevenue,
    platformCommission: platformCommissionTotal,
    netGarageEarnings,
    availableBalance,
    pendingSettlement,
    settledAmount,
    totalRefundAdjustments,
    totalTransactions: allEarnings.length
  };
}

module.exports = {
  calculateCommission,
  recordPaymentEarnings,
  reconcileRefundEarnings,
  getGarageEarningsSummary
};
