/**
 * Pure passport presenters. Two audiences:
 *  - 'owner' (the vehicle's owner, or an admin): full detail, including unconfirmed walk-in records
 *    explicitly flagged as such;
 *  - 'public' (anyone else, e.g. a prospective buyer scanning the QR code): an explicit allow-list.
 *    No contact details, chassis/engine numbers, purchase data, document URLs, insurance policy
 *    numbers, user ids or upload metadata; owner names shortened; unconfirmed walk-ins excluded.
 * Response keys are unchanged, so the React Passport page renders both views.
 */
const { AUDIENCE, publicOwnerName } = require('../ownership/presenters');
const { DEFAULTS, VERIFICATION_STATUS } = require('./constants');

const isOwnerAudience = (audience) => audience === AUDIENCE.OWNER;

/** A garage walk-in record the owner has not confirmed yet: not evidence of anything for a buyer. */
function isUnconfirmedWalkIn(record) {
  return record.requiresOwnerConfirmation === true;
}

/** Verified only when a related garage wrote it: never for owner self-reports or pending walk-ins. */
function isVerifiedRecord(record) {
  return record.verifiedService === true && record.verificationStatus !== VERIFICATION_STATUS.PENDING && !isUnconfirmedWalkIn(record);
}

/** Records shown to an audience: the public never sees unconfirmed walk-ins. */
function visibleRecords(records, audience) {
  return isOwnerAudience(audience) ? records : records.filter((r) => !isUnconfirmedWalkIn(r));
}

function toServiceView(s, audience) {
  const view = {
    id: String(s._id),
    serviceDate: s.serviceDate,
    garageName: s.garageName || DEFAULTS.GARAGE_NAME,
    serviceType: s.serviceType,
    totalCost: s.totalCost || s.cost || 0,
    verifiedService: isVerifiedRecord(s),
    verificationStatus: isVerifiedRecord(s) ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PENDING,
  };
  if (isOwnerAudience(audience)) view.requiresOwnerConfirmation = isUnconfirmedWalkIn(s);
  return view;
}

function extractReplacedParts(records) {
  const parts = [];
  for (const s of records) {
    if (!Array.isArray(s.partsReplaced)) continue;
    for (const p of s.partsReplaced) {
      if (p && p.partName) {
        parts.push({ partName: p.partName, brand: p.brand || DEFAULTS.PART_BRAND, cost: p.cost || 0, date: s.serviceDate, garageName: s.garageName || DEFAULTS.GARAGE_NAME });
      }
    }
  }
  return parts;
}

/** Only the image URL and ids: storage keys, uploader ids and roles stay server-side. */
function toPhotoView(m) {
  return { _id: String(m._id), id: String(m._id), url: m.url, category: m.category, createdAt: m.createdAt || null };
}

function toVehicleView(vehicle, audience, qrCodeUrl) {
  const owner = isOwnerAudience(audience);
  return {
    id: String(vehicle._id),
    vehicleNumber: vehicle.vehicleNumber,
    brand: vehicle.brand,
    model: vehicle.model,
    variant: vehicle.variant,
    year: vehicle.manufacturingYear || vehicle.year,
    fuelType: vehicle.fuelType,
    color: vehicle.color,
    registrationDate: vehicle.registrationDate,
    registeredRTO: vehicle.registeredRTO,
    // Identity numbers enable cloning and fraud; only the owner sees them (the page shows N/A).
    chassisNumber: owner ? vehicle.chassisNumber || null : null,
    engineNumber: owner ? vehicle.engineNumber || null : null,
    currentOdometerKm: vehicle.currentOdometerKm,
    qrCodeUrl: qrCodeUrl || null,
  };
}

function toOwnerContactView(ownerUser, vehicle, audience) {
  const name = (ownerUser && ownerUser.name) || vehicle.ownerName || DEFAULTS.OWNER_NAME;
  if (!isOwnerAudience(audience)) return { name: publicOwnerName(name, DEFAULTS.OWNER_NAME), email: '', phone: '' };
  return { name, email: (ownerUser && ownerUser.email) || '', phone: (ownerUser && ownerUser.phone) || vehicle.phone || '' };
}

function toOwnershipPeriodView(h, audience) {
  const name = h.ownerName || DEFAULTS.HISTORY_OWNER_NAME;
  return {
    id: String(h._id || ''),
    ownerName: isOwnerAudience(audience) ? name : publicOwnerName(name, DEFAULTS.HISTORY_OWNER_NAME),
    fromDate: h.fromDate,
    toDate: h.toDate,
  };
}

/** Insurance rows for the PDF; the public copy never prints the policy number. */
function toInsuranceView(policy, audience, today = new Date()) {
  return {
    provider: policy.provider || '',
    policyNumber: isOwnerAudience(audience) ? policy.policyNumber || '' : 'Hidden',
    startDate: policy.startDate || '',
    expiryDate: policy.expiryDate || '',
    active: new Date(policy.expiryDate) >= today,
  };
}

/** Service row for the PDF log; flags let the renderer mark verified and unconfirmed records. */
function toPdfServiceRow(s) {
  return {
    serviceDate: s.serviceDate,
    serviceType: s.serviceType || DEFAULTS.SERVICE_TYPE,
    garageName: s.garageName || DEFAULTS.GARAGE_NAME,
    serviceCategory: s.serviceCategory || DEFAULTS.SERVICE_CATEGORY,
    totalCost: s.totalCost || s.cost || 0,
    verified: isVerifiedRecord(s),
    unconfirmed: isUnconfirmedWalkIn(s),
  };
}

/** GET /api/passport/:vehicleId body (keys unchanged). */
function toPassportView({ vehicle, records, history, photos, ownerUser, health, qrCodeUrl }, audience) {
  const shown = visibleRecords(records, audience);
  return {
    vehicle: toVehicleView(vehicle, audience, qrCodeUrl),
    vehiclePhotos: photos.map(toPhotoView),
    owner: toOwnerContactView(ownerUser, vehicle, audience),
    healthScore: health.healthScore,
    services: shown.map((s) => toServiceView(s, audience)),
    ownershipHistory: history.map((h) => toOwnershipPeriodView(h, audience)),
    partsReplaced: extractReplacedParts(shown),
  };
}

module.exports = {
  isUnconfirmedWalkIn,
  isVerifiedRecord,
  visibleRecords,
  extractReplacedParts,
  toPassportView,
  toInsuranceView,
  toOwnerContactView,
  toOwnershipPeriodView,
  toVehicleView,
  toPdfServiceRow,
};
