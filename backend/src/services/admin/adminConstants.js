/**
 * Named values used by the admin console services (previously inline magic numbers/strings in
 * routes/admin.js). Response fallbacks are part of the admin API contract: the React admin pages
 * render them verbatim, so change them only together with the frontend.
 */
const { PAYMENTS } = require('../../core/constants');

const ADMIN_PAGINATION = Object.freeze({
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

const ADMIN_LIMITS = Object.freeze({
  // Analytics "top performing garages" leaderboard size.
  TOP_GARAGES: 10,
  // Upper bound for the vehicles/services embedded in one user's detail view.
  USER_DETAIL_MAX_ITEMS: 500,
});

/** Query-string value meaning "no status filter" on the finance lists. */
const ALL_STATUSES = 'ALL';

const BOOKING_STATUS = Object.freeze({ COMPLETED: 'COMPLETED' });

const ROLE_FALLBACK = 'USER';
const DEFAULT_CURRENCY = PAYMENTS.CURRENCY;

const FALLBACK_LABELS = Object.freeze({
  GARAGE: 'Authorized Service Center',
  SETTLEMENT_GARAGE: 'Authorized Garage',
  REVENUE_GARAGE: 'Unknown Garage',
  TOP_GARAGE: 'Unknown',
  INVOICE_NUMBER: '—',
  PAYMENT_ID: '—',
  PAYMENT_METHOD: 'Online',
  VEHICLE_NUMBER: 'N/A',
  SERVICE_TYPE: 'Automotive Service',
});

/** `$dateToString` format used to bucket analytics series by calendar month. */
const MONTH_BUCKET_FORMAT = '%Y-%m';

module.exports = {
  ADMIN_PAGINATION,
  ADMIN_LIMITS,
  ALL_STATUSES,
  BOOKING_STATUS,
  ROLE_FALLBACK,
  DEFAULT_CURRENCY,
  FALLBACK_LABELS,
  MONTH_BUCKET_FORMAT,
};
