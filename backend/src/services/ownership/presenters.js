/**
 * Pure response mappers and privacy helpers for ownership data. They keep the JSON shapes the
 * React pages (UserDashboard pending transfers, the passport timeline) already consume.
 */
const { DEFAULT_NAMES, LEGACY_HISTORY_EPOCH } = require('./constants');

const AUDIENCE = Object.freeze({ OWNER: 'owner', PUBLIC: 'public' });

/**
 * Display name safe for anonymous viewers: first name plus last initial ("Ravi Kumar" -> "Ravi K.").
 * Full names of current and past owners keyed by a (partly predictable) vehicle id would otherwise
 * let anyone harvest a name for every number plate.
 */
function publicOwnerName(name, fallback) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Synthetic first entry for vehicles created before ownership history was recorded. */
function fallbackHistoryEntry(vehicle, vehicleId) {
  const fromDate = vehicle.purchaseDate
    ? new Date(vehicle.purchaseDate).toISOString()
    : vehicle.createdAt || LEGACY_HISTORY_EPOCH.toISOString();
  return {
    vehicleId: String(vehicleId),
    ownerId: vehicle.ownerId,
    ownerName: vehicle.ownerName || DEFAULT_NAMES.ORIGINAL_OWNER,
    fromDate,
    toDate: null,
  };
}

/** GET /api/ownership/history/:vehicleId row. Anonymous viewers get no user ids and short names. */
function toHistoryEntryView(entry, audience) {
  const isPublic = audience !== AUDIENCE.OWNER;
  const view = {
    vehicleId: entry.vehicleId,
    ownerId: isPublic ? null : entry.ownerId,
    ownerName: isPublic ? publicOwnerName(entry.ownerName, DEFAULT_NAMES.ORIGINAL_OWNER) : entry.ownerName,
    fromDate: entry.fromDate,
    toDate: entry.toDate,
  };
  return entry._id ? { id: String(entry._id), ...view } : view;
}

function toPendingVehicleView(vehicle) {
  if (!vehicle) return null;
  return { brand: vehicle.brand, model: vehicle.model, year: vehicle.year || vehicle.manufacturingYear, vehicleNumber: vehicle.vehicleNumber };
}

/** GET /api/ownership/pending row (shape unchanged). */
function toPendingTransferView(transfer, vehicle) {
  return {
    id: String(transfer._id),
    vehicleId: transfer.vehicleId,
    sellerId: transfer.sellerId,
    sellerName: transfer.sellerName,
    buyerId: transfer.buyerId,
    buyerEmail: transfer.buyerEmail,
    createdAt: transfer.createdAt,
    vehicle: toPendingVehicleView(vehicle),
  };
}

function vehicleLabel(vehicle) {
  return `${vehicle.brand} ${vehicle.model} (${vehicle.vehicleNumber})`;
}

module.exports = {
  AUDIENCE,
  publicOwnerName,
  fallbackHistoryEntry,
  toHistoryEntryView,
  toPendingTransferView,
  vehicleLabel,
};
