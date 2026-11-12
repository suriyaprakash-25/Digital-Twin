/**
 * Admin console: garage directory and moderation (verify / unverify / suspend / activate).
 */
const { ValidationError, NotFoundError } = require('../../core/errors');
const { safeSearchRegex } = require('../../core/text');
const { toObjectIdOrNull, garageListFilter, garagePageWithStatsPipeline } = require('./adminQueries');
const { toGarageListItem } = require('./adminPresenters');

/** Field changes applied by each moderation action. Suspending also revokes verification. */
const GARAGE_MODERATION_ACTIONS = Object.freeze({
  verify: Object.freeze({ verified: true }),
  unverify: Object.freeze({ verified: false }),
  suspend: Object.freeze({ isActive: false, verified: false }),
  activate: Object.freeze({ isActive: true }),
});

/**
 * @param {{ garages: object }} repos from createRepositories(db)
 * @param {{ now?: () => Date }} [options] injectable clock
 */
function createAdminGarageService({ garages }, { now = () => new Date() } = {}) {
  return {
    async listGarages({ search, page }) {
      const filter = garageListFilter(safeSearchRegex(search));
      const [rows, total] = await Promise.all([
        garages.aggregate(garagePageWithStatsPipeline(filter, page)),
        garages.count(filter),
      ]);
      return { items: rows.map(toGarageListItem), total, page: page.page, limit: page.limit };
    },

    async moderateGarage(id, action) {
      if (!Object.prototype.hasOwnProperty.call(GARAGE_MODERATION_ACTIONS, action)) {
        throw new ValidationError('Unknown moderation action');
      }
      const objectId = toObjectIdOrNull(id);
      if (!objectId) throw new ValidationError('Invalid garage ID');

      const result = await garages.updateOne(
        { _id: objectId },
        { $set: { ...GARAGE_MODERATION_ACTIONS[action], updatedAt: now() } }
      );
      if (!result.matchedCount) throw new NotFoundError('Garage not found');
    },
  };
}

module.exports = { createAdminGarageService, GARAGE_MODERATION_ACTIONS };
