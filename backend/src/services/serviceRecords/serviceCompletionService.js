/**
 * Service completion workflow: a garage (or an admin acting for the booking's garage) finalises a
 * job, which issues a GST invoice and opens a pending payment for the vehicle owner.
 *
 *   resolveCompletionContext -> authorizeCompletion -> (idempotent replay?) -> resolveBillingParties
 *   -> buildInvoiceLines / computeTotals / applyTax (pure) -> persistCompletion (one unit of work)
 *   -> notifyAndAudit (best effort)
 *
 * All collaborators are injected; nothing here calls getDb().
 */
const { ObjectId } = require('mongodb');
const { toObjectId } = require('../../repositories/BaseRepository');
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../core/errors');
const { runInTransaction, withSession } = require('../../core/transaction');
const { toPaise, fromPaise } = require('../../utils/money');
const { PAYMENT_STATUS } = require('../../models/Payment');
const { PAYMENTS } = require('../../core/constants');
const { isOwner } = require('../../security/vehicleAccess');
const { buildInvoiceLines, computeTotals, applyTax } = require('./invoiceCalculator');
const { toCompletionDetailsView } = require('./views');
const { ROLES, DEFAULTS, SERVICE_STATUS, INVOICE_STATUS } = require('./constants');

class CompletionRaceError extends ConflictError {
  constructor() {
    super('This service is already being completed. Please refresh and try again.', 'SERVICE_COMPLETION_IN_PROGRESS');
  }
}

const todayIso = () => new Date().toISOString().split('T')[0];

/** Users were keyed by ObjectId, string _id or a legacy `uid`. */
function userIdFilter(id) {
  const objectId = toObjectId(id);
  return { $or: [...(objectId ? [{ _id: objectId }] : []), { uid: String(id) }, { _id: String(id) }] };
}

function isAlreadyCompleted(service) {
  return Boolean(service && (service.status === SERVICE_STATUS.COMPLETED || service.invoiceStatus === INVOICE_STATUS.FINALIZED) && service.invoiceNumber);
}

function alreadyCompletedResponse(service) {
  const total = service.totalAmount || service.totalCost;
  return {
    success: true,
    message: 'Service is already completed and invoice generated',
    invoiceNumber: service.invoiceNumber,
    grandTotal: total,
    grandTotalPaise: service.grandTotalPaise || toPaise(total || 0),
    status: SERVICE_STATUS.COMPLETED,
  };
}

