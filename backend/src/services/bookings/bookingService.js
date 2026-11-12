/**
 * Booking use cases: an owner requests a booking, both sides list theirs, and status changes flow
 * through the booking state machine (bookingStateMachine.transitionBooking).
 *
 * Collaborators (repositories, notifier, capacity guard, clock) are injected; the service never
 * calls getDb() and is unit-tested with fakes.
 */
const { ValidationError, NotFoundError } = require('../../core/errors');
const { parsePagination } = require('../../core/pagination');
const { idValues, toObjectId } = require('../../repositories/BaseRepository');
const { asString } = require('../../core/text');
const { PAGE_DEFAULTS, LIMITS, CUSTOM_ISSUE_SERVICE, DEFAULT_NAMES, MSG } = require('./constants');
const { BOOKING_STATUS: S, ACTORS, ACTOR_TARGETS, consumesCapacity, assertTransition, transitionBooking } = require('./bookingStateMachine');
const { toOwnerBookingView, toGarageBookingView } = require('./presenters');

const CUSTOMER_PROJECTION = Object.freeze({ name: 1, email: 1, phone: 1, uid: 1, photoUrl: 1 });

function parseSchedule(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(MSG.INVALID_SCHEDULE);
  return date;
}

/** Custom-issue details are stored as bounded strings only (previously the raw client object). */
function sanitizeIssueDetails(details) {
  if (!details || typeof details !== 'object') return null;
  const field = (key) => asString(details[key], { maxLength: LIMITS.ISSUE_FIELD_MAX_LENGTH });
  return { description: field('description'), duration: field('duration'), urgency: field('urgency') };
}

function requireMessage(message) {
  const text = asString(message, { maxLength: LIMITS.MESSAGE_MAX_LENGTH });
  if (!text) throw new ValidationError(MSG.MESSAGE_REQUIRED);
  return text;
}

function buildBookingDoc({ user, garage, vehicle, service, isCustomIssue, scheduled, notes, at }) {
  return {
    userId: String(user.id),
    garageId: garage._id,
    serviceId: service._id,
    vehicleId: vehicle._id,
    isCustomIssue,
    scheduledFor: scheduled,
    notes,
    status: S.REQUESTED,
    timeline: [{ status: S.REQUESTED, at, by: ACTORS.USER }],
    snapshots: {
      garage: { name: garage.name, phone: garage.phone, address: garage.address, city: garage.city },
      service: { title: service.title, price: service.price, durationMins: service.durationMins, isCustomIssue: service.isCustomIssue, issueDetails: service.issueDetails },
      vehicle: { vehicleNumber: vehicle.vehicleNumber, brand: vehicle.brand, model: vehicle.model },
      user: { name: user.name || DEFAULT_NAMES.OWNER, phone: user.phone || '', email: user.email || '' },
    },
    createdAt: at,
    updatedAt: at,
  };
}

