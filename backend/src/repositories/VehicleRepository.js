/**
 * Vehicles. Owned by: services refactor.
 * Add query methods here instead of calling db.collection('vehicles') from routes or services.
 */
const { BaseRepository, idFilter } = require('./BaseRepository');
const { withSession } = require('../core/transaction');

class VehicleRepository extends BaseRepository {
  constructor(db) {
    super(db, 'vehicles');
  }

  /** A vehicle that has not been archived, by any legacy id shape. */
  findActiveById(id) {
    if (id === undefined || id === null || id === '') return Promise.resolve(null);
    return this.collection.findOne({ ...idFilter(id), isArchived: { $ne: true } });
  }

  /**
   * Monotonic odometer update: only ever raises the stored reading, atomically, so two concurrent
   * service records can never move it backwards.
   */
  raiseOdometer(vehicleObjectId, km, { session } = {}) {
    return this.collection.updateOne(
      { _id: vehicleObjectId, $or: [{ currentOdometerKm: { $lt: km } }, { currentOdometerKm: { $exists: false } }, { currentOdometerKm: null }] },
      { $set: { currentOdometerKm: km } },
      withSession(session),
    );
  }
}

module.exports = { VehicleRepository };
