/**
 * Named constants for the vehicle digital passport (previously literals in routes/passport.js).
 */
const MINUTE_MS = 60 * 1000;

const MSG = Object.freeze({
  ID_REQUIRED: 'Vehicle ID is required',
  PASSPORT_NOT_FOUND: 'Vehicle passport not found or vehicle is archived',
  INVALID_VEHICLE_ID: 'Invalid vehicle ID',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  RATE_LIMITED: 'Too many passport requests. Please wait a few minutes and try again.',
});

const DEFAULTS = Object.freeze({
  FRONTEND_URL: 'https://www.driveportz.com',
  GARAGE_NAME: 'Authorized Service Center',
  PART_BRAND: 'Genuine Part',
  OWNER_NAME: 'Verified Owner',
  HISTORY_OWNER_NAME: 'Registered Owner',
  SERVICE_TYPE: 'General Maintenance',
  SERVICE_CATEGORY: 'General',
  HEALTH: Object.freeze({ healthScore: 100, conditionLevel: 'Excellent' }),
});

const VERIFICATION_STATUS = Object.freeze({ VERIFIED: 'Verified', PENDING: 'Pending' });

/** Anonymous passport traffic (public page, QR scans, PDF) per IP. */
const PUBLIC_RATE_LIMIT = Object.freeze({ WINDOW_MS: 15 * MINUTE_MS, MAX: 300 });

const PDF = Object.freeze({
  MARGIN: 50,
  RIGHT_COLUMN_X: 320,
  PAGE_RIGHT_X: 562,
  QR_WIDTH: 90,
  MAX_INSURANCE_ROWS: 5,
  MAX_PART_ROWS: 8,
  MAX_SERVICE_ROWS: 15,
  COLORS: Object.freeze({
    PRIMARY: '#0d9488', // teal-600
    DARK: '#0f172a', // slate-900
    MUTED: '#64748b',
    BODY: '#475569',
    RULE: '#cbd5e1',
    SOFT_RULE: '#e2e8f0',
    GOOD: '#10b981',
    INFO: '#3b82f6',
    WARN: '#f59e0b',
    BAD: '#ef4444',
  }),
  HEALTH_BANDS: Object.freeze({ EXCELLENT: 85, GOOD: 70, AVERAGE: 50 }),
});

module.exports = { MSG, DEFAULTS, VERIFICATION_STATUS, PUBLIC_RATE_LIMIT, PDF };
