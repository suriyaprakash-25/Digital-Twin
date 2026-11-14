/**
 * Garage earnings ledger. Owned by: invoices/earnings refactor (admin read models kept).
 * Add query methods here instead of calling db.collection('garage_earnings') from routes or services.
 */
const { BaseRepository, toObjectId } = require('./BaseRepository');
const { num, sumWhere, inList, equals, aggregateKpis } = require('../core/aggregation');
const { EARNINGS_STATUS } = require('../models/Earnings');
const { paiseOf } = require('./PaymentRepository');

/** Statuses whose net amount is withdrawable (refund adjustments remain available). */
const AVAILABLE_EARNINGS_STATUSES = Object.freeze([EARNINGS_STATUS.AVAILABLE, EARNINGS_STATUS.REFUND_ADJUSTMENT]);
const PENDING_EARNINGS_STATUSES = Object.freeze([EARNINGS_STATUS.SETTLEMENT_PENDING, EARNINGS_STATUS.PENDING_SETTLEMENT]);

/**
 * Net (after refund) of an earning in integer paise, preferring stored paise fields. Mirrors the
 * JS helper services/earnings/settlementSelection.earningNetPaise.
 */
const isSet = (field) => ({ $gt: [field, null] }); // false for missing and null
const NET_PAISE = {
  $cond: [isSet('$netAfterRefundPaise'), { $round: [num('$netAfterRefundPaise'), 0] },
    { $cond: [isSet('$netAfterRefund'), paiseOf('$netAfterRefund'),
      { $cond: [isSet('$garageNetPaise'), { $round: [num('$garageNetPaise'), 0] }, paiseOf('$garageNetAmount')] }] }],
};

class EarningsRepository extends BaseRepository {
  constructor(db) {
    super(db, 'garage_earnings');
  }

  /**
   * Commission KPIs over the whole ledger, plus commission earned since `todayStart` and
   * `monthStart`. One `$group` inside MongoDB; the ledger is never loaded into memory.
   */
  async getCommissionKpis({ todayStart, monthStart }) {
    const kpis = await aggregateKpis(this.collection, {
      totalGrossVolume: { $sum: num('$grossAmount') },
      totalPlatformCommission: { $sum: num('$platformCommission') },
      totalGarageEarnings: { $sum: num({ $ifNull: ['$netAfterRefund', '$garageNetAmount'] }) },
      totalRefundAdjustments: { $sum: num('$refundAmount') },
      todayPlatformCommission: sumWhere({ $gte: ['$createdAt', todayStart] }, '$platformCommission'),
      monthPlatformCommission: sumWhere({ $gte: ['$createdAt', monthStart] }, '$platformCommission'),
    });
    return { ...kpis, totalEarningRecords: kpis.total };
  }

  /** Newest-first page of earnings records matching `filter`. */
  findPageForAdmin(filter, page) {
    return this.findPage(filter, page, { sort: { createdAt: -1 } });
  }

  // ----- Garage-facing ledger (services/earnings) -----------------------------------------------

  /** Ledger totals for one garage (all of its id aliases), summed in integer paise. */
  getGarageSummaryKpis(garageIds) {
    const status = '$status';
    const sumPaiseWhere = (condition, expr) => ({ $sum: { $cond: [condition, expr, 0] } });
    return aggregateKpis(this.collection, {
      grossPaise: { $sum: paiseOf('$grossAmount') },
      commissionPaise: { $sum: paiseOf('$platformCommission') },
      netPaise: { $sum: NET_PAISE },
      refundPaise: { $sum: paiseOf('$refundAmount') },
      availablePaise: sumPaiseWhere(inList(status, AVAILABLE_EARNINGS_STATUSES), NET_PAISE),
      pendingPaise: sumPaiseWhere(inList(status, PENDING_EARNINGS_STATUSES), NET_PAISE),
      settledPaise: sumPaiseWhere(equals(status, EARNINGS_STATUS.SETTLED), NET_PAISE),
    }, { garageId: { $in: garageIds } });
  }

  /** Newest-first page of a garage's earnings, optionally by status and an escaped search regex. */
  findPageForGarage(garageIds, { status, searchRegex }, page) {
    const filter = { garageId: { $in: garageIds } };
    if (status === 'AVAILABLE') filter.status = { $in: AVAILABLE_EARNINGS_STATUSES };
    else if (status) filter.status = String(status);
    if (searchRegex) {
      filter.$or = [{ invoiceNumber: searchRegex }, { vehicleNumber: searchRegex }, { serviceType: searchRegex }, { paymentId: searchRegex }];
    }
    return this.findPage(filter, page, { sort: { createdAt: -1, _id: -1 } });
  }

  /** An earning by its _id or by the payment it was recorded for. */
  findByReference(ref) {
    const objectId = toObjectId(ref);
    const clauses = [{ paymentId: String(ref) }];
    if (objectId) clauses.unshift({ _id: objectId });
    return this.findOne({ $or: clauses });
  }

  /** Earnings by id (settlement detail); ids are bounded by the settlement's own list. */
  findByIds(ids) {
    const objectIds = (ids || []).map(toObjectId).filter(Boolean);
    if (!objectIds.length) return Promise.resolve([]);
    return this.find({ _id: { $in: objectIds } });
  }

  /** Withdrawable earnings of a garage, oldest first (FIFO payout order). */
  findAvailableForGarage(garageIds) {
    return this.find(
      { garageId: { $in: garageIds }, status: { $in: AVAILABLE_EARNINGS_STATUSES } },
      { sort: { createdAt: 1, _id: 1 }, projection: { status: 1, netAfterRefundPaise: 1, netAfterRefund: 1, garageNetPaise: 1, garageNetAmount: 1, createdAt: 1 } },
    );
  }

  /**
   * Compare-and-swap lock of earnings into a settlement: only rows that are still available move.
   * @returns {Promise<number>} how many rows this call locked
   */
  async claimForSettlement(objectIds, settlementId, now) {
    if (!objectIds.length) return 0;
    const result = await this.collection.updateMany(
      { _id: { $in: objectIds }, status: { $in: AVAILABLE_EARNINGS_STATUSES } },
      { $set: { status: EARNINGS_STATUS.SETTLEMENT_PENDING, settlementId, updatedAt: now } },
    );
    return result.modifiedCount;
  }

  /** Undoes claimForSettlement for `docs` (restoring each row's previous status). */
  async releaseSettlementClaim(settlementId, docs, now) {
    const byStatus = new Map();
    docs.forEach((d) => byStatus.set(d.status, [...(byStatus.get(d.status) || []), d._id]));
    await Promise.all([...byStatus.entries()].map(([status, ids]) => this.collection.updateMany(
      { _id: { $in: ids }, settlementId, status: EARNINGS_STATUS.SETTLEMENT_PENDING },
      { $set: { status, settlementId: null, updatedAt: now } },
    )));
  }
}

module.exports = { EarningsRepository, AVAILABLE_EARNINGS_STATUSES, NET_PAISE };