/** Pure: the service, invoice and payment documents written by one completion. */
function buildCompletionDocuments({ input, user, ctx, parties, lines, totals, taxSnapshot, invoiceNumber, serviceId, at }) {
  const { booking, service, garage } = ctx;
  const { vehicle, customerId, customer } = parties;
  const vehicleId = String(vehicle._id);
  const vehicleNumber = vehicle.vehicleNumber || vehicle.registrationNumber || DEFAULTS.VEHICLE_NUMBER;
  const garageId = garage ? String(garage._id) : null;
  const garageName = (garage && garage.name) || DEFAULTS.GARAGE_NAME;
  const bookingId = booking ? String(booking._id) : null;
  const rawOdometer = input.odometer !== undefined ? input.odometer : (input.odometerKm || vehicle.currentOdometerKm || 0);
  const odometerKm = parseInt(rawOdometer, 10) || 0;
  // Keep the record visible in its garage's listing when an admin completes it on the garage's behalf.
  const createdBy = (service && service.createdBy) || (user.role === ROLES.ADMIN && garage && garage.ownerUserId) || user.id;

  const serviceDoc = {
    vehicleId,
    bookingId,
    serviceDate: input.serviceDate || todayIso(),
    odometerKm,
    serviceCategory: input.serviceCategory || DEFAULTS.SERVICE_CATEGORY,
    serviceType: input.serviceType || (booking && booking.snapshots && booking.snapshots.service && booking.snapshots.service.title) || DEFAULTS.COMPLETION_SERVICE_TYPE,
    mechanicNotes: input.mechanicNotes || '',
    status: SERVICE_STATUS.COMPLETED,
    invoiceNumber,
    invoiceStatus: INVOICE_STATUS.FINALIZED,
    paymentStatus: INVOICE_STATUS.UNPAID,
    partsReplaced: lines.parts,
    laborCharges: lines.labour,
    laborCost: fromPaise(lines.labourPaise),
    additionalCharges: lines.additionalCharges,
    subtotalAmount: totals.subtotalAmount,
    subtotalPaise: totals.subtotalPaise,
    discountAmount: totals.discountAmount,
    discountPaise: totals.discountPaise,
    taxableAmount: totals.taxableAmount,
    taxablePaise: totals.taxablePaise,
    taxSnapshot,
    taxAmount: taxSnapshot.totalTaxAmount,
    taxAmountPaise: taxSnapshot.totalTaxPaise,
    totalCost: totals.grandTotalAmount,
    totalAmount: totals.grandTotalAmount,
    grandTotalPaise: totals.grandTotalPaise,
    warrantyMonths: parseInt(input.warrantyMonths, 10) || 0,
    recommendedKm: parseInt(input.recommendedKm, 10) || 0,
    recommendedDate: input.recommendedDate || '',
    billPhotoUrls: Array.isArray(input.billPhotoUrls) ? input.billPhotoUrls : [],
    garageId,
    garageName,
    ownerId: customerId ? String(customerId) : String(vehicle.ownerId),
    createdBy: String(createdBy),
    completedBy: String(user.id),
    isArchived: false,
    completedAt: at,
    updatedAt: at,
  };

  const invoiceDoc = {
    invoiceNumber,
    serviceId,
    bookingId,
    customerId: customerId ? String(customerId) : '',
    customerName: (customer && customer.name) || DEFAULTS.CUSTOMER_NAME,
    garageId,
    garageName,
    vehicleId,
    vehicleNumber,
    vehicleBrand: vehicle.brand || vehicle.make || '',
    vehicleModel: vehicle.model || '',
    parts: lines.parts,
    labour: lines.labour,
    additionalCharges: lines.additionalCharges,
    subtotalAmount: totals.subtotalAmount,
    subtotalPaise: totals.subtotalPaise,
    discountAmount: totals.discountAmount,
    discountPaise: totals.discountPaise,
    taxSnapshot,
    grandTotalAmount: totals.grandTotalAmount,
    grandTotalPaise: totals.grandTotalPaise,
    status: INVOICE_STATUS.UNPAID,
    paymentStatus: INVOICE_STATUS.UNPAID,
    createdAt: at,
    updatedAt: at,
  };

  const paymentDoc = {
    invoiceId: serviceId,
    invoiceNumber,
    serviceId,
    vehicleId,
    vehicleNumber,
    userId: customerId ? String(customerId) : '',
    garageId,
    garageName,
    serviceType: serviceDoc.serviceType,
    amount: totals.grandTotalAmount,
    amountPaise: totals.grandTotalPaise,
    currency: PAYMENTS.CURRENCY,
    status: PAYMENT_STATUS.PENDING,
    createdAt: at,
    updatedAt: at,
  };

  return { service: serviceDoc, invoice: invoiceDoc, payment: paymentDoc, odometerKm };
}

/**
 * @param {object} deps
 * @param {object} deps.repos repositories from createRepositories(db)
 * @param {import('mongodb').MongoClient|null} [deps.client] for transactions (null => no transaction)
 * @param {(userId: string) => Promise<string[]>} deps.resolveGarageIds
 * @param {(params: object) => Promise<object>} deps.createTaxSnapshot
 * @param {() => Promise<string>} deps.nextInvoiceNumber
 * @param {(entry: object) => Promise<void>} deps.logAudit
 * @param {(userId: string, message: object) => Promise<void>} deps.notifyUser
 */
