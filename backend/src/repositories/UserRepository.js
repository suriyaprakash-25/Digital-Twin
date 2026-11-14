/**
 * Users (accounts). Owned by: admin refactor.
 * Add query methods here instead of calling db.collection('users') from routes or services.
 *
 * Every read model returned from here excludes credentials and OTP state, so a caller that
 * forgets to whitelist fields still cannot leak a password hash.
 */
const { BaseRepository } = require('./BaseRepository');

const SENSITIVE_USER_FIELDS = Object.freeze([
  'password',
  'passwordHash',
  'passwordChangedAt',
  'otp',
  'otpHash',
  'otpExpiry',
  'otpAttempts',
  'otpRequestCount',
  'otpRequestWindow',
  'resetToken',
  'resetTokenExpiry',
  'tokenVersion',
]);

const SAFE_USER_PROJECTION = Object.freeze(Object.fromEntries(SENSITIVE_USER_FIELDS.map((field) => [field, 0])));

const NOT_ARCHIVED = { isArchived: { $ne: true } };

/** Lookup that counts a user's non-archived documents in `from` (keyed by string ownerId). */
function countOwnedLookup(from, as) {
  return {
    $lookup: {
      from,
      localField: '_idStr',
      foreignField: 'ownerId',
      pipeline: [{ $match: NOT_ARCHIVED }, { $count: 'n' }],
      as,
    },
  };
}

const firstCount = (field) => ({ $ifNull: [{ $first: `$${field}.n` }, 0] });

class UserRepository extends BaseRepository {
  constructor(db) {
    super(db, 'users');
  }

  /** Total number of accounts (dashboard KPI). */
  countAll() {
    return this.count({});
  }

  /** One user by ObjectId, without credentials/OTP fields. */
  findByIdWithoutSecrets(objectId) {
    return this.findOne({ _id: objectId }, { projection: SAFE_USER_PROJECTION });
  }

  /**
   * Newest-first page of users for the admin console, each with `vehicleCount` and
   * `serviceCount` (non-archived). Counts are computed in the lookup, not by loading documents.
   * @param {object} filter Mongo filter (already built from safe search input)
   * @param {{ skip: number, limit: number, page: number }} page from core/pagination
   */
  async findPageForAdmin(filter, { skip, limit, page }) {
    const pipeline = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: SAFE_USER_PROJECTION },
      { $addFields: { _idStr: { $toString: '$_id' } } },
      countOwnedLookup('vehicles', '_vehicleCount'),
      countOwnedLookup('services', '_serviceCount'),
      { $addFields: { vehicleCount: firstCount('_vehicleCount'), serviceCount: firstCount('_serviceCount') } },
      { $project: { _idStr: 0, _vehicleCount: 0, _serviceCount: 0 } },
    ];
    const [items, total] = await Promise.all([this.aggregate(pipeline), this.count(filter)]);
    return { items, total, page, limit };
  }
}

module.exports = { UserRepository, SAFE_USER_PROJECTION, SENSITIVE_USER_FIELDS };
