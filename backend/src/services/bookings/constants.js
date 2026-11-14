/**
 * Named values for the booking domain (previously magic numbers/strings in routes/bookings.js).
 */
const { PROFILE } = require('../garages/garageConstants');

const PAGE_DEFAULTS = Object.freeze({
  // Existing clients never send ?page; these defaults keep their first page as large as before.
  OWNER_LIMIT: 100,
  GARAGE_LIMIT: 200,
});

const CAPACITY = Object.freeze({
  DEFAULT_MAX: PROFILE.DEFAULT_MAX_CAPACITY,
  // Per-garage lease held while a capacity-consuming transition is checked and applied.
  LOCK_TTL_MS: 5000,
  LOCK_MAX_ATTEMPTS: 20,
  LOCK_RETRY_DELAY_MS: 25,
});

const LIMITS = Object.freeze({
  NOTES_MAX_LENGTH: 2000,
  MESSAGE_MAX_LENGTH: 2000,
  ISSUE_FIELD_MAX_LENGTH: 2000,
});

const CUSTOM_ISSUE_SERVICE = Object.freeze({
  title: 'Custom Vehicle Issue',
  price: 0,
  durationMins: null,
});

const DEFAULT_NAMES = Object.freeze({
  OWNER: 'Vehicle Owner',
  CUSTOMER: 'Customer',
  GARAGE_OWNER: 'Garage Owner',
});

const NOTIFICATION_TYPES = Object.freeze({
  REQUEST: 'BOOKING_REQUEST',
  UPDATE: 'BOOKING_UPDATE',
});

const MSG = Object.freeze({
  GARAGE_AND_VEHICLE_REQUIRED: 'garageId and vehicleId are required',
  SERVICE_OR_CUSTOM_REQUIRED: 'Either serviceId or isCustomIssue must be provided',
  INVALID_SCHEDULE: 'scheduledFor must be a valid date/time',
  GARAGE_NOT_FOUND: 'Garage not found',
  SERVICE_NOT_FOUND: 'Service not found',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  NO_SLOTS: 'This garage has reached its maximum capacity. No slots available at this time.',
  CAPACITY_FULL: 'Your garage is at full capacity. Complete or cancel an active job before accepting new bookings.',
  CAPACITY_BUSY: 'Another booking update for this garage is in progress. Please retry.',
  CREATE_PROFILE_FIRST: 'Create your garage profile first',
  BOOKING_NOT_FOUND: 'Booking not found',
  INVALID_STATUS: 'Invalid status',
  MESSAGE_REQUIRED: 'Message is required',
});

module.exports = { PAGE_DEFAULTS, CAPACITY, LIMITS, CUSTOM_ISSUE_SERVICE, DEFAULT_NAMES, NOTIFICATION_TYPES, MSG };
