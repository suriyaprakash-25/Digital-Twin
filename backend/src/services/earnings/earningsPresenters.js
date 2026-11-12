/**
 * Pure response mappers for the garage earnings, settlement and payout-profile endpoints. They keep
 * the JSON shapes GarageEarnings, GarageSettlements and GarageFinancialCenter already consume.
 */
const { fromPaise } = require('../../utils/money');
const { SETTLEMENT_REQUEST } = require('./constants');

const netAfterRefundOf = (e) => (e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount);

/** GET /earnings/summary body.summary (paise KPIs converted once, here). */
function toEarningsSummary(k) {
  return {
    totalGrossRevenue: fromPaise(k.grossPaise),
    platformCommission: fromPaise(k.commissionPaise),
    netGarageEarnings: fromPaise(k.netPaise),
    availableBalance: fromPaise(k.availablePaise),
    pendingSettlement: fromPaise(k.pendingPaise),
    settledAmount: fromPaise(k.settledPaise),
    totalRefundAdjustments: fromPaise(k.refundPaise),
    totalTransactions: k.total,
  };
}

function toEarningRow(e) {
  return {
    id: String(e._id),
    invoiceId: e.invoiceId,
    invoiceNumber: e.invoiceNumber,
    serviceId: e.serviceId,
    serviceType: e.serviceType,
    vehicleNumber: e.vehicleNumber,
    paymentId: e.paymentId,
    razorpayPaymentId: e.razorpayPaymentId,
    grossAmount: e.grossAmount,
    platformCommission: e.platformCommission,
    garageNetAmount: e.garageNetAmount,
    refundAmount: e.refundAmount || 0,
    netAfterRefund: netAfterRefundOf(e),
    commissionRate: e.commissionRate,
    commissionType: e.commissionType,
    status: e.status,
    settlementId: e.settlementId,
    date: e.createdAt,
  };
}

function toSettlementRow(s) {
  return {
    id: String(s._id),
    settlementId: s.settlementId,
    requestedAmount: s.requestedAmount,
    approvedAmount: s.approvedAmount || s.requestedAmount,
    currency: s.currency || SETTLEMENT_REQUEST.CURRENCY,
    status: s.status,
    earningsCount: (s.earningsIds && s.earningsIds.length) || 0,
    requestedAt: s.requestedAt,
    approvedAt: s.approvedAt,
    completedAt: s.completedAt,
    failureReason: s.failureReason,
    transferId: s.transferId,
  };
}

function toIncludedEarning(e) {
  return {
    id: String(e._id),
    invoiceNumber: e.invoiceNumber,
    vehicleNumber: e.vehicleNumber,
    serviceType: e.serviceType,
    grossAmount: e.grossAmount,
    platformCommission: e.platformCommission,
    garageNetAmount: e.garageNetAmount,
    netAfterRefund: netAfterRefundOf(e),
    status: e.status,
  };
}

function toSettlementDetail(settlement, includedEarnings) {
  return { id: String(settlement._id), ...settlement, includedEarnings: includedEarnings.map(toIncludedEarning) };
}

/** Masked payout profile; full account numbers are never stored, so never returned. */
function toPayoutProfile(profile) {
  if (!profile) return null;
  return {
    accountHolderName: profile.accountHolderName,
    bankAccountLast4: profile.bankAccountLast4,
    bankName: profile.bankName,
    ifscMasked: profile.ifscMasked,
    verified: Boolean(profile.verified),
  };
}

/** Paged list body shared by earnings and settlements. */
function toPagedBody(key, items, total, page) {
  return { success: true, [key]: items, totalCount: total, totalPages: Math.ceil(total / page.limit), currentPage: page.page };
}

module.exports = { toEarningsSummary, toEarningRow, toSettlementRow, toSettlementDetail, toPayoutProfile, toPagedBody };
