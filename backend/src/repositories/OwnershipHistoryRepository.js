/**
 * Vehicle ownership history entries. Owned by: ownership/passport refactor.
 * Add query methods here instead of calling db.collection('ownershipHistory') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');
const { withSession } = require('../core/transaction');

const MONGO_DUPLICATE_KEY = 11000;

class OwnershipHistoryRepository extends BaseRepository {
  constructor(db) {
    super(db, 'ownershipHistory');
  }

  /** Timeline for a vehicle (all stored id spellings), oldest first. */
  listForVehicle(vehicleIdValues) {
    const ids = [...new Set(vehicleIdValues.map(String))];
    return this.find({ vehicleId: { $in: ids } }, { sort: { fromDate: 1 } });
  }

  /** Ends the owner's open period. Idempotent: an already-closed entry is left untouched. */
  closeOpenEntry(vehicleId, ownerId, toDate, { session } = {}) {
    return this.collection.updateMany(
      { vehicleId: String(vehicleId), ownerId: String(ownerId), toDate: null },
      { $set: { toDate } },
      withSession(session),
    );
  }

  /**
   * Inserts an entry with a caller-chosen deterministic `_id` (the transfer id), so re-running the
   * accept unit of work, or two concurrent runs, can never create a second open period.
   * @returns {Promise<boolean>} true when inserted, false when it already existed
   */
  async insertOnce(entry, { session } = {}) {
    try {
      await this.collection.insertOne(entry, withSession(session));
      return true;
    } catch (err) {
      if (err && err.code === MONGO_DUPLICATE_KEY) return false;
      throw err;
    }
  }
}

async function ensureOwnershipHistoryIndexes(db) {
  await db.collection('ownershipHistory').createIndex({ vehicleId: 1, fromDate: 1 }, { name: 'ownership_history_vehicle' });
}

module.exports = { OwnershipHistoryRepository, ensureOwnershipHistoryIndexes };
