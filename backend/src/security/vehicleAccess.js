/**
 * Vehicle access policy (Policy object; single source of truth for "who may see this vehicle").
 *
 *  - ADMIN: every vehicle.
 *  - Owner: their own vehicles.
 *  - GARAGE: only vehicles it has a business relationship with (a booking with the garage, or a
 *    service record it created). Garages previously could list EVERY vehicle with owner PII and
 *    document links simply by self-registering as a garage.
 */
const { resolveGarageIds } = require('../utils/garageResolver');

const ROLES = Object.freeze({ ADMIN: 'ADMIN', GARAGE: 'GARAGE' });

// A garage's own unconfirmed walk-in record must NOT create a relationship, otherwise logging one
// fake walk-in would grant that garage the vehicle's full history.
const CONFIRMED_SERVICE = { requiresOwnerConfirmation: { $ne: true } };

function isOwner(user, vehicle) {
  return Boolean(user && vehicle) && [vehicle.ownerId, vehicle.userId].filter(Boolean).map(String).includes(String(user.id));
}

/** Vehicle ids (as strings) the garage user has serviced or been booked for. */
async function garageRelatedVehicleIds(db, garageUserId) {
  const garageIds = await resolveGarageIds(garageUserId, db);
  const [bookingIds, serviceIds] = await Promise.all([
    db.collection('bookings').distinct('vehicleId', { garageId: { $in: garageIds } }),
    db.collection('services').distinct('vehicleId', { ...CONFIRMED_SERVICE, $or: [{ createdBy: { $in: garageIds } }, { garageId: { $in: garageIds } }] }),
  ]);
  return [...new Set([...bookingIds, ...serviceIds].filter(Boolean).map(String))];
}

async function garageHasRelationship(db, garageUserId, vehicleId) {
  const garageIds = await resolveGarageIds(garageUserId, db);
  const id = String(vehicleId);
  const [booking, service] = await Promise.all([
    db.collection('bookings').findOne({ garageId: { $in: garageIds }, vehicleId: id }, { projection: { _id: 1 } }),
    db.collection('services').findOne({ vehicleId: id, ...CONFIRMED_SERVICE, $or: [{ createdBy: { $in: garageIds } }, { garageId: { $in: garageIds } }] }, { projection: { _id: 1 } }),
  ]);
  return Boolean(booking || service);
}

async function canAccessVehicle(db, user, vehicle) {
  if (!user || !vehicle) return false;
  if (user.role === ROLES.ADMIN || isOwner(user, vehicle)) return true;
  if (user.role === ROLES.GARAGE) return garageHasRelationship(db, user.id, vehicle._id);
  return false;
}

/**
 * Field-level projection of a vehicle for a given audience (Extract Method; was duplicated).
 * Garages never receive purchase details or identity documents.
 */
function toVehicleView(v, { audience = 'owner' } = {}) {
  const view = {
    id: String(v._id),
    vehicleNumber: v.vehicleNumber,
    brand: v.brand,
    model: v.model,
    variant: v.variant,
    vehicleType: v.vehicleType,
    year: v.manufacturingYear || v.year,
    fuelType: v.fuelType,
    color: v.color,
    registrationDate: v.registrationDate,
    registeredRTO: v.registeredRTO,
    ownerName: v.ownerName,
    phone: v.phone,
    ownershipCount: v.ownershipCount,
    insuranceProvider: v.insuranceProvider,
    insuranceExpiry: v.insuranceExpiry,
    pucExpiry: v.pucExpiry,
    rcExpiry: v.rcExpiry,
    roadTaxValidTill: v.roadTaxValidTill,
    fitnessExpiry: v.fitnessExpiry,
    chassisNumber: v.chassisNumber,
    engineNumber: v.engineNumber,
    currentOdometerKm: v.currentOdometerKm,
    averageMonthlyKm: v.averageMonthlyKm,
    ownerId: v.ownerId,
    verificationStatus: v.verificationStatus || 'Pending',
    isArchived: v.isArchived || false,
    createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : null,
  };
  if (audience !== 'garage') {
    view.purchaseDate = v.purchaseDate;
    view.purchasePrice = v.purchasePrice;
    view.rcBookUrl = v.rcBookUrl;
    view.insuranceDocumentUrl = v.insuranceDocumentUrl;
  }
  return view;
}

/** Minimal, PII-free identification used for exact-number lookups by garages (walk-ins). */
function toVehicleLookupView(v) {
  return { id: String(v._id), vehicleNumber: v.vehicleNumber, brand: v.brand, model: v.model, variant: v.variant, fuelType: v.fuelType, year: v.manufacturingYear || v.year, lookupOnly: true };
}

module.exports = { canAccessVehicle, garageRelatedVehicleIds, garageHasRelationship, toVehicleView, toVehicleLookupView, isOwner };
