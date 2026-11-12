/**
 * Vehicles. Owned by: services refactor (odometer) and ownership/passport refactor (ownership,
 * passport lookups).
 * Add query methods here instead of calling db.collection('vehicles') from routes or services.
 */
const { BaseRepository, idFilter, idValues, toObjectId } = require('./BaseRepository');
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

  /**
   * Passport lookup. An ObjectId-shaped id uses the `_id` index; only legacy non-ObjectId ids fall
   * back to the (unindexed) custom `id` / `passportId` fields, so the public page no longer runs a
   * collection scan on every view.
   */
  findActiveForPassport(rawId) {
    const id = String(rawId);
    const objectId = toObjectId(id);
    const match = objectId ? { _id: objectId } : { $or: [{ _id: id }, { id }, { passportId: id }] };
    return this.collection.findOne({ ...match, isArchived: { $ne: true } });
  }

  /** Lightweight cards for many vehicles at once (replaces one findOne per row). */
  findManyByIds(ids, projection) {
    const objectIds = [...new Set(ids.map(String))].map((id) => toObjectId(id)).filter(Boolean);
    if (objectIds.length === 0) return Promise.resolve([]);
    return this.find({ _id: { $in: objectIds } }, { projection });
  }

  /**
   * Ownership compare-and-swap: moves the vehicle to the buyer only while it is still active and
   * owned by the seller (ownerId, or the legacy userId field that security/vehicleAccess.isOwner
   * also honours). The legacy userId is rewritten too, otherwise the seller would keep owner access.
   * @returns {Promise<boolean>} true when this call moved the vehicle
   */
  async reassignOwner(vehicleObjectId, sellerId, buyer, { session } = {}) {
    const seller = idValues(sellerId);
    const result = await this.collection.updateOne(
      { _id: vehicleObjectId, isArchived: { $ne: true }, $or: [{ ownerId: { $in: seller } }, { ownerId: { $exists: false }, userId: { $in: seller } }] },
      // Pipeline update (to rewrite userId only where it exists); user-supplied strings are wrapped
      // in $literal so a name such as "$ownerId" is stored verbatim, never read as a field path.
      [{ $set: {
        ownerId: { $literal: String(buyer.id) },
        ownerName: { $literal: buyer.name },
        phone: { $literal: buyer.phone },
        userId: { $cond: [{ $ifNull: ['$userId', false] }, { $literal: String(buyer.id) }, '$$REMOVE'] },
      } }],
      withSession(session),
    );
    return result.modifiedCount === 1;
  }

  /** Caches the rendered QR image together with the URL it encodes, so views do not re-render it. */
  saveQrCode(vehicleObjectId, { qrCodeUrl, qrCodeTarget }) {
    return this.collection.updateOne({ _id: vehicleObjectId }, { $set: { qrCodeUrl, qrCodeTarget } });
  }
}

module.exports = { VehicleRepository };