function createBookingService({ repos, notifier, capacity, now = () => new Date() }) {
  const { bookings, garages, garageServices, vehicles, users } = repos;

  async function requireOwnGarage(userId) {
    const garage = await garages.findByOwner(userId, { activeOnly: true });
    if (!garage) throw new ValidationError(MSG.CREATE_PROFILE_FIRST);
    return garage;
  }

  /** The caller's own, non-archived vehicle (another owner's vehicle is indistinguishable from a missing one). */
  function findOwnVehicle(vehicleId, userId) {
    const _id = toObjectId(vehicleId);
    return _id ? vehicles.findOne({ _id, ownerId: { $in: idValues(userId) }, isArchived: { $ne: true } }) : null;
  }

  /** POST /api/bookings → { id } */
  async function createBooking(user, body = {}) {
    const { garageId, serviceId, vehicleId, scheduledFor, notes, issueDetails } = body;
    const isCustomIssue = body.isCustomIssue === true || body.isCustomIssue === 'true';
    if (!garageId || !vehicleId) throw new ValidationError(MSG.GARAGE_AND_VEHICLE_REQUIRED);
    if (!serviceId && !isCustomIssue) throw new ValidationError(MSG.SERVICE_OR_CUSTOM_REQUIRED);
    const scheduled = parseSchedule(scheduledFor);

    const garage = await garages.findActiveById(garageId);
    const [catalogueItem, vehicle] = await Promise.all([
      serviceId && !isCustomIssue && garage ? garageServices.findBookable(serviceId, garage._id) : null,
      findOwnVehicle(vehicleId, user.id),
    ]);
    if (!garage) throw new NotFoundError(MSG.GARAGE_NOT_FOUND);
    if (serviceId && !isCustomIssue && !catalogueItem) throw new NotFoundError(MSG.SERVICE_NOT_FOUND);
    if (!vehicle) throw new NotFoundError(MSG.VEHICLE_NOT_FOUND);
    if (!(await capacity.hasFreeSlot(garage))) throw new ValidationError(MSG.NO_SLOTS);

    const service = isCustomIssue
      ? { _id: null, ...CUSTOM_ISSUE_SERVICE, isCustomIssue: true, issueDetails: sanitizeIssueDetails(issueDetails) }
      : catalogueItem;
    const doc = buildBookingDoc({
      user, garage, vehicle, service, isCustomIssue, scheduled,
      notes: asString(notes, { maxLength: LIMITS.NOTES_MAX_LENGTH }),
      at: now(),
    });
    const result = await bookings.create(doc);
    const booking = { ...doc, _id: result.insertedId };
    notifier.bookingRequested({ booking, garage, vehicle, service, customer: doc.snapshots.user });
    return { id: String(result.insertedId) };
  }

  /** GET /api/bookings/my */
  async function listMine(userId, query) {
    const page = parsePagination(query, { defaultLimit: PAGE_DEFAULTS.OWNER_LIMIT });
    const { items, total } = await bookings.findPageForUser(userId, page);
    return { body: items.map(toOwnerBookingView), pagination: { total, page: page.page, limit: page.limit } };
  }

  /** Contact fields only: never whole user documents (password hashes). */
  async function loadCustomers(docs) {
    const ids = [...new Set(docs.map((b) => b.userId).filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const objectIds = ids.flatMap((id) => idValues(id).filter((v) => typeof v !== 'string'));
    const found = await users.find({ $or: [{ _id: { $in: objectIds } }, { uid: { $in: ids } }] }, { projection: CUSTOMER_PROJECTION });
    const map = new Map();
    found.forEach((u) => {
      if (u._id) map.set(String(u._id), u);
      if (u.uid) map.set(String(u.uid), u);
    });
    return map;
  }

  /** GET /api/bookings/garage */
  async function listForGarage(userId, query) {
    const garage = await requireOwnGarage(userId);
    const page = parsePagination(query, { defaultLimit: PAGE_DEFAULTS.GARAGE_LIMIT });
    const { items, total } = await bookings.findPageForGarage(garage._id, page);
    const customers = await loadCustomers(items);
    return { body: items.map((b) => toGarageBookingView(b, customers)), pagination: { total, page: page.page, limit: page.limit } };
  }

  async function garageTransition(userId, bookingId, to, { message } = {}) {
    const garage = await requireOwnGarage(userId);
    // Scoped to the caller's garage: another garage's booking is a 404, never an update.
    const booking = await bookings.findOwnedByGarage(bookingId, garage._id);
    if (!booking) throw new NotFoundError(MSG.BOOKING_NOT_FOUND);
    const from = assertTransition(booking, to, ACTORS.GARAGE);
    const apply = () => transitionBooking({ bookings, booking, to, actor: ACTORS.GARAGE, message, now });
    const updated = consumesCapacity(from, to) ? await capacity.withReservedSlot(garage, apply) : await apply();
    return { booking: updated };
  }

  /** PATCH /:id/status by the booking's garage. */
  async function updateStatusByGarage(userId, bookingId, status) {
    const to = String(status || '').toUpperCase();
    if (!ACTOR_TARGETS[ACTORS.GARAGE].includes(to)) throw new ValidationError(MSG.INVALID_STATUS);
    const { booking } = await garageTransition(userId, bookingId, to);
    await notifier.statusChanged(booking, to);
  }

  /** PATCH /:id/request-info by the booking's garage. */
  async function requestInfo(userId, bookingId, message) {
    const text = requireMessage(message);
    const { booking } = await garageTransition(userId, bookingId, S.MORE_INFO_REQUIRED, { message: text });
    await notifier.statusChanged(booking, S.MORE_INFO_REQUIRED, {
      title: 'More Information Required',
      body: 'The garage requested more info regarding your Custom Issue.',
    });
  }

  async function ownerTransition(userId, bookingId, to, { message, notification }) {
    const booking = await bookings.findOwnedByUser(bookingId, userId);
    if (!booking) throw new NotFoundError(MSG.BOOKING_NOT_FOUND);
    const updated = await transitionBooking({ bookings, booking, to, actor: ACTORS.USER, message, now });
    await notifier.notifyGarageOfOwnerAction(updated, to, notification).catch((err) => console.warn('Garage notification failed:', err.message));
    return updated;
  }

  /** PATCH /:id/provide-info by the owner: only answers an open MORE_INFO_REQUIRED request. */
  async function provideInfo(userId, bookingId, message) {
    const text = requireMessage(message);
    return ownerTransition(userId, bookingId, S.REQUESTED, {
      message: text,
      notification: { title: 'Customer Provided Info', body: 'The customer provided the requested info for their Custom Issue.' },
    });
  }

  /** PATCH /:id/cancel by the owner (before work starts). */
  async function cancelByOwner(userId, bookingId, reason) {
    return ownerTransition(userId, bookingId, S.CANCELLED, {
      message: asString(reason, { maxLength: LIMITS.MESSAGE_MAX_LENGTH }) || undefined,
      notification: { title: 'Booking cancelled', body: 'The customer cancelled their booking request.' },
    });
  }

  return { createBooking, listMine, listForGarage, updateStatusByGarage, requestInfo, provideInfo, cancelByOwner };
}

module.exports = { createBookingService, sanitizeIssueDetails, parseSchedule, buildBookingDoc };
