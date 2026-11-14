/**
 * Vehicle ownership transfer requests. Owned by: ownership/passport refactor.
 *
 * Status changes go through `transitionStatus`, a compare-and-swap on the current status: the
 * state machine (services/ownership/transferStateMachine.js) decides WHICH transitions are legal,
 * this filter guarantees each one happens at most once under concurrency.
 */
const { BaseRepository } = require('./BaseRepository');
const { withSession } = require('../core/transaction');

// Stored status strings (mirrors TRANSFER_STATUS; repositories do not import the service layer).
const PENDING = 'pending';
const ACCEPTED = 'accepted';
const REJECTED = 'rejected';

class TransferRepository extends BaseRepository {
  constructor(db) {
    super(db, 'transfers');
  }

  findByObjectId(transferObjectId) {
    return this.collection.findOne({ _id: transferObjectId });
  }

  findPendingForVehicle(vehicleId) {
    return this.collection.findOne({ vehicleId: String(vehicleId), status: PENDING });
  }

  listPendingForBuyer(buyerId) {
    return this.find({ buyerId: String(buyerId), status: PENDING }, { sort: { createdAt: -1 } });
  }

  /** Inserts a pending request. The unique partial index rejects a second pending one per vehicle. */
  insertPending(doc) {
    return this.collection.insertOne({ ...doc, status: PENDING });
  }

  /**
   * Compare-and-swap status change.
   * @returns {Promise<boolean>} true only for the single caller that moved the transfer from `from`
   */
  async transitionStatus(transferObjectId, from, to, fields = {}, { session } = {}) {
    const result = await this.collection.updateOne(
      { _id: transferObjectId, status: from },
      { $set: { ...fields, status: to } },
      withSession(session),
    );
    return result.modifiedCount === 1;
  }

  /** Marks the accept unit of work as fully applied (history, records); used for idempotent replays. */
  markFinalized(transferObjectId, at, { session } = {}) {
    return this.collection.updateOne({ _id: transferObjectId, status: ACCEPTED }, { $set: { finalizedAt: at } }, withSession(session));
  }

  /**
   * Compensation for a standalone mongod (no transactions): an acceptance whose vehicle
   * compare-and-swap failed is voided. Never matches a finalised acceptance.
   */
  async voidUnfinalizedAcceptance(transferObjectId, reason, at) {
    const result = await this.collection.updateOne(
      { _id: transferObjectId, status: ACCEPTED, finalizedAt: { $exists: false } },
      { $set: { status: REJECTED, reason, rejectedAt: at }, $unset: { completedAt: '', acceptedAt: '' } },
    );
    return result.modifiedCount === 1;
  }

  /** Legacy data may hold several pending rows per vehicle; once one is accepted the rest close. */
  rejectOtherPending(vehicleId, exceptTransferObjectId, reason, at, { session } = {}) {
    return this.collection.updateMany(
      { vehicleId: String(vehicleId), status: PENDING, _id: { $ne: exceptTransferObjectId } },
      { $set: { status: REJECTED, reason, rejectedAt: at } },
      withSession(session),
    );
  }

  /**
   * Re-points the vehicle's service records to the new owner. Only `ownerId` changes: `createdBy`
   * identifies the garage that wrote (and invoices) the record and must never move to a buyer.
   * Lives here because the write belongs to the transfer use case and BaseRepository has no
   * updateMany; move it to ServiceRecordRepository when that repository gains one.
   */
  repointServiceRecords(vehicleIdValues, buyerId, { session } = {}) {
    return this.db.collection('services').updateMany(
      { vehicleId: { $in: vehicleIdValues } },
      { $set: { ownerId: String(buyerId) } },
      withSession(session),
    );
  }
}

/**
 * At most ONE pending transfer per vehicle (unique partial index), plus the buyer inbox query.
 * Returns problems instead of throwing so legacy duplicate pending rows cannot block startup.
 */
async function ensureTransferIndexes(db) {
  const transfers = db.collection('transfers');
  const problems = [];
  await transfers.createIndex({ buyerId: 1, status: 1, createdAt: -1 }, { name: 'transfers_buyer_status' });
  try {
    await transfers.createIndex(
      { vehicleId: 1 },
      { name: 'transfers_one_pending_per_vehicle', unique: true, partialFilterExpression: { status: PENDING } },
    );
  } catch (err) {
    problems.push(`transfers_one_pending_per_vehicle: ${err.message}`);
  }
  return { problems };
}

module.exports = { TransferRepository, ensureTransferIndexes };
