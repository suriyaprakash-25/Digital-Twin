/**
 * Response mapping for /api/bookings (shapes the React owner dashboard and garage dashboard read).
 */
const { DEFAULT_NAMES } = require('./constants');

const snapshotOf = (booking, key) => booking.snapshots && booking.snapshots[key];
const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

function baseView(b) {
  return {
    id: String(b._id),
    status: b.status,
    scheduledFor: b.scheduledFor,
    notes: b.notes,
    timeline: b.timeline || [],
    createdAt: b.createdAt,
  };
}

/** GET /api/bookings/my item. */
function toOwnerBookingView(b) {
  return {
    ...baseView(b),
    isCustomIssue: Boolean(b.isCustomIssue),
    garage: snapshotOf(b, 'garage'),
    service: snapshotOf(b, 'service'),
    vehicle: snapshotOf(b, 'vehicle'),
  };
}

/** Booking snapshot contact first, then the live user profile, then a neutral default. */
function toCustomer(snapshotUser = {}, user) {
  return {
    name: trimmed(snapshotUser.name) || (user && user.name) || DEFAULT_NAMES.CUSTOMER,
    phone: trimmed(snapshotUser.phone) || (user && user.phone) || '',
    email: trimmed(snapshotUser.email) || (user && user.email) || '',
  };
}

/** GET /api/bookings/garage item; `userMap` is keyed by user _id and legacy uid. */
function toGarageBookingView(b, userMap) {
  return {
    ...baseView(b),
    userId: b.userId,
    isCustomIssue: Boolean(b.isCustomIssue),
    customer: toCustomer(snapshotOf(b, 'user') || {}, userMap.get(String(b.userId))),
    garage: snapshotOf(b, 'garage'),
    service: snapshotOf(b, 'service'),
    vehicle: snapshotOf(b, 'vehicle'),
  };
}

module.exports = { toOwnerBookingView, toGarageBookingView, toCustomer };
