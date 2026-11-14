/**
 * Admin console: user directory (list + detail). Depends only on injected repositories.
 */
const { ValidationError, NotFoundError } = require('../../core/errors');
const { safeSearchRegex } = require('../../core/text');
const { ADMIN_LIMITS } = require('./adminConstants');
const {
  toObjectIdOrNull,
  anyFieldMatches,
  ownedActiveFilter,
  VEHICLE_SUMMARY_PROJECTION,
  SERVICE_SUMMARY_PROJECTION,
} = require('./adminQueries');
const { toUserListItem, toUserDetail } = require('./adminPresenters');

const USER_SEARCH_FIELDS = Object.freeze(['name', 'email']);

/**
 * @param {{ users: object, vehicles: object, serviceRecords: object }} repos from createRepositories(db)
 */
function createAdminUserService({ users, vehicles, serviceRecords }) {
  return {
    /** @param {{ search?: unknown, page: { page: number, limit: number, skip: number } }} input */
    async listUsers({ search, page }) {
      const filter = anyFieldMatches(USER_SEARCH_FIELDS, safeSearchRegex(search));
      const result = await users.findPageForAdmin(filter, page);
      return { ...result, items: result.items.map(toUserListItem) };
    },

    async getUserDetail(id) {
      const objectId = toObjectIdOrNull(id);
      if (!objectId) throw new ValidationError('Invalid user ID');

      const user = await users.findByIdWithoutSecrets(objectId);
      if (!user) throw new NotFoundError('User not found');

      const owned = ownedActiveFilter(String(user._id));
      const limit = ADMIN_LIMITS.USER_DETAIL_MAX_ITEMS;
      const [userVehicles, userServices] = await Promise.all([
        vehicles.find(owned, { limit, projection: VEHICLE_SUMMARY_PROJECTION }),
        serviceRecords.find(owned, { sort: { serviceDate: -1 }, limit, projection: SERVICE_SUMMARY_PROJECTION }),
      ]);
      return toUserDetail(user, userVehicles, userServices);
    },
  };
}

module.exports = { createAdminUserService, USER_SEARCH_FIELDS };
