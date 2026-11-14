/**
 * Public garage pages: the detail profile (read-through cached) and the photo gallery.
 *
 * The cached snapshot holds only slowly-changing, plain data (ids as strings). Live fields
 * (open/closed status, current time) are computed per request from the snapshot.
 */
const { ValidationError, NotFoundError } = require('../../core/errors');
const { toObjectId } = require('../../repositories/BaseRepository');
const { CACHE_KEYS } = require('../../infrastructure/cache/cache');
const { PROFILE, RATINGS, PUBLIC_PROFILE_DEFAULTS: DEFAULTS, CACHE_TTL } = require('./garageConstants');
const { toPublicService } = require('./garageCatalogService');

const MSG = Object.freeze({
  INVALID_GARAGE_ID: 'Invalid Garage ID',
  PROFILE_NOT_FOUND: 'Garage profile not found',
  GARAGE_NOT_FOUND: 'Garage not found',
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const nonEmptyOr = (value, fallback) => (Array.isArray(value) && value.length > 0 ? value : [...fallback]);
const cleanPhotos = (photos) => asArray(photos).filter((url) => typeof url === 'string' && url.trim().length > 0);

function detailCacheKey(garageId) {
  return `${CACHE_KEYS.GARAGE_DETAIL}${String(garageId)}`;
}

function createGaragePublicService({ repos, cache, availability }) {
  const { garages, garageServices, reviews, users } = repos;

  /**
   * The public contact email falls back to the owner's account email: this is what the endpoint
   * has always exposed (no new PII). It is only looked up when the garage has no contact email.
   */
  async function resolveContactEmail(garage) {
    const direct = garage.email || garage.contactEmail;
    if (direct || !garage.ownerUserId) return direct || DEFAULTS.CONTACT_EMAIL;
    try {
      const owner = await users.findById(garage.ownerUserId, { projection: { email: 1 } });
      return (owner && owner.email) || DEFAULTS.CONTACT_EMAIL;
    } catch (err) {
      console.warn('Error fetching owner user email:', err.message);
      return DEFAULTS.CONTACT_EMAIL;
    }
  }

  /** Builds the cacheable snapshot, or undefined (not cached) when the garage is missing/suspended. */
  async function loadDetailSnapshot(garageId) {
    const garage = await garages.findByObjectId(garageId, { activeOnly: true });
    if (!garage) return undefined;

    const [email, services, summary] = await Promise.all([
      resolveContactEmail(garage),
      garageServices.listPublicForGarage(garageId),
      reviews.ratingSummary(garageId),
    ]);

    return {
      availability: {
        availabilityMode: garage.availabilityMode,
        manualStatus: garage.manualStatus,
        businessHours: garage.businessHours,
      },
      head: {
        id: String(garage._id),
        name: garage.name,
        phone: garage.phone,
        email,
        address: garage.address,
        city: garage.city,
        description: garage.description || DEFAULTS.DESCRIPTION,
        maxCapacity: garage.maxCapacity || PROFILE.DEFAULT_MAX_CAPACITY,
        photoUrl: garage.photoUrl || null,
        galleryPhotos: cleanPhotos(garage.galleryPhotos),
        certifications: nonEmptyOr(garage.certifications, DEFAULTS.CERTIFICATIONS),
        specializations: nonEmptyOr(garage.specializations, DEFAULTS.SPECIALIZATIONS),
        rating: summary.count > 0 ? summary.average : (garage.rating || RATINGS.DEFAULT_GARAGE_RATING),
        reviewCount: summary.count,
        ratingDistribution: summary.distribution,
        experienceYears: garage.experienceYears || DEFAULTS.EXPERIENCE_YEARS,
        partnerSince: garage.createdAt ? new Date(garage.createdAt).getFullYear() : DEFAULTS.PARTNER_SINCE_YEAR,
        isVerified: Boolean(garage.verified !== false),
      },
      tail: {
        businessHours: garage.businessHours || structuredClone(DEFAULTS.BUSINESS_HOURS),
        facilities: garage.facilities || { ...DEFAULTS.FACILITIES },
        paymentMethods: garage.paymentMethods || [...DEFAULTS.PAYMENT_METHODS],
        garageLocation: garage.garageLocation || null,
        services: services.map(toPublicService),
      },
    };
  }

  async function getDetails(garageIdParam) {
    const garageId = toObjectId(garageIdParam);
    if (!garageId) throw new ValidationError(MSG.INVALID_GARAGE_ID);
    const snapshot = await cache.wrap(detailCacheKey(garageId), CACHE_TTL.GARAGE_DETAIL_MS, () => loadDetailSnapshot(garageId));
    if (!snapshot) throw new NotFoundError(MSG.PROFILE_NOT_FOUND);
    return {
      ...snapshot.head,
      currentStatus: availability.calculateCurrentStatus(snapshot.availability),
      currentTime: availability.getCurrentTimeString(),
      ...snapshot.tail,
    };
  }

  async function getGallery(garageIdParam) {
    const garageId = toObjectId(garageIdParam);
    if (!garageId) throw new ValidationError(MSG.INVALID_GARAGE_ID);
    const garage = await garages.findByObjectId(garageId, { activeOnly: true });
    if (!garage) throw new NotFoundError(MSG.GARAGE_NOT_FOUND);
    return { galleryPhotos: cleanPhotos(garage.galleryPhotos) };
  }

  return { getDetails, getGallery, loadDetailSnapshot };
}

module.exports = { createGaragePublicService, detailCacheKey, MSG };
