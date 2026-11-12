/**
 * Garage profiles. Owned by: garages refactor.
 * Add query methods here instead of calling db.collection('garages') from routes or services.
 */
const { BaseRepository, toObjectId } = require('./BaseRepository');

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

  /** An active garage by a client-supplied id (null for malformed ids instead of throwing). */
  findActiveById(garageId) {
    const _id = toObjectId(garageId);
    return _id ? this.findByObjectId(_id, { activeOnly: true }) : Promise.resolve(null);
  }

  /**
   * Every identifier a garage account may appear under in financial rows: the owner's user id plus
   * the ids of the garage documents it owns (payments/disputes store the garage document id; legacy
   * rows stored the owner's user id).
   */
  async findIdsByOwner(ownerUserId) {
    const owned = await this.find({ ownerUserId: String(ownerUserId) }, { projection: { _id: 1 } });
    return [...new Set([String(ownerUserId), ...owned.map((g) => String(g._id))])];
  }

  /**
   * Per-garage mutual-exclusion lease for capacity-sensitive booking writes. Works on a standalone
   * mongod (no transactions): exactly one caller can hold an unexpired lease. Expired leases (a
   * crashed instance) are taken over. Resolves to the garage document when acquired, else null.
   */
  acquireCapacityLock(garageId, { token, now = new Date(), ttlMs }) {
    return this.collection.findOneAndUpdate(
      { _id: garageId, $or: [{ capacityLock: { $exists: false } }, { capacityLock: null }, { 'capacityLock.expiresAt': { $lte: now } }] },
      { $set: { capacityLock: { token, expiresAt: new Date(now.getTime() + ttlMs) } } },
      RETURN_UPDATED
    );
  }

  /** Releases the lease only if this caller still holds it. */
  releaseCapacityLock(garageId, token) {
    return this.updateOne({ _id: garageId, 'capacityLock.token': token }, { $unset: { capacityLock: '' } });
  }

  /** Denormalised rating stats shown on marketplace cards. */
  setRatingStats(garageId, { rating, reviewCount }, { touchUpdatedAt = true, now = new Date() } = {}) {
    const fields = { rating, reviewCount };
    if (touchUpdatedAt) fields.updatedAt = now;
    return this.updateOne({ _id: garageId }, { $set: fields });
  }
}

module.exports = { GarageRepository, ACTIVE_FILTER };
