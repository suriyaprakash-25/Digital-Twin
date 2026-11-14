/**
 * AI vehicle diagnoses. Owned by: ownership/passport refactor.
 * Add query methods here instead of calling db.collection('diagnoses') from routes or services.
 */
const { BaseRepository, toObjectId } = require('./BaseRepository');
const { withSession } = require('../core/transaction');

class DiagnosisRepository extends BaseRepository {
  constructor(db) {
    super(db, 'diagnoses');
  }

  /** Diagnosis history follows the vehicle to its new owner (userId is stored as an ObjectId). */
  reassignVehicle(vehicleIdValues, newOwnerId, { session } = {}) {
    return this.collection.updateMany(
      { vehicleId: { $in: vehicleIdValues } },
      { $set: { userId: toObjectId(newOwnerId) || String(newOwnerId) } },
      withSession(session),
    );
  }
}

module.exports = { DiagnosisRepository };
