/**
 * Payment disputes. Owned by: bookings/disputes refactor.
 * Add query methods here instead of calling db.collection('payment_disputes') from routes or services.
 */
const { BaseRepository, toObjectId } = require('./BaseRepository');
const { aggregateKpis } = require('../core/aggregation');
const { ConflictError } = require('../core/errors');
const { DISPUTE_STATUS } = require('../models/Dispute');

/** A payment may have at most one dispute in these states at a time. */
const ACTIVE_DISPUTE_STATUSES = Object.freeze([
  DISPUTE_STATUS.OPEN,
  DISPUTE_STATUS.UNDER_REVIEW,
  DISPUTE_STATUS.WAITING_FOR_GARAGE,
  DISPUTE_STATUS.WAITING_FOR_USER,
]);

const DUPLICATE_KEY = 11000;
const RETURN_UPDATED = Object.freeze({ returnDocument: 'after' });
const NOT_BEING_RESOLVED = Object.freeze({ resolutionInProgress: { $ne: true } });

/**
 * Enforces "one active dispute per payment" in the database, so two concurrent submissions cannot
 * both pass the application-level check. Rows without a string paymentId (legacy/test fixtures)
 * are outside the index.
 */
const DISPUTE_REPOSITORY_INDEXES = Object.freeze([
  [{ paymentId: 1 }, {
    name: 'one_active_dispute_per_payment',
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_DISPUTE_STATUSES }, paymentId: { $type: 'string' } },
  }],
]);

const indexState = new WeakMap();

async function ensureDisputeRepositoryIndexes(db) {
  const collection = db.collection('payment_disputes');
  const problems = [];
  for (const [keys, options] of DISPUTE_REPOSITORY_INDEXES) {
    try {
      await collection.createIndex(keys, options);
    } catch (err) {
      problems.push(`${options.name}: ${err.message}`);
    }
  }
  if (problems.length) {
    console.warn(`⚠️ Dispute index issues (resolve duplicate active disputes per payment, then restart):\n- ${problems.join('\n- ')}`);
  }
  return { problems };
}

class DisputeRepository extends BaseRepository {
  constructor(db) {
    super(db, 'payment_disputes');
  }

  /**
   * Idempotent, once per Db instance. server.js does not register this initialiser yet, so the
   * write path ensures it lazily before the first insert.
   */
  ensureIndexes() {
    if (!indexState.has(this.db)) indexState.set(this.db, ensureDisputeRepositoryIndexes(this.db));
    return indexState.get(this.db);
  }

  /** Lookup by ObjectId or by the human-readable dispute number. */
  findByIdOrNumber(idOrNumber) {
    const _id = toObjectId(idOrNumber);
    return this.findOne(_id ? { _id } : { disputeNumber: String(idOrNumber) });
  }

  findActiveForPayment(paymentId) {
    return this.findOne({ paymentId: String(paymentId), status: { $in: ACTIVE_DISPUTE_STATUSES } });
  }

  /** Inserts a dispute; a concurrent duplicate for the same payment becomes a 409. */
  async create(doc) {
    await this.ensureIndexes();
    try {
      return await this.insertOne(doc);
    } catch (err) {
      if (err && err.code === DUPLICATE_KEY && /one_active_dispute_per_payment/.test(err.message || '')) {
        throw new ConflictError('An active dispute is already open for this payment', 'DISPUTE_ALREADY_OPEN');
      }
      throw err;
    }
  }

  /**
   * Compare-and-swap status change: applies only while the dispute is in one of `fromStatuses`
   * and no administrator is mid-resolution. Resolves to the updated dispute or null.
   */
  transitionFrom(disputeObjectId, fromStatuses, fields) {
    return this.collection.findOneAndUpdate(
      { _id: disputeObjectId, status: { $in: fromStatuses }, ...NOT_BEING_RESOLVED },
      { $set: fields },
      RETURN_UPDATED,
    );
  }

  /** Compare-and-swap claim: exactly one administrator may resolve (and refund) a dispute. */
  claimResolution(dispute, adminId, at = new Date()) {
    return this.collection.findOneAndUpdate(
      { _id: dispute._id, status: dispute.status, ...NOT_BEING_RESOLVED },
      { $set: { resolutionInProgress: true, resolutionClaimedBy: String(adminId), resolutionClaimedAt: at } },
      RETURN_UPDATED,
    );
  }

  releaseResolutionClaim(disputeObjectId) {
    return this.updateOne({ _id: disputeObjectId }, { $unset: { resolutionInProgress: '', resolutionClaimedBy: '', resolutionClaimedAt: '' } });
  }

  /** Writes the outcome only while the caller still holds the resolution claim. */
  finalizeResolution(disputeObjectId, adminId, fields) {
    return this.collection.findOneAndUpdate(
      { _id: disputeObjectId, resolutionInProgress: true, resolutionClaimedBy: String(adminId) },
      { $set: fields, $unset: { resolutionInProgress: '' } },
      RETURN_UPDATED,
    );
  }

  /** Single-$group KPI aggregation (core/aggregation). */
  kpis(accumulators, match) {
    return aggregateKpis(this.collection, accumulators, match);
  }
}

module.exports = { DisputeRepository, ACTIVE_DISPUTE_STATUSES, DISPUTE_REPOSITORY_INDEXES, ensureDisputeRepositoryIndexes };
