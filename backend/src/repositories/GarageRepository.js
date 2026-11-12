/**
 * Garage profiles. Owned by: garages refactor.
 * Add query methods here instead of calling db.collection('garages') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');

/** Suspended garages carry `isActive: false`; legacy rows may lack the field entirely. */
const ACTIVE_FILTER = Object.freeze({ isActive: { $ne: false } });
// mongodb driver v6: findOneAndUpdate resolves to the document itself (or null).
const RETURN_UPDATED = Object.freeze({ returnDocument: 'after' });

class GarageRepository extends BaseRepository {
  constructor(db) {
    super(db, 'garages');
  }

  /** The garage owned by a user. `activeOnly` hides suspended garages. */
  findByOwner(ownerUserId, { activeOnly = false } = {}) {
    const filter = { ownerUserId: String(ownerUserId) };
    return this.findOne(activeOnly ? { ...filter, ...ACTIVE_FILTER } : filter);
  }

  /** A garage by its ObjectId, optionally hiding suspended garages (public pages). */
  findByObjectId(garageId, { activeOnly = false } = {}) {
    const filter = { _id: garageId };
    return this.findOne(activeOnly ? { ...filter, ...ACTIVE_FILTER } : filter);
  }

  create(doc) {
    return this.insertOne(doc);
  }

  /** `$set` the given fields and bump `updatedAt`. */
  setFields(garageId, fields, now = new Date()) {
    return this.updateOne({ _id: garageId }, { $set: { ...fields, updatedAt: now } });
  }

  /** Atomically update the caller's garage; resolves to the updated document or null. */
  setFieldsByOwner(ownerUserId, fields, now = new Date()) {
    return this.collection.findOneAndUpdate({ ownerUserId: String(ownerUserId) }, { $set: { ...fields, updatedAt: now } }, RETURN_UPDATED);
  }

  /** Append photo URLs to the gallery; resolves to the updated document. */
  pushGalleryPhotos(garageId, urls, now = new Date()) {
    return this.collection.findOneAndUpdate(
      { _id: garageId },
      { $push: { galleryPhotos: { $each: urls } }, $set: { updatedAt: now } },
      RETURN_UPDATED
    );
  }

  /** Atomically remove one photo URL from the gallery; resolves to the updated document. */
  pullGalleryPhoto(garageId, url, now = new Date()) {
    return this.collection.findOneAndUpdate(
      { _id: garageId },
      { $pull: { galleryPhotos: url }, $set: { updatedAt: now } },
      RETURN_UPDATED
    );
  }

  /** Denormalised rating stats shown on marketplace cards. */
  setRatingStats(garageId, { rating, reviewCount }, { touchUpdatedAt = true, now = new Date() } = {}) {
    const fields = { rating, reviewCount };
    if (touchUpdatedAt) fields.updatedAt = now;
    return this.updateOne({ _id: garageId }, { $set: fields });
  }
}

module.exports = { GarageRepository, ACTIVE_FILTER };
