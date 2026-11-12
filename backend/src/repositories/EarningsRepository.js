/**
 * Garage earnings ledger (read models). Owned by: admin refactor.
 * Add query methods here instead of calling db.collection('garage_earnings') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');
const { num, sumWhere, aggregateKpis } = require('../core/aggregation');

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
}

module.exports = { EarningsRepository };
