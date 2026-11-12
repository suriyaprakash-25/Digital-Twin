/**
 * Payments (read models for admin views). Owned by: admin refactor.
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
}

module.exports = { PaymentRepository, PAYMENT_STATUS_GROUPS };
