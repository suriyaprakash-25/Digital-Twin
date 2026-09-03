const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { generateStatementNumber } = require('../utils/statementNumber');

function parseDateRange(period = '30_DAYS', customFrom, customTo) {
  const now = new Date();
  let from = new Date(0);
  let to = now;

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (String(period).toUpperCase()) {
    case 'TODAY':
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    case '7_DAYS':
      from = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      break;
    case '30_DAYS':
      from = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      break;
    case 'THIS_MONTH':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
    case 'LAST_MONTH':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'THIS_YEAR':
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
    case 'CUSTOM':
      if (customFrom) from = new Date(customFrom);
      if (customTo) to = endOfDay(new Date(customTo));
      break;
    default:
      from = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  }

  return { from, to };
}

/**
 * Returns financial metrics summary for a specific garage in integer paise precision
 */
async function getGarageFinancialSummary(garageId, { period = '30_DAYS', dateFrom, dateTo, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');
  const services = db.collection('services');
  const settlements = db.collection('settlements');
  const { resolveGarageIds } = require('../utils/garageResolver');

  const { from, to } = parseDateRange(period, dateFrom, dateTo);
  const garageIds = await resolveGarageIds(garageId, db);

  const earningsQuery = {
    garageId: { $in: garageIds },
    createdAt: { $gte: from, $lte: to }
  };

  const earningDocs = await earnings.find(earningsQuery).toArray();

  let grossPaise = 0;
  let commissionPaise = 0;
  let netPaise = 0;
  let refundPaise = 0;
  let refundCount = 0;

  earningDocs.forEach(e => {
    grossPaise += e.grossPaise || Math.round((parseFloat(e.grossAmount) || 0) * 100);
    commissionPaise += e.platformCommissionPaise || Math.round((parseFloat(e.platformCommission) || 0) * 100);
    netPaise += e.netAfterRefundPaise !== undefined ? e.netAfterRefundPaise : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));

    if (e.refundAmount || e.refundAmountPaise) {
      refundPaise += e.refundAmountPaise || Math.round((parseFloat(e.refundAmount) || 0) * 100);
      refundCount++;
    }
  });

  // Settled and Pending balances (all time and period)
  const allEarnings = await earnings.find({ garageId: String(garageId) }).toArray();
  let availableBalancePaise = 0;
  let pendingSettlementPaise = 0;
  let totalSettledPaise = 0;

  allEarnings.forEach(e => {
    const net = e.netAfterRefundPaise !== undefined ? e.netAfterRefundPaise : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
    if (e.status === 'AVAILABLE' || e.status === 'REFUND_ADJUSTMENT') {
      availableBalancePaise += net;
    } else if (e.status === 'SETTLEMENT_PENDING') {
      pendingSettlementPaise += net;
    } else if (e.status === 'SETTLED') {
      totalSettledPaise += net;
    }
  });

  // Invoice counts & unpaid totals
  const allServices = await services.find({ garageId: String(garageId) }).toArray();
  let paidInvoiceCount = 0;
  let unpaidInvoiceCount = 0;
  let unpaidInvoicePaise = 0;

  allServices.forEach(s => {
    if (s.invoiceStatus === 'PAID' || s.paymentStatus === 'CAPTURED' || s.paymentStatus === 'PAID') {
      paidInvoiceCount++;
    } else if (s.invoiceStatus === 'ISSUED' || s.invoiceStatus === 'FINALIZED') {
      unpaidInvoiceCount++;
      const amt = s.invoice?.totalAmount || s.finalCost || s.estimatedCost || 0;
      unpaidInvoicePaise += Math.round(parseFloat(amt) * 100);
    }
  });

  return {
    period,
    dateFrom: from,
    dateTo: to,
    grossRevenue: grossPaise / 100,
    platformCommission: commissionPaise / 100,
    garageNetRevenue: netPaise / 100,
    refundAmount: refundPaise / 100,
    availableBalance: availableBalancePaise / 100,
    settledAmount: totalSettledPaise / 100,
    pendingSettlementAmount: pendingSettlementPaise / 100,
    unpaidInvoiceAmount: unpaidInvoicePaise / 100,
    paidInvoiceCount,
    unpaidInvoiceCount,
    refundCount
  };
}

/**
 * Returns paginated transaction report for a garage
 */
async function getGarageTransactionsReport(garageId, { page = 1, limit = 20, search = '', dateFrom, dateTo, period = 'ALL', dbInstance } = {}) {
  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const query = { garageId: String(garageId) };

  if (period !== 'ALL') {
    const { from, to } = parseDateRange(period, dateFrom, dateTo);
    query.createdAt = { $gte: from, $lte: to };
  } else if (dateFrom || dateTo) {
    const { from, to } = parseDateRange('CUSTOM', dateFrom, dateTo);
    query.createdAt = { $gte: from, $lte: to };
  }

  if (search && search.trim() !== '') {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [
      { invoiceNumber: regex },
      { paymentId: regex },
      { razorpayPaymentId: regex },
      { vehicleNumber: regex },
      { serviceType: regex }
    ];
  }

  const totalCount = await earnings.countDocuments(query);
  const rawList = await earnings
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .toArray();

  const formatted = rawList.map(e => ({
    id: String(e._id),
    invoiceNumber: e.invoiceNumber,
    paymentId: e.paymentId,
    razorpayPaymentId: e.razorpayPaymentId,
    vehicleNumber: e.vehicleNumber,
    serviceType: e.serviceType,
    grossAmount: e.grossAmount,
    platformCommission: e.platformCommission,
    garageNetAmount: e.garageNetAmount,
    refundAmount: e.refundAmount || 0,
    finalNetAmount: e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount,
    status: e.status,
    date: e.createdAt
  }));

  return {
    transactions: formatted,
    totalCount,
    totalPages: Math.ceil(totalCount / limitNum),
    currentPage: pageNum
  };
}

