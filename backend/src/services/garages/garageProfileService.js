/**
 * The garage owner's own profile: read/save, capacity, map location, logo photo and gallery.
 *
 * Dependencies are injected (repositories + file storage) so the service never touches the
 * global db and can be unit-tested with fakes.
 */
const { ValidationError, NotFoundError } = require('../../core/errors');
const { PROFILE, UPLOADS, RATINGS } = require('./garageConstants');

const MSG = Object.freeze({
  NAME_REQUIRED: 'Garage name is required',
  PROFILE_NOT_FOUND: 'Garage profile not found',
  CREATE_PROFILE_FIRST: 'Create your garage profile first',
  NO_PHOTOS: 'No photos provided',
  NO_PHOTO: 'No photo provided',
  PHOTO_URL_REQUIRED: 'Photo URL is required',
  CAPACITY_INVALID: 'Capacity must be a positive number',
  COORDINATES_REQUIRED: 'Valid latitude and longitude are required',
  COORDINATES_RANGE: 'Coordinates out of valid range',
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function parseCapacity(value) {
  const capacity = Number(value);
  return Number.isFinite(capacity) && capacity >= PROFILE.MIN_CAPACITY ? capacity : null;
}

function inRange(value, [min, max]) {
  return value >= min && value <= max;
}

/** Owner-facing profile shape returned by GET /api/garages/me. */
function toOwnerProfile(garage) {
  return {
    exists: true,
    id: String(garage._id),
    name: garage.name,
    phone: garage.phone,
    address: garage.address,
    city: garage.city,
    description: garage.description,
    maxCapacity: garage.maxCapacity !== undefined ? garage.maxCapacity : PROFILE.DEFAULT_MAX_CAPACITY,
    isActive: Boolean(garage.isActive !== false),
    createdAt: garage.createdAt,
    garageLocation: garage.garageLocation || null,
    photoUrl: garage.photoUrl || null,
    galleryPhotos: asArray(garage.galleryPhotos),
    certifications: asArray(garage.certifications),
    specializations: asArray(garage.specializations),
    rating: garage.rating || RATINGS.DEFAULT_GARAGE_RATING,
    reviewCount: garage.reviewCount || 0,
  };
}

/**
 * Fields written by POST /me. `isActive` is deliberately absent: an admin suspension must not be
 * undone by the garage re-saving its profile (new profiles get isActive:true on insert only).
 *
 * Gallery: the client may reorder or drop photos, but may only keep URLs that are already in its
 * own gallery (uploads go through POST /gallery). Otherwise a garage could plant another party's
 * file URL and then delete that file through DELETE /gallery. An omitted list leaves it unchanged.
 */
function buildProfileFields(userId, body, existing) {
  const { name, phone, address, city, description, maxCapacity, certifications, specializations, galleryPhotos } = body;
  const fields = {
    name: String(name),
    phone: phone ? String(phone) : '',
    address: address ? String(address) : '',
    city: city ? String(city) : '',
    description: description ? String(description) : '',
    maxCapacity: parseCapacity(maxCapacity) ?? (existing && existing.maxCapacity !== undefined ? existing.maxCapacity : PROFILE.DEFAULT_MAX_CAPACITY),
    certifications: asArray(certifications),
    specializations: asArray(specializations),
    ownerUserId: String(userId),
  };
  if (galleryPhotos !== undefined || !existing) {
    const owned = new Set(asArray(existing && existing.galleryPhotos));
    fields.galleryPhotos = asArray(galleryPhotos).filter((url) => isNonEmptyString(url) && owned.has(url));
  }
  return fields;
}

function createGarageProfileService({ repos, storage, now = () => new Date() }) {
  const { garages } = repos;

  async function getMyProfile(userId) {
    const garage = await garages.findByOwner(userId, { activeOnly: true });
    return garage ? toOwnerProfile(garage) : null;
  }

  /** @returns {Promise<{ created: boolean, id: string }>} */
  async function saveMyProfile(userId, body = {}) {
    if (!body.name) throw new ValidationError(MSG.NAME_REQUIRED);
    const existing = await garages.findByOwner(userId);
    const fields = buildProfileFields(userId, body, existing);
    if (existing) {
      await garages.setFields(existing._id, fields, now());
      return { created: false, id: String(existing._id) };
    }
    const timestamp = now();
    const result = await garages.create({ ...fields, isActive: true, createdAt: timestamp, updatedAt: timestamp });
    return { created: true, id: String(result.insertedId) };
  }

  /** Persist uploaded gallery photos; never leaves orphaned files or temp files behind. */
  async function addGalleryPhotos(userId, files = []) {
    if (!files.length) throw new ValidationError(MSG.NO_PHOTOS);
    let persisted = [];
    let stored = false;
    try {
      const garage = await garages.findByOwner(userId);
      if (!garage) throw new NotFoundError(MSG.PROFILE_NOT_FOUND);
      persisted = await storage.persistUploadedFiles(files, { folder: UPLOADS.GALLERY_FOLDER, resourceType: UPLOADS.RESOURCE_TYPE });
      const photoUrls = persisted.map((asset) => asset.url);
      const updated = await garages.pushGalleryPhotos(garage._id, photoUrls, now());
      stored = true;
      return { photoUrls, galleryPhotos: (updated && updated.galleryPhotos) || [...asArray(garage.galleryPhotos), ...photoUrls] };
    } catch (err) {
      if (!stored && persisted.length > 0) {
        await Promise.allSettled(persisted.map((asset) => storage.deletePersistedFile(asset)));
      } else if (persisted.length === 0) {
        files.forEach(storage.removeTemporaryFile);
      }
      throw err;
    }
  }

  /** Replace the garage logo; the previous file is deleted only after the new one is saved. */
  async function setProfilePhoto(userId, file) {
    if (!file) throw new ValidationError(MSG.NO_PHOTO);
    let persisted = null;
    let stored = false;
    try {
      const garage = await garages.findByOwner(userId);
      if (!garage) throw new NotFoundError(MSG.PROFILE_NOT_FOUND);
      persisted = await storage.persistUploadedFile(file, { folder: UPLOADS.PROFILE_FOLDER, resourceType: UPLOADS.RESOURCE_TYPE });
      await garages.setFields(garage._id, {
        photoUrl: persisted.url,
        photoStorageProvider: persisted.storageProvider,
        photoStorageKey: persisted.storageKey,
        photoResourceType: persisted.resourceType || UPLOADS.RESOURCE_TYPE,
      }, now());
      stored = true;
      if (garage.photoUrl && garage.photoUrl !== persisted.url) {
        await storage.deletePersistedFile({
          url: garage.photoUrl,
          storageProvider: garage.photoStorageProvider,
          storageKey: garage.photoStorageKey,
          resourceType: garage.photoResourceType || UPLOADS.RESOURCE_TYPE,
        }).catch((err) => console.warn('Old garage photo cleanup failed:', err.message));
      }
      return { photoUrl: persisted.url };
    } catch (err) {
      if (!stored && persisted) await storage.deletePersistedFile(persisted);
      if (!persisted) storage.removeTemporaryFile(file);
      throw err;
    }
  }

  async function updateCapacity(userId, maxCapacity) {
    const capacity = parseCapacity(maxCapacity);
    if (capacity === null) throw new ValidationError(MSG.CAPACITY_INVALID);
    const updated = await garages.setFieldsByOwner(userId, { maxCapacity: capacity }, now());
    if (!updated) throw new NotFoundError(MSG.PROFILE_NOT_FOUND);
    return { maxCapacity: updated.maxCapacity };
  }

  /** Remove a photo from the caller's gallery. Files outside the caller's gallery are never deleted. */
  async function removeGalleryPhoto(userId, photoUrl) {
    if (!photoUrl) throw new ValidationError(MSG.PHOTO_URL_REQUIRED);
    const garage = await garages.findByOwner(userId, { activeOnly: true });
    if (!garage) throw new NotFoundError(MSG.PROFILE_NOT_FOUND);
    const gallery = asArray(garage.galleryPhotos);
    const remaining = gallery.filter((url) => url !== photoUrl);
    if (remaining.length === gallery.length) return { galleryPhotos: remaining };
    // Unlink from the profile first, so the profile never references a deleted file.
    const updated = await garages.pullGalleryPhoto(garage._id, photoUrl, now());
    await storage.deletePersistedFile({ url: photoUrl }).catch((err) => console.warn('Gallery photo cleanup failed:', err.message));
    return { galleryPhotos: (updated && updated.galleryPhotos) || remaining };
  }

  async function saveLocation(userId, { latitude, longitude, address } = {}) {
    const lat = Number.parseFloat(latitude);
    const lng = Number.parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) throw new ValidationError(MSG.COORDINATES_REQUIRED);
    if (!inRange(lat, PROFILE.LATITUDE_RANGE) || !inRange(lng, PROFILE.LONGITUDE_RANGE)) throw new ValidationError(MSG.COORDINATES_RANGE);
    const existing = await garages.findByOwner(userId);
    if (!existing) throw new NotFoundError(MSG.CREATE_PROFILE_FIRST);
    await garages.setFields(existing._id, {
      garageLocation: { latitude: lat, longitude: lng, address: address ? String(address).slice(0, PROFILE.LOCATION_ADDRESS_MAX_LENGTH) : '' },
    }, now());
  }

  return { getMyProfile, saveMyProfile, addGalleryPhotos, setProfilePhoto, updateCapacity, removeGalleryPhoto, saveLocation };
}

module.exports = { createGarageProfileService, toOwnerProfile, buildProfileFields, MSG };
