/**
 * Settlements (read models; status changes go through transitionSettlement). Owned by: admin refactor.
 * Add query methods here instead of calling db.collection('settlements') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');
const { num, countWhere, sumWhere, inList, aggregateKpis } = require('../core/aggregation');

const SETTLEMENT_STATUS_GROUPS = Object.freeze({
  PENDING: Object.freeze(['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'RETRY_PENDING']),
  // COMPLETED is the legacy alias of SETTLED.
  SETTLED: Object.freeze(['SETTLED', 'COMPLETED']),
});

/** Payout value of a settlement: the approved amount, falling back to the requested amount. */
const PAYOUT_AMOUNT = { $ifNull: ['$approvedAmount', '$requestedAmount'] };

class SettlementRepository extends BaseRepository {
  constructor(db) {
    super(db, 'settlements');
  }

  /** Pending/settled counts and volumes over all settlements, computed in MongoDB. */
  async getAdminKpis() {
    const isPending = inList('$status', SETTLEMENT_STATUS_GROUPS.PENDING);
    const isSettled = inList('$status', SETTLEMENT_STATUS_GROUPS.SETTLED);
    const kpis = await aggregateKpis(this.collection, {
      pendingCount: countWhere(isPending),
      completedCount: countWhere(isSettled),
      totalPendingVolume: sumWhere(isPending, PAYOUT_AMOUNT),
      totalSettledVolume: sumWhere(isSettled, PAYOUT_AMOUNT),
    });
    return { ...kpis, totalRequests: kpis.total };
  }

  /** Most recently requested first. */
  findPageForAdmin(filter, page) {
    return this.findPage(filter, page, { sort: { requestedAt: -1 } });
  }
}

module.exports = { SettlementRepository, SETTLEMENT_STATUS_GROUPS };
