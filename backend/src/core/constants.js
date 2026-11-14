/**
 * Named constants for values that were previously scattered as magic numbers.
 * Every tunable that operations may need to change is also overridable through env.
 */
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const TIME = Object.freeze({ SECOND_MS, MINUTE_MS, HOUR_MS, DAY_MS });

const HTTP_LIMITS = Object.freeze({
  DEFAULT_JSON_BODY: process.env.JSON_BODY_LIMIT || '1mb',
  // AI image analysis (base64) and media endpoints legitimately send large payloads.
  LARGE_JSON_BODY: process.env.LARGE_JSON_BODY_LIMIT || '12mb',
  LARGE_BODY_PATH_PREFIXES: ['/api/copilot', '/api/vehicle-doctor', '/api/media'],
  UPLOAD_MAX_BYTES: envNumber('UPLOAD_MAX_BYTES', 8 * 1024 * 1024),
  REQUEST_TIMEOUT_MS: envNumber('REQUEST_TIMEOUT_MS', 30 * SECOND_MS),
});

const PAGINATION = Object.freeze({
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
});

const RATE_LIMITS = Object.freeze({
  WINDOW_MS: 15 * MINUTE_MS,
  LOGIN_MAX: envNumber('RATE_LIMIT_LOGIN_MAX', 10),
  SIGNUP_MAX: envNumber('RATE_LIMIT_SIGNUP_MAX', 10),
  OTP_MAX: envNumber('RATE_LIMIT_OTP_MAX', 5),
  AI_PER_MINUTE: envNumber('RATE_LIMIT_AI_PER_MINUTE', 10),
  PAYMENT_VERIFY_MAX: envNumber('RATE_LIMIT_PAYMENT_VERIFY_MAX', 60),
  PAYMENT_CREATE_MAX: 20,
  REFUND_MAX: 15,
  DISPUTE_MAX: 10,
  SETTLEMENT_MAX: 10,
  FINANCIAL_MUTATION_MAX: 30,
});

const AUTH = Object.freeze({
  JWT_ALGORITHM: 'HS256',
  // Short-lived bearer token the SPA keeps in memory only; the long-lived session lives in an
  // httpOnly cookie that JavaScript (and therefore XSS) cannot read.
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '15m',
  SESSION_COOKIE_NAME: 'dp_session',
  SESSION_COOKIE_PATH: '/api',
  CSRF_HEADER: 'x-requested-with',
  OTP_LENGTH: 6,
  OTP_TTL_MS: 10 * MINUTE_MS,
  OTP_MAX_ATTEMPTS: 5,
  PASSWORD_MIN_LENGTH: 8,
  BCRYPT_ROUNDS: 10,
});

const PAYMENTS = Object.freeze({
  CURRENCY: 'INR',
  PAISE_PER_RUPEE: 100,
  WEBHOOK_MAX_SKEW_MS: envNumber('WEBHOOK_MAX_SKEW_MS', 15 * MINUTE_MS),
  GATEWAY_TIMEOUT_MS: envNumber('GATEWAY_TIMEOUT_MS', 10 * SECOND_MS),
  VERIFY_MAX_RETRIES: 3,
  VERIFY_RETRY_DELAY_MS: 800,
  IDEMPOTENCY_TTL_MS: DAY_MS,
  IDEMPOTENCY_LOCK_MS: 2 * MINUTE_MS,
  REFUND_NOTE_MAX_LENGTH: 100,
  // An open checkout freezes the invoice total for this long (abandoned checkouts then unlock it).
  CHECKOUT_LOCK_MS: envNumber('CHECKOUT_LOCK_MS', 30 * MINUTE_MS),
});

const CACHE = Object.freeze({
  DEFAULT_TTL_MS: envNumber('CACHE_DEFAULT_TTL_MS', 60 * SECOND_MS),
  MAX_ENTRIES: envNumber('CACHE_MAX_ENTRIES', 5000),
  GARAGE_LIST_TTL_MS: 2 * MINUTE_MS,
  KNOWLEDGE_BASE_TTL_MS: 10 * MINUTE_MS,
});

const JOB_QUEUE = Object.freeze({
  POLL_INTERVAL_MS: envNumber('JOB_QUEUE_POLL_MS', 2 * SECOND_MS),
  LOCK_MS: envNumber('JOB_QUEUE_LOCK_MS', MINUTE_MS),
  MAX_ATTEMPTS: envNumber('JOB_QUEUE_MAX_ATTEMPTS', 6),
  BASE_BACKOFF_MS: 5 * SECOND_MS,
  MAX_BACKOFF_MS: 30 * MINUTE_MS,
  BATCH_SIZE: 10,
  COMPLETED_RETENTION_MS: 7 * DAY_MS,
});

const CIRCUIT_BREAKER = Object.freeze({
  FAILURE_THRESHOLD: 5,
  RESET_TIMEOUT_MS: 30 * SECOND_MS,
});

const SHUTDOWN = Object.freeze({
  GRACE_PERIOD_MS: envNumber('SHUTDOWN_GRACE_MS', 15 * SECOND_MS),
});

module.exports = {
  TIME,
  HTTP_LIMITS,
  PAGINATION,
  RATE_LIMITS,
  AUTH,
  PAYMENTS,
  CACHE,
  JOB_QUEUE,
  CIRCUIT_BREAKER,
  SHUTDOWN,
  envNumber,
};