/**
 * Generates an authoritative statement for a garage
 */
async function getGarageStatement(garageId, { period = '30_DAYS', dateFrom, dateTo, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const garages = db.collection('garages');
  const settlements = db.collection('settlements');

  const gId = ObjectId.isValid(garageId) ? new ObjectId(String(garageId)) : null;
  const garageDoc = gId ? await garages.findOne({ _id: gId }) : await garages.findOne({ _id: String(garageId) });

  const summary = await getGarageFinancialSummary(garageId, { period, dateFrom, dateTo, dbInstance: db });
  const txData = await getGarageTransactionsReport(garageId, { page: 1, limit: 100, period, dateFrom, dateTo, dbInstance: db });

  const settlementDocs = await settlements
    .find({
      garageId: String(garageId),
      requestedAt: { $gte: summary.dateFrom, $lte: summary.dateTo }
    })
    .sort({ requestedAt: -1 })
    .toArray();

  const statementNumber = await generateStatementNumber(db);

  return {
    statementId: statementNumber,
    garage: {
      id: String(garageId),
      name: garageDoc?.name || 'Authorized Service Partner',
      address: garageDoc?.address || 'N/A',
      phone: garageDoc?.phone || 'N/A',
      email: garageDoc?.email || 'N/A'
    },
    period: summary.period,
    dateFrom: summary.dateFrom,
    dateTo: summary.dateTo,
    generatedAt: new Date(),
    summary,
    transactions: txData.transactions,
    settlements: settlementDocs.map(s => ({
      settlementId: s.settlementId,
      requestedAmount: s.requestedAmount,
      approvedAmount: s.approvedAmount,
      status: s.status,
      requestedAt: s.requestedAt,
      completedAt: s.completedAt
    }))
  };
}

/**
 * Returns platform-wide financial summary and chart trend datasets for administrators
 */
async function getAdminPlatformFinancialSummary({ period = '30_DAYS', dateFrom, dateTo, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');
  const payments = db.collection('payments');
  const settlements = db.collection('settlements');
  const disputes = db.collection('payment_disputes');

  const { from, to } = parseDateRange(period, dateFrom, dateTo);

  const earningDocs = await earnings.find({ createdAt: { $gte: from, $lte: to } }).toArray();

  let totalGmvaise = 0;
  let totalCommissionPaise = 0;
  let totalGarageNetPaise = 0;
  let totalRefundPaise = 0;

  earningDocs.forEach(e => {
    totalGmvaise += e.grossPaise || Math.round((parseFloat(e.grossAmount) || 0) * 100);
    totalCommissionPaise += e.platformCommissionPaise || Math.round((parseFloat(e.platformCommission) || 0) * 100);
    totalGarageNetPaise += e.netAfterRefundPaise !== undefined ? e.netAfterRefundPaise : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
    if (e.refundAmount || e.refundAmountPaise) {
      totalRefundPaise += e.refundAmountPaise || Math.round((parseFloat(e.refundAmount) || 0) * 100);
    }
  });

  // Settlements
  const settlementDocs = await settlements.find({ createdAt: { $gte: from, $lte: to } }).toArray();
  let totalSettledPaise = 0;
  let pendingSettlementPaise = 0;

  settlementDocs.forEach(s => {
    const amt = Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100);
    if (s.status === 'COMPLETED') totalSettledPaise += amt;
    else if (s.status === 'REQUESTED' || s.status === 'APPROVED' || s.status === 'UNDER_REVIEW') pendingSettlementPaise += amt;
  });

  // Disputes
  const disputeDocs = await disputes.find({ createdAt: { $gte: from, $lte: to } }).toArray();
  let totalDisputedPaise = 0;
  let resolvedDisputesCount = 0;

  disputeDocs.forEach(d => {
    totalDisputedPaise += d.disputedAmountPaise || Math.round((parseFloat(d.disputedAmount) || 0) * 100);
    if (d.status === 'RESOLVED') resolvedDisputesCount++;
  });

  // Daily Trend aggregation
  const dailyMap = {};
  earningDocs.forEach(e => {
    const dateKey = new Date(e.createdAt).toISOString().split('T')[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { date: dateKey, gmv: 0, commission: 0, net: 0, refunds: 0 };
    }
    dailyMap[dateKey].gmv += (e.grossPaise || Math.round(e.grossAmount * 100)) / 100;
    dailyMap[dateKey].commission += (e.platformCommissionPaise || Math.round(e.platformCommission * 100)) / 100;
    dailyMap[dateKey].net += (e.netAfterRefundPaise || Math.round(e.garageNetAmount * 100)) / 100;
    if (e.refundAmount) dailyMap[dateKey].refunds += parseFloat(e.refundAmount);
  });

  const trendData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    period,
    dateFrom: from,
    dateTo: to,
    totalGMV: totalGmvaise / 100,
    platformCommission: totalCommissionPaise / 100,
    garageNetEarnings: totalGarageNetPaise / 100,
    totalRefunds: totalRefundPaise / 100,
    totalSettlements: totalSettledPaise / 100,
    pendingSettlements: pendingSettlementPaise / 100,
    totalDisputedAmount: totalDisputedPaise / 100,
    totalDisputesCount: disputeDocs.length,
    resolvedDisputesCount,
    trendData
  };
}

module.exports = {
  parseDateRange,
  getGarageFinancialSummary,
  getGarageTransactionsReport,
  getGarageStatement,
  getAdminPlatformFinancialSummary
};
