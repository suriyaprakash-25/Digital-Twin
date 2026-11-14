/**
 * Named constants for invoice billing and garage revenue views (previously inline literals in
 * routes/invoices.js).
 */

const INVOICE_STATUS = Object.freeze({ DRAFT: 'DRAFT', FINALIZED: 'FINALIZED', CANCELLED: 'CANCELLED' });

const SERVICE_PAYMENT_STATUS = Object.freeze({
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
});

/** Once any money has been taken, line items and totals are frozen. */
const LOCKED_PAYMENT_STATUSES = Object.freeze([
  SERVICE_PAYMENT_STATUS.PAID,
  SERVICE_PAYMENT_STATUS.PARTIALLY_PAID,
  SERVICE_PAYMENT_STATUS.REFUNDED,
  SERVICE_PAYMENT_STATUS.PARTIALLY_REFUNDED,
]);

/** `?status=` values of the garage invoice list mapped to filter fragments. */
const LIST_STATUS_FILTERS = Object.freeze({
  UNPAID: { paymentStatus: { $ne: SERVICE_PAYMENT_STATUS.PAID } },
  PAID: { paymentStatus: SERVICE_PAYMENT_STATUS.PAID },
  DRAFT: { invoiceStatus: INVOICE_STATUS.DRAFT },
  FINALIZED: { invoiceStatus: INVOICE_STATUS.FINALIZED },
  CANCELLED: { invoiceStatus: INVOICE_STATUS.CANCELLED },
});

const LISTING = Object.freeze({
  INVOICES_DEFAULT_LIMIT: 15,
  INVOICES_MAX_LIMIT: 100,
  PAYMENTS_DEFAULT_LIMIT: 100,
  PAYMENTS_MAX_LIMIT: 100,
});

const ANALYTICS_PERIOD_DAYS = Object.freeze({ '7days': 7, '30days': 30, '90days': 90 });
const DEFAULT_ANALYTICS_DAYS = 7;

/**
 * Business-day boundaries for "today", "this month" and daily trend buckets. IST has no DST, so a
 * fixed offset is exact. (Previously server-local midnight was keyed by its UTC date, which on an
 * IST machine shifted every bucket by a day and dropped today's revenue from the trend.)
 */
const REPORTING = Object.freeze({ TIMEZONE: 'Asia/Kolkata', UTC_OFFSET: '+05:30', DAY_MS: 24 * 60 * 60 * 1000 });

const FINALIZE = Object.freeze({
  // A finalize that claimed the invoice-number slot but crashed releases it after this lease.
  NUMBER_CLAIM_LEASE_MS: 30 * 1000,
});

const LIMITS = Object.freeze({ MECHANIC_NOTES_MAX: 5000, PART_NAME_MAX: 200 });

const DEFAULTS = Object.freeze({
  INVOICE_NUMBER_PREFIX: 'DP-INV-2026-',
  RECEIPT_NUMBER_PREFIX: 'REC-',
  SERVICE_CATEGORY: 'Periodic Maintenance',
  SERVICE_TYPE: 'Automotive Service',
  GARAGE_NAME: 'Authorized Service Center',
  CUSTOMER_NAME: 'Vehicle Owner',
  PREVIOUS_OWNER_NAME: 'Previous Owner',
  PART_NAME: 'Service Part',
  CURRENCY: 'INR',
  RECEIPT_PAYMENT_ID: 'VERIFIED',
  RECEIPT_PAYMENT_METHOD: 'Online (Razorpay)',
  PAYMENT_METHOD: 'Online',
  VEHICLE_NUMBER: 'N/A',
  NONE: '—',
  LOCALE: 'en-IN',
});

const MSG = Object.freeze({
  INVOICE_NOT_FOUND: 'Invoice / Service record not found',
  RECEIPT_NOT_FOUND: 'Service invoice not found',
  SERVICE_NOT_FOUND: 'Service not found',
  FORBIDDEN_INVOICE: 'Forbidden: Unauthorized to access this invoice',
  FORBIDDEN: 'Forbidden',
  FORBIDDEN_EDIT: 'Forbidden: You can only edit your own garage services',
  FORBIDDEN_FINALIZE: 'Forbidden: You can only finalize your own garage services',
  RECEIPT_UNPAID: 'Receipt is only available for paid invoices',
  EDIT_PAID: 'Cannot modify a paid invoice',
  FINALIZE_PAID: 'Invoice is already paid and finalized',
  CANCEL_PAID: 'Cannot cancel a paid invoice',
  EDIT_CANCELLED: 'Cannot modify a cancelled invoice',
  FINALIZE_CANCELLED: 'Cannot finalize a cancelled invoice',
  ALREADY_CANCELLED: 'Invoice is already cancelled',
  CHECKOUT_IN_PROGRESS: 'The customer has an online payment in progress for this invoice. Try again in a few minutes.',
  FINALIZE_IN_PROGRESS: 'This invoice is being finalized by another request. Reload and try again.',
  CHANGED_CONCURRENTLY: 'The invoice changed while you were editing it (paid or cancelled). Reload and try again.',
});

const ERROR_CODES = Object.freeze({
  CHECKOUT_IN_PROGRESS: 'CHECKOUT_IN_PROGRESS',
  FINALIZE_IN_PROGRESS: 'FINALIZE_IN_PROGRESS',
  INVOICE_CHANGED: 'INVOICE_CHANGED',
});

module.exports = {
  INVOICE_STATUS,
  SERVICE_PAYMENT_STATUS,
  LOCKED_PAYMENT_STATUSES,
  LIST_STATUS_FILTERS,
  LISTING,
  ANALYTICS_PERIOD_DAYS,
  DEFAULT_ANALYTICS_DAYS,
  REPORTING,
  FINALIZE,
  LIMITS,
  DEFAULTS,
  MSG,
  ERROR_CODES,
};
