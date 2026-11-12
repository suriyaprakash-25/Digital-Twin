/**
 * Ownership timeline of a vehicle (GET /api/ownership/history/:vehicleId, a public endpoint).
 * The current owner and admins see user ids and full names; everyone else sees short names only.
 */
const { toObjectId } = require('../../repositories/BaseRepository');
const { ValidationError, NotFoundError } = require('../../core/errors');
const { MSG } = require('./constants');
const { AUDIENCE, fallbackHistoryEntry, toHistoryEntryView } = require('./presenters');

const ADMIN_ROLE = 'ADMIN';

/** 'owner' for the vehicle's owner or an admin, otherwise 'public' (including anonymous viewers). */
function audienceFor(viewer, vehicle, isOwner) {
  if (viewer && (viewer.role === ADMIN_ROLE || isOwner(viewer, vehicle))) return AUDIENCE.OWNER;
  return AUDIENCE.PUBLIC;
}

function createOwnershipHistoryService({ repos, isOwner }) {
  async function getHistory(viewer, vehicleId) {
    const vehicleObjectId = toObjectId(vehicleId);
    if (!vehicleObjectId) throw new ValidationError(MSG.INVALID_VEHICLE_ID);
    const vehicle = await repos.vehicles.findActiveById(vehicleObjectId);
    if (!vehicle) throw new NotFoundError(MSG.VEHICLE_NOT_FOUND);

    const audience = audienceFor(viewer, vehicle, isOwner);
    const canonicalId = String(vehicleObjectId);
    const history = await repos.ownershipHistory.listForVehicle([canonicalId]);
    const entries = history.length > 0 ? history : [fallbackHistoryEntry(vehicle, canonicalId)];
    return entries.map((entry) => toHistoryEntryView(entry, audience));
  }

  return { getHistory };
}

module.exports = { createOwnershipHistoryService, audienceFor };
