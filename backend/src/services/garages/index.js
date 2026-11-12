/**
 * Garage domain services (composition root for routes/garages.js).
 *
 * Each service receives its collaborators (repositories, cache, file storage, clock) by injection;
 * none of them calls getDb(). Tests build them with fake repositories.
 */
const { getCache } = require('../../infrastructure/cache/cache');
const persistentFileStorage = require('../persistentFileStorage');
const availabilityService = require('../availabilityService');
const { ensureReviewIndexes } = require('../../repositories/ReviewRepository');
const { ensureGarageServiceIndexes } = require('../../repositories/GarageServiceRepository');
const { createGarageProfileService } = require('./garageProfileService');
const { createGarageCatalogService } = require('./garageCatalogService');
const { createGarageReviewService } = require('./garageReviewService');
const { createGaragePublicService } = require('./garagePublicService');

/**
 * @param {{ repos: ReturnType<import('../../repositories').createRepositories>, cache?: object,
 *           storage?: object, availability?: object, now?: () => Date }} deps
 */
function createGarageServices({ repos, cache = getCache(), storage = persistentFileStorage, availability = availabilityService, now }) {
  return {
    profile: createGarageProfileService({ repos, storage, now }),
    catalog: createGarageCatalogService({ repos, now }),
    reviews: createGarageReviewService({ repos, now }),
    publicProfile: createGaragePublicService({ repos, cache, availability }),
  };
}

/**
 * Startup index initialiser for the garage domain (reviews + catalogue). Includes the unique
 * partial index that allows one review per booking. Takes an optional db like models/CoreIndexes.
 */
async function ensureGarageIndexes(dbInstance) {
  const db = dbInstance || require('../../db').getDb();
  await ensureGarageServiceIndexes(db);
  const { problems } = await ensureReviewIndexes(db);
  if (problems.length) {
    console.warn(`⚠️ Garage index issues (resolve duplicate reviews per booking, then restart):\n- ${problems.join('\n- ')}`);
  }
  return { problems };
}

module.exports = { createGarageServices, ensureGarageIndexes };
