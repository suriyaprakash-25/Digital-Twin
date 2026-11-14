/**
 * Named constants for the service-record and service-completion domain (previously magic numbers
 * and repeated string literals inside routes/services.js).
 */

const ODOMETER = Object.freeze({
  // A jump larger than this between consecutive records is stored but flagged for review.
  ABNORMAL_JUMP_KM: 40000,
});

const CONFIDENCE_SCORE = Object.freeze({
  NORMAL: 100,
  ABNORMAL_ODOMETER_JUMP: 80,
});

const VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'Verified',
  PENDING: 'Pending',
});

const SERVICE_STATUS = Object.freeze({ COMPLETED: 'COMPLETED' });
const INVOICE_STATUS = Object.freeze({ FINALIZED: 'FINALIZED', UNPAID: 'UNPAID' });
const BOOKING_STATUS = Object.freeze({ COMPLETED: 'COMPLETED' });

const ROLES = Object.freeze({ ADMIN: 'ADMIN', GARAGE: 'GARAGE', DEFAULT_RECORD_ROLE: 'Vehicle Owner' });

const DEFAULTS = Object.freeze({
  STATE_CODE: 'KA',
  TAX_SERVICE_CATEGORY: 'AUTOMOTIVE_SERVICE',
  SERVICE_CATEGORY: 'Periodic Maintenance',
  HISTORY_SERVICE_TYPE: 'General Service',
  COMPLETION_SERVICE_TYPE: 'Comprehensive Maintenance',
  GARAGE_NAME: 'Authorized Service Center',
  CUSTOMER_NAME: 'Customer',
  VEHICLE_NUMBER: 'N/A',
  PART_NAME: 'Replaced Part',
  LABOUR_DESCRIPTION: 'Labour Service',
  LABOUR_FALLBACK_DESCRIPTION: 'Labour Charges',
  ADDITIONAL_CHARGE_DESCRIPTION: 'Additional Charge',
  PAYMENTS_URL: '/payments',
});

const GARAGE_LISTING = Object.freeze({
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 200,
});

module.exports = {
  ODOMETER,
  CONFIDENCE_SCORE,
  VERIFICATION_STATUS,
  SERVICE_STATUS,
  INVOICE_STATUS,
  BOOKING_STATUS,
  ROLES,
  DEFAULTS,
  GARAGE_LISTING,
};
