/**
 * Garage payout (bank) profiles. Owned by: invoices/earnings refactor.
 * Add query methods here instead of calling db.collection('garage_payout_profiles') from routes or services.
 * Only masked bank details are ever stored (last 4 digits of the account, masked IFSC).
 */
const { BaseRepository } = require('./BaseRepository');

class PayoutProfileRepository extends BaseRepository {
  constructor(db) {
    super(db, 'garage_payout_profiles');
  }

  /** The profile of a garage under any of its id aliases (user id or garage id). */
  findForGarage(garageIds) {
    return this.findOne({ garageId: { $in: garageIds } });
  }

  /** Creates or replaces the garage's masked profile (unique index on garageId). */
  upsertForGarage(garageId, fields, now) {
    return this.updateOne(
      { garageId },
      { $set: { ...fields, garageId, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
}

module.exports = { PayoutProfileRepository };
