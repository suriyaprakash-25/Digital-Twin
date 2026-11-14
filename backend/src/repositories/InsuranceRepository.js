/**
 * Vehicle insurance records. Owned by: ownership/passport refactor.
 * Add query methods here instead of calling db.collection('insurance') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');

class InsuranceRepository extends BaseRepository {
  constructor(db) {
    super(db, 'insurance');
  }

  /** Policies for a vehicle, latest expiry first (bounded: the passport shows at most a handful). */
  listForVehicle(vehicleId, { limit } = {}) {
    return this.find({ vehicleId: String(vehicleId) }, { sort: { expiryDate: -1 }, limit });
  }
}

module.exports = { InsuranceRepository };
