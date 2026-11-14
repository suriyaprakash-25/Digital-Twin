/**
 * Service-record use cases: log a record, list a garage's records, read a vehicle's history and
 * delete a record. Dependencies are injected (repositories + access policy), so this module never
 * touches getDb() and can be unit-tested with fakes.
 */
const { toObjectId } = require('../../repositories/BaseRepository');
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../core/errors');
const { parsePagination } = require('../../core/pagination');
const { safeSearchRegex, asString } = require('../../core/text');
const { ODOMETER, CONFIDENCE_SCORE, VERIFICATION_STATUS, ROLES, GARAGE_LISTING } = require('./constants');
const { toGarageListView, toHistoryView } = require('./views');

const isBlank = (value) => value === undefined || value === null || value === '';
const numberOr = (raw, fallback) => (Number.isNaN(parseFloat(raw)) ? fallback : parseFloat(raw));

/** Legacy pre-invoice cost: sum of part costs plus labour (rupees, as stored before paise invoicing). */
function legacyRecordCost(partsReplaced, laborCost) {
  const partsCost = partsReplaced.reduce((sum, part) => sum + numberOr(part && part.cost, 0), 0);
  return { laborCost: numberOr(laborCost, 0.0), totalCost: partsCost + numberOr(laborCost, 0.0) };
}

/**
 * Verification rule: only a garage with a real booking/service relationship produces a verified
 * record. Unrelated (walk-in) garage records need owner confirmation; owners never self-verify.
 */
function verificationFor({ isGarage, garageRelated }) {
  const verified = isGarage && garageRelated;
  return {
    verifiedService: verified,
    verificationStatus: verified ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PENDING,
    requiresOwnerConfirmation: isGarage && !garageRelated,
  };
}

/** @returns {{ abnormalKmJump: boolean }} throws ValidationError on an odometer regression */
function checkOdometer(odometerKm, baseline) {
  if (!baseline) return { abnormalKmJump: false };
  const lastKm = parseInt(baseline.odometerKm || 0, 10);
  if (odometerKm < lastKm) {
    throw new ValidationError(`Odometer reading (${odometerKm} km) cannot be less than previous record (${lastKm} km)`);
  }
  return { abnormalKmJump: odometerKm - lastKm > ODOMETER.ABNORMAL_JUMP_KM };
}

function parseAddInput(data) {
  const { vehicleId, serviceDate, odometerKm, serviceCategory, serviceType } = data;
  if (!vehicleId || !serviceDate || isBlank(odometerKm) || !serviceCategory || !serviceType) {
    throw new ValidationError('Core details (vehicle, date, odometer, category, type) are required');
  }
  const km = parseInt(odometerKm, 10);
  if (Number.isNaN(km)) throw new ValidationError('Odometer reading must be a valid number');
  if (!toObjectId(vehicleId)) throw new ValidationError('Invalid vehicle ID');
  return { vehicleId: String(vehicleId), serviceDate, odometerKm: km, serviceCategory, serviceType };
}

/**
 * @param {{ repos: object, accessPolicy: { canAccessVehicle: Function, garageHasRelationship: Function, isOwner: Function }, now?: () => Date }} deps
 */
