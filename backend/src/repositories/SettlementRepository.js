/**
 * Settlements (read models + REQUESTED inserts; status changes go through transitionSettlement).
 * Owned by: invoices/earnings refactor (admin read models kept).
 * Add query methods here instead of calling db.collection('settlements') from routes or services.
 */
const { BaseRepository, toObjectId } = require('./BaseRepository');
const { num, countWhere, sumWhere, inList, aggregateKpis } = require('../core/aggregation');

const SETTLEMENT_STATUS_GROUPS = Object.freeze({
  PENDING: Object.freeze(['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'RETRY_PENDING']),
  // COMPLETED is the legacy alias of SETTLED.
  SETTLED: Object.freeze(['SETTLED', 'COMPLETED']),
});

/** One document per garage while a settlement request is being created (see acquireRequestLock). */
const REQUEST_LOCK_COLLECTION = 'settlement_request_locks';
const DUPLICATE_KEY = 11000;

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

  // ----- Garage-facing settlements (services/earnings) ------------------------------------------

  /** Most recently requested first, for one garage (all of its id aliases). */
  findPageForGarage(garageIds, { status } = {}, page) {
    const filter = { garageId: { $in: garageIds } };
    if (status) filter.status = String(status);
    return this.findPage(filter, page, { sort: { requestedAt: -1, _id: -1 } });
  }

  /** A settlement by _id or by its human-readable settlement number. */
  findByReference(ref) {
    const objectId = toObjectId(ref);
    const clauses = [{ settlementId: String(ref) }];
    if (objectId) clauses.unshift({ _id: objectId });
    return this.findOne({ $or: clauses });
  }

  /**
   * Inserts a new settlement. Only the initial REQUESTED state may be written here; every later
   * status change must go through settlementStateMachine.transitionSettlement.
   */
  insertRequested(doc) {
    if (doc.status !== 'REQUESTED') throw new Error('insertRequested only creates REQUESTED settlements');
    return this.insertOne(doc);
  }

  get requestLocks() {
    return this.db.collection(REQUEST_LOCK_COLLECTION);
  }

  /**
   * Per-garage mutex for settlement requests, enforced by the unique _id of the lock document
   * (a unique constraint, not a read-then-write check). Expired locks are reclaimed first.
   * @returns {Promise<boolean>} true when this caller now holds the lock
   */
  async acquireRequestLock(key, token, { now, ttlMs }) {
    await this.requestLocks.deleteOne({ _id: key, expiresAt: { $lte: now } });
    try {
      await this.requestLocks.insertOne({ _id: key, token, createdAt: now, expiresAt: new Date(now.getTime() + ttlMs) });
      return true;
    } catch (err) {
      if (err && err.code === DUPLICATE_KEY) return false;
      throw err;
    }
  }

  releaseRequestLock(key, token) {
    return this.requestLocks.deleteOne({ _id: key, token });
  }
}

module.exports = { SettlementRepository, SETTLEMENT_STATUS_GROUPS };
