/**
 * Admin console: read-only finance views (payments, commissions, settlements). KPIs are computed
 * by repository aggregations; settlement mutations live in routes/financialOperations.js.
 */
const { safeSearchRegex, asString } = require('../../core/text');
const { PAYMENT_STATUS } = require('../../models/Payment');
const { PAYMENT_STATUS_GROUPS } = require('../../repositories/PaymentRepository');
const { ALL_STATUSES, FALLBACK_LABELS } = require('./adminConstants');
const { toObjectIdOrNull, anyFieldMatches, pendingInvoicesPipeline } = require('./adminQueries');
const { toPaymentListItem, toCommissionListItem, toSettlementListItem } = require('./adminPresenters');

const PAYMENT_SEARCH_FIELDS = Object.freeze(['invoiceNumber', 'razorpayPaymentId', 'razorpayOrderId', 'garageName', 'vehicleNumber', 'serviceType']);
const COMMISSION_SEARCH_FIELDS = Object.freeze(['invoiceNumber', 'garageName', 'vehicleNumber', 'serviceType', 'paymentId']);
const SETTLEMENT_SEARCH_FIELDS = Object.freeze(['settlementId', 'garageId', 'destinationAccountId']);

/** UI status filter values on the payments page that map to one or more stored statuses. */
const PAYMENT_STATUS_FILTERS = Object.freeze({
  PAID: PAYMENT_STATUS.CAPTURED,
  FAILED: PAYMENT_STATUS.FAILED,
  REFUNDED: { $in: [...PAYMENT_STATUS_GROUPS.REFUNDED] },
  PENDING: { $in: [...PAYMENT_STATUS_GROUPS.PENDING] },
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/** `{ status }` clause for a status query value; empty for missing or ALL. */
function statusClause(rawStatus, aliases = {}) {
  const status = asString(rawStatus);
  if (!status || status === ALL_STATUSES) return {};
  return { status: hasOwn(aliases, status) ? aliases[status] : status };
}

function listFilter({ status, search }, searchFields, statusAliases) {
  return { ...statusClause(status, statusAliases), ...anyFieldMatches(searchFields, safeSearchRegex(search)) };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * @param {{ payments: object, earnings: object, settlements: object, garages: object, serviceRecords: object }} repos
 * @param {{ now?: () => Date }} [options] injectable clock (commission "today"/"this month" windows)
 */
function createAdminFinanceService({ payments, earnings, settlements, garages, serviceRecords }, { now = () => new Date() } = {}) {
  /** Display name per garage id for the settlements on one page (ids may be ObjectId or string). */
  async function garageNamesFor(rows) {
    const ids = [...new Set(rows.map((row) => row.garageId).filter((id) => id !== undefined && id !== null))];
    if (ids.length === 0) return {};
    const objectIds = ids.map(toObjectIdOrNull).filter(Boolean);
    const docs = await garages.find(
      { $or: [{ _id: { $in: objectIds } }, { _id: { $in: ids } }] },
      { projection: { name: 1, garageName: 1 } }
    );
    return Object.fromEntries(docs.map((g) => [String(g._id), g.name || g.garageName || FALLBACK_LABELS.SETTLEMENT_GARAGE]));
  }

  return {
    async getPaymentSummary() {
      const [kpis, [pending = {}]] = await Promise.all([
        payments.getAdminKpis(),
        serviceRecords.aggregate(pendingInvoicesPipeline()),
      ]);
      return {
        totalVolume: kpis.totalVolume,
        successfulVolume: kpis.successfulVolume,
        successfulCount: kpis.successfulCount,
        failedCount: kpis.failedCount,
        totalRefundedAmount: kpis.totalRefundedAmount,
        refundedCount: kpis.refundedCount,
        pendingAmount: pending.pendingAmount || 0,
        pendingCount: pending.pendingCount || 0,
        totalTransactions: kpis.totalTransactions,
      };
    },

    async listPayments({ search, status, page }) {
      const filter = listFilter({ search, status }, PAYMENT_SEARCH_FIELDS, PAYMENT_STATUS_FILTERS);
      const result = await payments.findPageForAdmin(filter, page);
      return { ...result, items: result.items.map(toPaymentListItem) };
    },

    async getCommissionSummary() {
      const current = now();
      const kpis = await earnings.getCommissionKpis({ todayStart: startOfDay(current), monthStart: startOfMonth(current) });
      return {
        totalGrossVolume: kpis.totalGrossVolume,
        totalPlatformCommission: kpis.totalPlatformCommission,
        todayPlatformCommission: kpis.todayPlatformCommission,
        monthPlatformCommission: kpis.monthPlatformCommission,
        totalGarageEarnings: kpis.totalGarageEarnings,
        totalRefundAdjustments: kpis.totalRefundAdjustments,
        netPlatformRevenue: Math.max(0, kpis.totalPlatformCommission),
        totalEarningRecords: kpis.totalEarningRecords,
      };
    },

    async listCommissions({ search, status, page }) {
      const filter = listFilter({ search, status }, COMMISSION_SEARCH_FIELDS);
      const result = await earnings.findPageForAdmin(filter, page);
      return { ...result, items: result.items.map(toCommissionListItem) };
    },

    async listSettlements({ search, status, page }) {
      const filter = listFilter({ search, status }, SETTLEMENT_SEARCH_FIELDS);
      const [result, kpis] = await Promise.all([settlements.findPageForAdmin(filter, page), settlements.getAdminKpis()]);
      const garageNames = await garageNamesFor(result.items);
      return {
        ...result,
        items: result.items.map((row) => toSettlementListItem(row, garageNames)),
        summary: {
          totalPendingVolume: kpis.totalPendingVolume,
          totalSettledVolume: kpis.totalSettledVolume,
          pendingCount: kpis.pendingCount,
          completedCount: kpis.completedCount,
          totalRequests: kpis.totalRequests,
        },
      };
    },
  };
}

module.exports = { createAdminFinanceService, PAYMENT_STATUS_FILTERS, statusClause };
