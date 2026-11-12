/**
 * Garage service catalogue items. Owned by: garages refactor.
 * Add query methods here instead of calling db.collection('garageServices') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');

const NOT_ARCHIVED = Object.freeze({ isArchived: { $ne: true } });

const GARAGE_SERVICE_INDEXES = Object.freeze([
  [{ garageId: 1, isArchived: 1, createdAt: -1 }, { name: 'garage_catalogue' }],
]);

class GarageServiceRepository extends BaseRepository {
  constructor(db) {
    super(db, 'garageServices');
  }

  /** Every non-archived item of a garage (owner view, includes paused items), newest first. */
  listForGarage(garageId) {
    return this.find({ garageId, ...NOT_ARCHIVED }, { sort: { createdAt: -1 } });
  }

  /** Bookable items only (active and not archived): the public catalogue. */
  listPublicForGarage(garageId) {
    return this.find({ garageId, isActive: { $ne: false }, ...NOT_ARCHIVED });
  }

  create(doc) {
    return this.insertOne(doc);
  }

  /** Update an item only if it belongs to `garageId` and is not archived. Resolves to matchedCount. */
  async updateOwned(serviceId, garageId, fields) {
    const result = await this.updateOne({ _id: serviceId, garageId, ...NOT_ARCHIVED }, { $set: fields });
    return result.matchedCount;
  }

  /** Soft-delete an item that belongs to `garageId`. Resolves to matchedCount. */
  async archiveOwned(serviceId, garageId, now = new Date()) {
    const result = await this.updateOne({ _id: serviceId, garageId }, { $set: { isArchived: true, isActive: false, updatedAt: now } });
    return result.matchedCount;
  }
}

async function ensureGarageServiceIndexes(db) {
  for (const [keys, options] of GARAGE_SERVICE_INDEXES) {
    await db.collection('garageServices').createIndex(keys, options);
  }
}

module.exports = { GarageServiceRepository, ensureGarageServiceIndexes, GARAGE_SERVICE_INDEXES };
