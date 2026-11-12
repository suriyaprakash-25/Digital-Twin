/**
 * Uploaded media metadata. Owned by: ownership/passport refactor.
 * Add query methods here instead of calling db.collection('media') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');

const VEHICLE_ENTITY = 'VEHICLE';
const VEHICLE_PROFILE_CATEGORY = 'VEHICLE_PROFILE';

class MediaRepository extends BaseRepository {
  constructor(db) {
    super(db, 'media');
  }

  /** Profile photos of a vehicle (any stored id spelling), oldest first. */
  listVehicleProfilePhotos(entityIds) {
    const ids = [...new Set(entityIds.filter(Boolean).map(String))];
    return this.find(
      { entityType: VEHICLE_ENTITY, category: VEHICLE_PROFILE_CATEGORY, entityId: { $in: ids } },
      { sort: { createdAt: 1 } },
    );
  }
}

module.exports = { MediaRepository };
