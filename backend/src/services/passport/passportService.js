/**
 * Vehicle digital passport use cases: the JSON passport (owner or public view) and the data model
 * behind the downloadable PDF. Dependencies are injected (repositories, access policy, QR renderer,
 * health calculator, public base URL), so this module never touches getDb().
 */
const { toObjectId, idValues } = require('../../repositories/BaseRepository');
const { ValidationError, NotFoundError } = require('../../core/errors');
const { audienceFor } = require('../ownership/ownershipHistoryService');
const { AUDIENCE, fallbackHistoryEntry } = require('../ownership/presenters');
const { MSG, DEFAULTS } = require('./constants');
const { toPassportView, toInsuranceView, toVehicleView, toOwnerContactView, toOwnershipPeriodView, visibleRecords, extractReplacedParts, isUnconfirmedWalkIn, toPdfServiceRow } = require('./presenters');

const OWNER_CONTACT_PROJECTION = Object.freeze({ name: 1, email: 1, phone: 1 });
const QR_DATA_URL_PREFIX = /^data:image\/png;base64,/;

/**
 * @param {{ repos: object, isOwner: Function, generateQRCode: (text: string) => Promise<string>,
 *           calculateHealthScore: Function, frontendUrl: string, logger?: { error: Function } }} deps
 */
function createPassportService({ repos, isOwner, generateQRCode, calculateHealthScore, frontendUrl, logger = console }) {
  const publicUrlFor = (vehicleId) => `${String(frontendUrl || DEFAULTS.FRONTEND_URL).replace(/\/$/, '')}/passport/${vehicleId}`;

  /**
   * QR image for the public passport URL. Rendered once and cached on the vehicle with the URL it
   * encodes (previously re-rendered and written on every anonymous page view).
   */
  async function qrCodeFor(vehicle) {
    const target = publicUrlFor(String(vehicle._id));
    if (vehicle.qrCodeUrl && vehicle.qrCodeTarget === target) return vehicle.qrCodeUrl;
    try {
      const qrCodeUrl = await generateQRCode(target);
      await repos.vehicles.saveQrCode(vehicle._id, { qrCodeUrl, qrCodeTarget: target });
      return qrCodeUrl;
    } catch (err) {
      logger.error('Failed to generate or store QR code', err);
      return vehicle.qrCodeUrl || null;
    }
  }

  /** Health from records that count as evidence: unconfirmed walk-ins cannot inflate the score. */
  function healthFor(vehicle, records) {
    try {
      const result = calculateHealthScore(vehicle, records.filter((r) => !isUnconfirmedWalkIn(r)));
      return { healthScore: result.healthScore, conditionLevel: result.conditionLevel };
    } catch (err) {
      logger.error('Failed to calculate vehicle health, defaulting to 100', err);
      return DEFAULTS.HEALTH;
    }
  }

  async function loadOwner(vehicle) {
    if (!vehicle.ownerId || !toObjectId(vehicle.ownerId)) return null;
    try {
      return await repos.users.findById(vehicle.ownerId, { projection: OWNER_CONTACT_PROJECTION });
    } catch (err) {
      logger.error('Failed to look up owner details', err);
      return null;
    }
  }

  /** Everything both views need, loaded in parallel. */
  async function loadPassportData(vehicle, requestedId) {
    const vehicleId = String(vehicle._id);
    const ids = [...idValues(vehicleId), requestedId, ...(vehicle.id ? [String(vehicle.id)] : [])];
    const [records, storedHistory, photos, ownerUser] = await Promise.all([
      repos.serviceRecords.find({ vehicleId: { $in: ids }, isArchived: { $ne: true } }, { sort: { serviceDate: -1 } }),
      repos.ownershipHistory.listForVehicle([vehicleId, requestedId]),
      repos.media.listVehicleProfilePhotos([vehicleId, requestedId, vehicle.id]),
      loadOwner(vehicle),
    ]);
    const history = storedHistory.length > 0 ? storedHistory : [fallbackHistoryEntry(vehicle, vehicleId)];
    return { vehicle, records, history, photos, ownerUser, health: healthFor(vehicle, records) };
  }

  /**
   * @param {object|null} viewer req.user from optionalAuth (null when anonymous)
   * @param {{ forcePublic?: boolean }} options `/public/:id` always renders the buyer's view
   */
  async function getPassport(viewer, rawId, { forcePublic = false } = {}) {
    const requestedId = String(rawId || '').trim();
    if (!requestedId) throw new ValidationError(MSG.ID_REQUIRED);
    const vehicle = await repos.vehicles.findActiveForPassport(requestedId);
    if (!vehicle) throw new NotFoundError(MSG.PASSPORT_NOT_FOUND);

    const audience = forcePublic ? AUDIENCE.PUBLIC : audienceFor(viewer, vehicle, isOwner);
    const [data, qrCodeUrl] = await Promise.all([loadPassportData(vehicle, requestedId), qrCodeFor(vehicle)]);
    return toPassportView({ ...data, qrCodeUrl }, audience);
  }

  /** Audience-filtered model for passportPdf.writePassportPdf (all async work happens here). */
  async function getPdfModel(viewer, rawId) {
    const vehicleObjectId = toObjectId(rawId);
    if (!vehicleObjectId) throw new ValidationError(MSG.INVALID_VEHICLE_ID);
    const vehicle = await repos.vehicles.findActiveById(vehicleObjectId);
    if (!vehicle) throw new NotFoundError(MSG.VEHICLE_NOT_FOUND);

    const audience = audienceFor(viewer, vehicle, isOwner);
    const vehicleId = String(vehicle._id);
    const [data, insurance, qrPng] = await Promise.all([
      loadPassportData(vehicle, vehicleId),
      repos.insurance.listForVehicle(vehicleId),
      generateQRCode(publicUrlFor(vehicleId))
        .then((dataUrl) => Buffer.from(dataUrl.replace(QR_DATA_URL_PREFIX, ''), 'base64'))
        .catch((err) => { logger.error('Failed to embed QR code in PDF:', err); return null; }),
    ]);
    const shown = visibleRecords(data.records, audience);
    return {
      audience,
      vehicle: toVehicleView(vehicle, audience, null),
      owner: toOwnerContactView(data.ownerUser, vehicle, audience),
      health: data.health,
      insurance: insurance.map((p) => toInsuranceView(p, audience)),
      ownershipHistory: data.history.map((h) => toOwnershipPeriodView(h, audience)),
      partsReplaced: extractReplacedParts(shown),
      services: shown.map(toPdfServiceRow),
      qrPng,
    };
  }

  return { getPassport, getPdfModel, publicUrlFor };
}

module.exports = { createPassportService };