function createServiceCompletionService(deps) {
  const { repos, client = null, resolveGarageIds, createTaxSnapshot, nextInvoiceNumber, logAudit, notifyUser, logger = console, now = () => new Date() } = deps;

  async function resolveActingGarage(user, booking, service) {
    const own = await repos.garages.findOne({ ownerUserId: String(user.id), isActive: { $ne: false } });
    if (!own && user.role === ROLES.GARAGE) {
      // An admin-suspended garage must not keep issuing invoices (previously it could, with garageId null).
      const suspended = await repos.garages.findOne({ ownerUserId: String(user.id), isActive: false });
      if (suspended) throw new ForbiddenError('Forbidden: This garage is suspended and cannot complete services');
    }
    if (own || user.role !== ROLES.ADMIN) return own;
    // Admins act on behalf of the booking's (or the record's) garage, never an arbitrary one.
    const ref = (booking && booking.garageId) || (service && service.garageId);
    if (!ref) return null;
    const objectId = toObjectId(ref);
    return repos.garages.findOne(objectId ? { $or: [{ _id: objectId }, { ownerUserId: String(ref) }] } : { ownerUserId: String(ref) });
  }

  async function resolveCompletionContext(input, user) {
    const booking = input.bookingId ? await repos.bookings.findById(input.bookingId) : null;
    let service = input.serviceId ? await repos.serviceRecords.findById(input.serviceId) : null;
    // A booking that was already invoiced replays its existing invoice instead of issuing a second one.
    if (!service && booking && booking.invoiceNumber && booking.serviceId) {
      service = await repos.serviceRecords.findById(booking.serviceId);
    }
    const garage = await resolveActingGarage(user, booking, service);
    return { booking, service, garage };
  }

  /** Garages may complete only their own bookings/records; admins may complete any. */
  async function authorizeCompletion(user, { booking, service }) {
    if (user.role !== ROLES.GARAGE) return;
    const myGarageIds = await resolveGarageIds(user.id);
    const mine = (id) => id !== undefined && id !== null && id !== '' && myGarageIds.includes(String(id));
    if (booking && !mine(booking.garageId)) {
      throw new ForbiddenError('Forbidden: This booking belongs to another garage');
    }
    if (service && (service.createdBy || service.garageId) && !mine(service.createdBy) && !mine(service.garageId)) {
      throw new ForbiddenError('Forbidden: This service record belongs to another garage');
    }
  }

  /** The vehicle comes from the booking/record when there is one; a different client vehicleId is rejected. */
  async function resolveBillingParties(input, { booking, service }) {
    const linkedVehicleId = (service && service.vehicleId) || (booking && booking.vehicleId);
    if (input.vehicleId && linkedVehicleId && String(input.vehicleId) !== String(linkedVehicleId)) {
      throw new ValidationError('Vehicle does not match the booking or service record');
    }
    const vehicleId = linkedVehicleId || input.vehicleId;
    if (!vehicleId) throw new ValidationError('Valid vehicle ID is required');
    const vehicle = await repos.vehicles.findById(vehicleId);
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    const customerId = vehicle.ownerId || (booking && booking.userId) || (service && service.ownerId);
    const customer = customerId ? await repos.users.findOne(userIdFilter(customerId)) : null;
    return { vehicle, customerId, customer };
  }

  /** All completion writes as one unit of work (a real transaction on replica sets). */
  function persistCompletion({ ctx, parties, docs, invoiceNumber, serviceObjectId, at }) {
    return runInTransaction(client, async (session) => {
      let claimedBooking = false;
      try {
        if (ctx.booking) {
          claimedBooking = await repos.bookings.markCompleted(ctx.booking._id, { serviceId: String(serviceObjectId), invoiceNumber, by: ROLES.GARAGE, at }, { session });
          if (!claimedBooking) throw new CompletionRaceError();
        }
        if (ctx.service) {
          if (!(await repos.serviceRecords.completeExisting(ctx.service._id, docs.service, { session }))) throw new CompletionRaceError();
        } else {
          await repos.serviceRecords.insertRecord({ _id: serviceObjectId, ...docs.service, createdAt: at }, { session });
        }
        if (docs.odometerKm > (parties.vehicle.currentOdometerKm || 0)) {
          await repos.vehicles.raiseOdometer(parties.vehicle._id, docs.odometerKm, { session });
        }
        await repos.serviceRecords.upsertInvoice(invoiceNumber, docs.invoice, { session });
        await repos.payments.updateOne({ invoiceNumber }, { $set: docs.payment }, withSession(session, { upsert: true }));
      } catch (err) {
        // Without a transaction, undo the booking claim so the garage can retry the completion.
        if (!session && claimedBooking) {
          await repos.bookings.releaseCompletionClaim(ctx.booking, { invoiceNumber, at }).catch(() => {});
        }
        throw err;
      }
    });
  }

  /** Side effects that must never fail a completed invoice. */
  async function notifyAndAudit({ user, req, serviceId, invoiceNumber, totals, taxSnapshot, parties }) {
    try {
      const base = { actorId: String(user.id), actorRole: user.role, req };
      await logAudit({ ...base, action: 'SERVICE_COMPLETED', resourceType: 'SERVICE', resourceId: serviceId, afterState: { invoiceNumber, grandTotal: totals.grandTotalAmount, grandTotalPaise: totals.grandTotalPaise } });
      await logAudit({ ...base, action: 'INVOICE_FINALIZED', resourceType: 'INVOICE', resourceId: invoiceNumber, afterState: { invoiceNumber, subtotalAmount: totals.subtotalAmount, grandTotalAmount: totals.grandTotalAmount, taxSnapshot } });
    } catch (err) {
      logger.warn('Audit logging warning:', err.message);
    }

    const { vehicle, customerId } = parties;
    if (!customerId) return;
    try {
      await notifyUser(String(customerId), {
        title: '🔔 Service Completed',
        body: `Your ${vehicle.brand || vehicle.make || 'vehicle'} (${vehicle.vehicleNumber || 'Vehicle'}) service is completed. Invoice ${invoiceNumber} for ₹${totals.grandTotalAmount.toFixed(2)} is ready for payment.`,
        data: { type: 'SERVICE_COMPLETED', invoiceId: serviceId, serviceId, invoiceNumber, vehicleId: String(vehicle._id), amount: totals.grandTotalAmount, url: DEFAULTS.PAYMENTS_URL },
      });
    } catch (err) {
      logger.warn('Customer notification warning:', err.message);
    }
  }

  async function replayAfterRace(input, user, raceError) {
    const { service } = await resolveCompletionContext(input, user);
    if (isAlreadyCompleted(service)) return alreadyCompletedResponse(service);
    throw raceError;
  }

  /**
   * @param {{ user: object, input: object, req?: object }} args input is the request body plus serviceId
   * @returns {Promise<object>} the HTTP 200 response body
   */
  async function completeService({ user, input = {}, req = null }) {
    if (user.role !== ROLES.GARAGE && user.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Forbidden: Only authorized garages can complete services');
    }
    const ctx = await resolveCompletionContext(input, user);
    await authorizeCompletion(user, ctx);
    if (isAlreadyCompleted(ctx.service)) return alreadyCompletedResponse(ctx.service);

    const parties = await resolveBillingParties(input, ctx);
    const lines = buildInvoiceLines(input);
    const preTax = computeTotals(lines, input);
    const taxSnapshot = await createTaxSnapshot({
      amountPaise: preTax.taxablePaise,
      sellerState: (ctx.garage && ctx.garage.stateCode) || DEFAULTS.STATE_CODE,
      buyerState: parties.vehicle.stateCode || DEFAULTS.STATE_CODE,
      sellerGstin: (ctx.garage && ctx.garage.gstin) || null,
      buyerGstin: parties.vehicle.gstin || null,
      serviceCategory: input.serviceCategory || DEFAULTS.TAX_SERVICE_CATEGORY,
    });
    const totals = applyTax(preTax, taxSnapshot);

    const invoiceNumber = await nextInvoiceNumber();
    const serviceObjectId = ctx.service ? ctx.service._id : new ObjectId();
    const serviceId = String(serviceObjectId);
    const at = now();
    const docs = buildCompletionDocuments({ input, user, ctx, parties, lines, totals, taxSnapshot, invoiceNumber, serviceId, at });

    try {
      await persistCompletion({ ctx, parties, docs, invoiceNumber, serviceObjectId, at });
    } catch (err) {
      if (err instanceof CompletionRaceError) return replayAfterRace(input, user, err);
      throw err;
    }

    await notifyAndAudit({ user, req, serviceId, invoiceNumber, totals, taxSnapshot, parties });
    return {
      success: true,
      message: 'Service completed and invoice generated successfully',
      invoiceNumber,
      serviceId,
      subtotal: totals.subtotalAmount,
      tax: taxSnapshot.totalTaxAmount,
      grandTotal: totals.grandTotalAmount,
      grandTotalPaise: totals.grandTotalPaise,
      taxSnapshot,
      paymentStatus: INVOICE_STATUS.UNPAID,
      status: SERVICE_STATUS.COMPLETED,
    };
  }

  /** Owners of the booking/vehicle, the booking's garage and admins may read the prefill. */
  async function authorizeDetailsAccess(user, ctx, vehicle) {
    if (user.role === ROLES.ADMIN) return;
    if (user.role === ROLES.GARAGE) {
      await authorizeCompletion(user, ctx);
      return;
    }
    if (!ctx.booking && !ctx.service) return;
    const related = [ctx.booking && ctx.booking.userId, ctx.service && ctx.service.ownerId].filter(Boolean).map(String).includes(String(user.id));
    if (!related && !isOwner(user, vehicle)) throw new ForbiddenError('Forbidden: You are not allowed to view this booking');
  }

  async function getCompletionDetails(user, { bookingId, serviceId } = {}) {
    if (!bookingId && !serviceId) throw new ValidationError('bookingId or serviceId is required');
    const booking = bookingId ? await repos.bookings.findById(bookingId) : null;
    const service = serviceId ? await repos.serviceRecords.findById(serviceId) : null;
    const vehicleId = (booking && booking.vehicleId) || (service && service.vehicleId);
    const vehicle = vehicleId ? await repos.vehicles.findById(vehicleId) : null;
    await authorizeDetailsAccess(user, { booking, service }, vehicle);

    let garage = user.role === ROLES.GARAGE ? await repos.garages.findOne({ ownerUserId: String(user.id), isActive: { $ne: false } }) : null;
    if (!garage && booking && booking.garageId) garage = await repos.garages.findById(booking.garageId);
    const customerId = (booking && booking.userId) || (service && service.ownerId) || (vehicle && vehicle.ownerId);
    const customer = customerId ? await repos.users.findOne(userIdFilter(customerId)) : null;
    return toCompletionDetailsView({ booking, service, vehicle, customer, garage, vehicleId, customerId });
  }

  return {
    completeService,
    getCompletionDetails,
    // Exposed for unit tests of the individual steps.
    steps: { resolveCompletionContext, authorizeCompletion, resolveBillingParties, persistCompletion, notifyAndAudit },
  };
}

module.exports = {
  createServiceCompletionService,
  buildCompletionDocuments,
  isAlreadyCompleted,
  alreadyCompletedResponse,
  CompletionRaceError,
};
