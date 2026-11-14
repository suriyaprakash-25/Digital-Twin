/**
 * Named constants for garage earnings, settlement requests and payout profiles (previously inline
 * literals in routes/earnings.js).
 */

const LISTING = Object.freeze({
  EARNINGS_DEFAULT_LIMIT: 15,
  EARNINGS_MAX_LIMIT: 100,
  SETTLEMENTS_DEFAULT_LIMIT: 20,
  SETTLEMENTS_MAX_LIMIT: 100,
});

const ALL_STATUSES = 'ALL';

const SETTLEMENT_REQUEST = Object.freeze({
  // Upper bound on how long one request may hold the per-garage lock (crash safety).
  LOCK_TTL_MS: 30 * 1000,
  DEFAULT_NOTES: 'Garage requested withdrawal',
  NOTES_MAX: 500,
  DEFAULT_DESTINATION: 'Default Garage Account',
  HIGH_VALUE_APPROVALS: 2,
  STANDARD_APPROVALS: 1,
  DEFAULT_MIN_RUPEES: 500,
  CURRENCY: 'INR',
  LOCALE: 'en-IN',
});

/** Same source and default as services/settlementEligibilityService. */
function minSettlementPaise() {
  return Math.round((parseFloat(process.env.MIN_SETTLEMENT_AMOUNT) || SETTLEMENT_REQUEST.DEFAULT_MIN_RUPEES) * 100);
}

const PAYOUT_PROFILE = Object.freeze({
  ACCOUNT_NUMBER_PATTERN: /^\d{6,18}$/,
  IFSC_PATTERN: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  DEFAULT_BANK_NAME: 'Bank Account',
  NAME_MAX: 120,
});

const REASON_CODES = Object.freeze({
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  NO_MATCHING_EARNINGS: 'NO_MATCHING_EARNINGS',
});

const ERROR_CODES = Object.freeze({
  REQUEST_IN_PROGRESS: 'SETTLEMENT_REQUEST_IN_PROGRESS',
  EARNINGS_CHANGED: 'EARNINGS_CHANGED',
});

const MSG = Object.freeze({
  EARNING_NOT_FOUND: 'Earnings record not found',
  SETTLEMENT_NOT_FOUND: 'Settlement not found',
  FORBIDDEN: 'Forbidden',
  INVALID_AMOUNT: 'Settlement amount must be a positive number',
  REQUEST_IN_PROGRESS: 'Another settlement request for this garage is being processed. Please wait a moment.',
  EARNINGS_CHANGED: 'Your available earnings changed while the request was being created. Please retry.',
  PROFILE_REQUIRED: 'Account holder, account number, and IFSC code are required',
  ACCOUNT_INVALID: 'Account number must be 6 to 18 digits',
  IFSC_INVALID: 'IFSC code must be 11 characters, e.g. HDFC0001234',
});

module.exports = {
  LISTING,
  ALL_STATUSES,
  SETTLEMENT_REQUEST,
  minSettlementPaise,
  PAYOUT_PROFILE,
  REASON_CODES,
  ERROR_CODES,
  MSG,
};
