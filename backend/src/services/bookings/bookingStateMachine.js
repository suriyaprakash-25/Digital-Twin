/**
 * Booking state machine, modelled on services/settlementStateMachine.js.
 *
 *   REQUESTED ──► ACCEPTED ──► IN_PROGRESS ──► COMPLETED
 *      │  ▲          │  └──────────────────────► COMPLETED (service completion flow)
 *      │  │          └──► CANCELLED
 *      ▼  │
 *   MORE_INFO_REQUIRED ──► ACCEPTED / REJECTED / CANCELLED
 *   REQUESTED ──► REJECTED / CANCELLED
 *
 * COMPLETED, REJECTED and CANCELLED are terminal. `transitionBooking` is the only sanctioned way to
 * change a booking's status from the bookings API: it validates the move against
 * ALLOWED_TRANSITIONS and the actor's permissions, then applies it with a compare-and-swap on the
 * current status, so concurrent or stale requests get a 409 instead of overwriting each other.
 */
const { ConflictError, ForbiddenError } = require('../../core/errors');

const BOOKING_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  MORE_INFO_REQUIRED: 'MORE_INFO_REQUIRED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});
const S = BOOKING_STATUS;

const ALLOWED_TRANSITIONS = Object.freeze({
  [S.REQUESTED]: Object.freeze([S.ACCEPTED, S.REJECTED, S.MORE_INFO_REQUIRED, S.CANCELLED]),
  [S.MORE_INFO_REQUIRED]: Object.freeze([S.REQUESTED, S.ACCEPTED, S.REJECTED, S.CANCELLED]),
  [S.ACCEPTED]: Object.freeze([S.IN_PROGRESS, S.COMPLETED, S.CANCELLED]),
  [S.IN_PROGRESS]: Object.freeze([S.COMPLETED]),
  [S.COMPLETED]: Object.freeze([]),
  [S.REJECTED]: Object.freeze([]),
  [S.CANCELLED]: Object.freeze([]),
});

const ACTORS = Object.freeze({ USER: 'USER', GARAGE: 'GARAGE' });

/** Target statuses each actor may set. The garage list is what PATCH /:id/status has always accepted. */
const ACTOR_TARGETS = Object.freeze({
  [ACTORS.GARAGE]: Object.freeze([S.ACCEPTED, S.REJECTED, S.IN_PROGRESS, S.COMPLETED, S.MORE_INFO_REQUIRED]),
  [ACTORS.USER]: Object.freeze([S.REQUESTED, S.CANCELLED]),
});

/** Entering these states takes a slot of the garage's maxCapacity. */
const ACTIVE_STATUSES = Object.freeze([S.ACCEPTED, S.IN_PROGRESS]);

/** Rows written by older clients used PENDING for a fresh request. */
const LEGACY_STATUS_ALIASES = Object.freeze({ PENDING: S.REQUESTED });

function normalizeBookingStatus(status) {
  const upper = String(status || '').toUpperCase();
  return LEGACY_STATUS_ALIASES[upper] || upper;
}

/** Same-status moves are not in the table: re-accepting an accepted booking is a conflict, not a no-op. */
function canTransitionBooking(from, to) {
  const allowed = ALLOWED_TRANSITIONS[normalizeBookingStatus(from)];
  return Boolean(allowed && allowed.includes(to));
}

function canActorSet(actor, to) {
  return Boolean(ACTOR_TARGETS[actor] && ACTOR_TARGETS[actor].includes(to));
}

const consumesCapacity = (from, to) => ACTIVE_STATUSES.includes(to) && !ACTIVE_STATUSES.includes(normalizeBookingStatus(from));

class BookingTransitionError extends ConflictError {
  constructor(message, code) {
    super(message, code);
    this.name = 'BookingTransitionError';
  }
}

function assertTransition(booking, to, actor) {
  if (!canActorSet(actor, to)) throw new ForbiddenError(`Forbidden: ${actor} cannot set a booking to ${to}`);
  const from = normalizeBookingStatus(booking.status);
  if (!canTransitionBooking(from, to)) {
    throw new BookingTransitionError(`Booking cannot move from ${from || 'UNKNOWN'} to ${to}`, 'ILLEGAL_BOOKING_TRANSITION');
  }
  return from;
}

/**
 * @param {{ bookings: { compareAndSetStatus: Function }, booking: object, to: string, actor: string,
 *           message?: string, now?: () => Date }} args
 * @returns {Promise<object>} the updated booking
 */
async function transitionBooking({ bookings, booking, to, actor, message, now = () => new Date() }) {
  const from = assertTransition(booking, to, actor);
  const at = now();
  const timelineEntry = { status: to, from, at, by: actor };
  if (message) timelineEntry.message = message;
  const updated = await bookings.compareAndSetStatus(booking._id, booking.status, { to, timelineEntry, at });
  if (!updated) {
    throw new BookingTransitionError('Booking was modified concurrently; reload and retry', 'BOOKING_CONCURRENT_MODIFICATION');
  }
  return updated;
}

module.exports = {
  BOOKING_STATUS,
  ALLOWED_TRANSITIONS,
  ACTORS,
  ACTOR_TARGETS,
  ACTIVE_STATUSES,
  LEGACY_STATUS_ALIASES,
  BookingTransitionError,
  normalizeBookingStatus,
  canTransitionBooking,
  canActorSet,
  consumesCapacity,
  assertTransition,
  transitionBooking,
};
