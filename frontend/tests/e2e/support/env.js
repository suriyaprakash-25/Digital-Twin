// Shared addresses and credentials for the browser end-to-end suite.
//
// The account defaults mirror backend/scripts/e2e-seed.mjs and read the same E2E_* overrides,
// so the seed and the specs always agree. Keep the two files in sync.

export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4174);
export const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 5099);
export const BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
export const API_URL = `http://127.0.0.1:${BACKEND_PORT}`;

const PASSWORD = process.env.E2E_PASSWORD || 'E2eDrivePortz2026';

export const ACCOUNTS = Object.freeze({
  owner: { email: process.env.E2E_OWNER_EMAIL || 'owner@driveportz-e2e.in', password: PASSWORD, home: '/user-dashboard' },
  garage: { email: process.env.E2E_GARAGE_EMAIL || 'garage@driveportz-e2e.in', password: PASSWORD, home: '/garage-dashboard' },
  admin: { email: process.env.E2E_ADMIN_EMAIL || 'admin@driveportz-e2e.in', password: PASSWORD, home: '/admin' },
});

export const SEEDED_GARAGE = Object.freeze({
  name: process.env.E2E_GARAGE_NAME || 'E2E Trusted Motors',
  serviceTitle: process.env.E2E_SERVICE_TITLE || 'E2E Full Car Service',
  servicePrice: 1000,
});
