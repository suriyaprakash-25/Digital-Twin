/**
 * Payments (read models for admin and garage revenue views). Owned by: invoices/earnings refactor.
 * Add query methods here instead of calling db.collection('payments') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');
const { PAYMENT_STATUS } = require('../models/Payment');
const { num, countWhere, sumWhere, inList, equals, aggregateKpis } = require('../core/aggregation');

const PAYMENT_STATUS_GROUPS = Object.freeze({
  // 'PAID' is a legacy status written by early pilot builds; it counts as a successful capture.
  SUCCESSFUL: Object.freeze([PAYMENT_STATUS.CAPTURED, 'PAID', PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED]),
  REFUNDED: Object.freeze([PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED]),
  PENDING: Object.freeze([PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING]),
});

class PaymentRepository extends BaseRepository {
  constructor(db) {
    super(db, 'payments');
  }

  /** Platform-wide payment KPIs, computed in one `$group` inside MongoDB. */
  async getAdminKpis() {
    const isSuccessful = inList('$status', PAYMENT_STATUS_GROUPS.SUCCESSFUL);
    const kpis = await aggregateKpis(this.collection, {
      totalVolume: { $sum: num('$amount') },
      successfulVolume: sumWhere(isSuccessful, '$amount'),
      successfulCount: countWhere(isSuccessful),
      failedCount: countWhere(equals('$status', PAYMENT_STATUS.FAILED)),
      refundedCount: countWhere(inList('$status', PAYMENT_STATUS_GROUPS.REFUNDED)),
      totalRefundedAmount: { $sum: num('$totalRefundedAmount') },
    });
    return { ...kpis, totalTransactions: kpis.total };
  }

  /** Newest-first page of payments matching `filter`. */
  findPageForAdmin(filter, page) {
    return this.findPage(filter, page, { sort: { createdAt: -1 } });
  }

  // ----- Garage revenue read models (services/invoices) -----------------------------------------

  /** Newest-first page of payments belonging to a garage scope (see garageScopeFilter). */
  findPageForGarage(scope, page) {
    return this.findPage(garageScopeFilter(scope), page, { sort: { createdAt: -1, _id: -1 } });
  }

  /**
   * Revenue KPIs for a garage in one `$group`, every amount summed as integer paise.
   * Revenue counts CAPTURED payments only; refunds sum `totalRefundedAmount` of refunded rows.
   */
  async getGarageRevenueKpis(scope, { todayStart, monthStart }) {
    const isCaptured = equals('$status', PAYMENT_STATUS.CAPTURED);
    const paidAt = { $convert: { input: '$paidAt', to: 'date', onError: null, onNull: null } };
    const capturedSince = (start) => ({ $and: [isCaptured, { $ne: [paidAt, null] }, { $gte: [paidAt, start] }] });
    const isRefunded = { $or: [inList('$status', PAYMENT_STATUS_GROUPS.REFUNDED), { $gt: [num('$totalRefundedAmount'), 0] }] };
    return aggregateKpis(this.collection, {
      revenuePaise: paiseWhere(isCaptured, '$amount'),
      capturedCount: countWhere(isCaptured),
      todayPaise: paiseWhere(capturedSince(todayStart), '$amount'),
      monthPaise: paiseWhere(capturedSince(monthStart), '$amount'),
      refundedPaise: paiseWhere(isRefunded, '$totalRefundedAmount'),
      failedCount: countWhere(equals('$status', PAYMENT_STATUS.FAILED)),
    }, garageScopeFilter(scope));
  }

  /** Captured/refunded payments since `since`, grouped by day (YYYY-MM-DD in `timezone`), amounts in paise. */
  dailyTrendForGarage(scope, since, timezone = 'UTC') {
    return this.aggregate([
      {
        $match: {
          ...garageScopeFilter(scope),
          status: { $in: [PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED] },
          paidAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone } },
          revenuePaise: { $sum: paiseOf('$amount') },
          refundsPaise: { $sum: paiseOf('$totalRefundedAmount') },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  /** The payment behind a service's receipt; only clauses with a real value are used. */
  findForReceipt(service) {
    const id = String(service._id);
    const clauses = [{ serviceId: id }, { invoiceId: id }];
    if (service.paymentId) {
      clauses.push({ razorpayPaymentId: service.paymentId }, { cashfreePaymentId: service.paymentId });
    }
    return this.findOne({ $or: clauses }, { sort: { paidAt: -1, createdAt: -1 } });
  }
}

/** Integer paise of a rupee field (legacy rows may hold strings/null). */
function paiseOf(field) {
  return { $round: [{ $multiply: [num(field), 100] }, 0] };
}

function paiseWhere(condition, field) {
  return { $sum: { $cond: [condition, paiseOf(field), 0] } };
}

/** Payments of a garage: linked to one of its services, or stamped with one of its ids. */
function garageScopeFilter({ serviceIds = [], garageIds = [] }) {
  return { $or: [{ serviceId: { $in: serviceIds } }, { garageId: { $in: garageIds } }] };
}

module.exports = { PaymentRepository, PAYMENT_STATUS_GROUPS, paiseOf, garageScopeFilter };