function createServiceRecordService({ repos, accessPolicy, now = () => new Date() }) {
  async function addRecord(user, data = {}) {
    const input = parseAddInput(data);
    const vehicle = await repos.vehicles.findActiveById(input.vehicleId);
    if (!vehicle) throw new NotFoundError('Vehicle not found or unauthorized');

    const isGarage = user.role === ROLES.GARAGE;
    if (!isGarage && user.role !== ROLES.ADMIN && !accessPolicy.isOwner(user, vehicle)) {
      throw new ForbiddenError('Unauthorized to add service to this vehicle');
    }
    const garageRelated = isGarage ? await accessPolicy.garageHasRelationship(user.id, vehicle._id) : false;
    const verification = verificationFor({ isGarage, garageRelated });

    const { abnormalKmJump } = checkOdometer(input.odometerKm, await repos.serviceRecords.findOdometerBaseline(input.vehicleId));
    const partsReplaced = Array.isArray(data.partsReplaced) ? data.partsReplaced : [];
    const { laborCost, totalCost } = legacyRecordCost(partsReplaced, data.laborCost);

    const record = {
      ...input,
      partsReplaced,
      laborCost,
      totalCost,
      warrantyMonths: data.warrantyMonths,
      mechanicNotes: data.mechanicNotes,
      garageName: data.garageName,
      location: data.location,
      verifiedService: verification.verifiedService,
      recommendedKm: data.recommendedKm,
      recommendedDate: data.recommendedDate,
      billPhotoUrls: Array.isArray(data.billPhotoUrls) ? data.billPhotoUrls : [],
      abnormalKmJump,
      confidenceScore: abnormalKmJump ? CONFIDENCE_SCORE.ABNORMAL_ODOMETER_JUMP : CONFIDENCE_SCORE.NORMAL,
      ownerId: String(vehicle.ownerId),
      createdBy: user.id,
      role: user.role || ROLES.DEFAULT_RECORD_ROLE,
      verificationStatus: verification.verificationStatus,
      requiresOwnerConfirmation: verification.requiresOwnerConfirmation,
      isArchived: false,
      createdAt: now(),
    };

    const result = await repos.serviceRecords.insertRecord(record);
    // An unconfirmed walk-in record must not change the owner's vehicle until the owner confirms it.
    if (!verification.requiresOwnerConfirmation && input.odometerKm > (vehicle.currentOdometerKm || 0)) {
      await repos.vehicles.raiseOdometer(vehicle._id, input.odometerKm);
    }
    return { serviceId: result.insertedId };
  }

  async function listGarageServices(user, query = {}) {
    if (user.role !== ROLES.GARAGE) throw new ForbiddenError('Unauthorized: Only garages can access this endpoint');
    const page = parsePagination(query, { defaultLimit: GARAGE_LISTING.DEFAULT_LIMIT, maxLimit: GARAGE_LISTING.MAX_LIMIT });
    const category = asString(query.category) || 'ALL';
    const order = asString(query.sortOrder) === 'asc' ? 1 : -1;
    const createdBy = String(user.id);

    const [{ items, total }, stats] = await Promise.all([
      repos.serviceRecords.listForGarage({
        createdBy,
        category: category === 'ALL' ? null : category,
        searchRegex: safeSearchRegex(asString(query.search)),
        sort: asString(query.sortBy) === 'cost' ? { totalCost: order } : { serviceDate: order },
        skip: page.skip,
        limit: page.limit,
      }),
      repos.serviceRecords.garageTotals(createdBy),
    ]);

    return {
      body: {
        services: items.map(toGarageListView),
        totalCount: total,
        totalPages: Math.ceil(total / page.limit),
        currentPage: page.page,
        stats,
      },
      pagination: { total, page: page.page, limit: page.limit },
    };
  }

  async function getVehicleHistory(user, vehicleId) {
    const vehicle = await repos.vehicles.findActiveById(vehicleId);
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    if (!(await accessPolicy.canAccessVehicle(user, vehicle))) {
      throw new ForbiddenError('Unauthorized to view service history for this vehicle');
    }
    const records = await repos.serviceRecords.findHistoryForVehicle(vehicleId);
    return records.map(toHistoryView);
  }

  async function deleteRecord(user, serviceId) {
    const serviceObjectId = toObjectId(serviceId);
    const service = serviceObjectId ? await repos.serviceRecords.findOne({ _id: serviceObjectId }) : null;
    if (!service) throw new NotFoundError('Service record not found');

    const vehicle = await repos.vehicles.findById(service.vehicleId);
    if (!vehicle || !accessPolicy.isOwner(user, vehicle)) throw new ForbiddenError('Unauthorized: You do not own this vehicle');
    // A garage-issued invoice is a financial record referenced by its payment; it cannot be erased.
    if (service.invoiceNumber) throw new ConflictError('Invoiced service records cannot be deleted', 'SERVICE_INVOICED');

    await repos.serviceRecords.deleteById(service._id);
  }

  return { addRecord, listGarageServices, getVehicleHistory, deleteRecord };
}

module.exports = { createServiceRecordService, checkOdometer, verificationFor, legacyRecordCost };
