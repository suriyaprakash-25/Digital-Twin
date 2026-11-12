/**
 * Garage service catalogue: owner CRUD (scoped to the caller's own active garage) and the public
 * list of bookable services.
 */
const { ValidationError, NotFoundError } = require('../../core/errors');
const { toObjectId } = require('../../repositories/BaseRepository');
const { CATALOGUE } = require('./garageConstants');

const MSG = Object.freeze({
  CREATE_PROFILE_FIRST: 'Create your garage profile first',
  TITLE_REQUIRED: 'Service title is required',
  SERVICE_NOT_FOUND: 'Service not found',
  INVALID_GARAGE_ID: 'Invalid Garage ID',
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

/** Blank → null; otherwise a finite number (garbage such as "abc" also becomes null, not NaN). */
function optionalNumber(value) {
  if (isBlank(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toOwnerService(s) {
  return {
    id: String(s._id),
    title: s.title,
    description: s.description,
    price: s.price,
    durationMins: s.durationMins,
    category: s.category || CATALOGUE.OWNER_DEFAULT_CATEGORY,
    photoUrl: s.photoUrl || null,
    whatsIncluded: asArray(s.whatsIncluded),
    bundledItems: asArray(s.bundledItems),
    isPackage: Boolean(s.isPackage),
    isActive: Boolean(s.isActive !== false),
  };
}

/** Public catalogue shape shared by GET /:garageId/services and GET /details/:garageId. */
function toPublicService(s) {
  return {
    id: String(s._id),
    title: s.title,
    description: s.description,
    price: Number.parseFloat(s.price || 0),
    durationMins: s.durationMins || CATALOGUE.PUBLIC_DEFAULT_DURATION_MINS,
    category: s.category || CATALOGUE.PUBLIC_DEFAULT_CATEGORY,
    photoUrl: s.photoUrl || null,
    whatsIncluded: s.whatsIncluded || [],
    isPackage: Boolean(s.isPackage),
  };
}

function buildNewService(garageId, body, now) {
  const { title, description, price, durationMins, category, photoUrl, whatsIncluded, bundledItems, isPackage } = body;
  return {
    garageId,
    title: String(title),
    description: description ? String(description) : '',
    price: optionalNumber(price),
    durationMins: optionalNumber(durationMins),
    category: category ? String(category) : CATALOGUE.OWNER_DEFAULT_CATEGORY,
    photoUrl: photoUrl ? String(photoUrl) : null,
    whatsIncluded: asArray(whatsIncluded),
    bundledItems: asArray(bundledItems),
    isPackage: Boolean(isPackage),
    isActive: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Partial update: only fields present in the body are written. */
function buildServicePatch(body, now) {
  const { title, description, price, durationMins, category, photoUrl, whatsIncluded, bundledItems, isPackage, isActive } = body;
  const patch = { updatedAt: now };
  if (title !== undefined) patch.title = String(title);
  if (description !== undefined) patch.description = String(description);
  if (price !== undefined) patch.price = optionalNumber(price);
  if (durationMins !== undefined) patch.durationMins = optionalNumber(durationMins);
  if (category !== undefined) patch.category = String(category);
  if (photoUrl !== undefined) patch.photoUrl = photoUrl ? String(photoUrl) : null;
  if (whatsIncluded !== undefined) patch.whatsIncluded = asArray(whatsIncluded);
  if (bundledItems !== undefined) patch.bundledItems = asArray(bundledItems);
  if (isPackage !== undefined) patch.isPackage = Boolean(isPackage);
  if (isActive !== undefined) patch.isActive = Boolean(isActive);
  return patch;
}

function createGarageCatalogService({ repos, now = () => new Date() }) {
  const { garages, garageServices } = repos;

  async function requireActiveGarage(userId) {
    const garage = await garages.findByOwner(userId, { activeOnly: true });
    if (!garage) throw new ValidationError(MSG.CREATE_PROFILE_FIRST);
    return garage;
  }

  async function listMine(userId) {
    const garage = await requireActiveGarage(userId);
    const services = await garageServices.listForGarage(garage._id);
    return services.map(toOwnerService);
  }

  async function createMine(userId, body = {}) {
    if (!body.title) throw new ValidationError(MSG.TITLE_REQUIRED);
    const garage = await requireActiveGarage(userId);
    const result = await garageServices.create(buildNewService(garage._id, body, now()));
    return { id: String(result.insertedId) };
  }

  /** Ownership is enforced in the query: another garage's item is simply "not found". */
  async function updateMine(userId, serviceIdParam, body = {}) {
    const garage = await requireActiveGarage(userId);
    const serviceId = toObjectId(serviceIdParam);
    if (!serviceId) throw new NotFoundError(MSG.SERVICE_NOT_FOUND);
    const matched = await garageServices.updateOwned(serviceId, garage._id, buildServicePatch(body, now()));
    if (!matched) throw new NotFoundError(MSG.SERVICE_NOT_FOUND);
  }

  async function archiveMine(userId, serviceIdParam) {
    const garage = await requireActiveGarage(userId);
    const serviceId = toObjectId(serviceIdParam);
    if (!serviceId) throw new NotFoundError(MSG.SERVICE_NOT_FOUND);
    const matched = await garageServices.archiveOwned(serviceId, garage._id, now());
    if (!matched) throw new NotFoundError(MSG.SERVICE_NOT_FOUND);
  }

  async function listPublic(garageIdParam) {
    const garageId = toObjectId(garageIdParam);
    if (!garageId) throw new ValidationError(MSG.INVALID_GARAGE_ID);
    const services = await garageServices.listPublicForGarage(garageId);
    return services.map(toPublicService);
  }

  return { listMine, createMine, updateMine, archiveMine, listPublic };
}

module.exports = { createGarageCatalogService, toOwnerService, toPublicService, buildNewService, buildServicePatch, optionalNumber, MSG };
