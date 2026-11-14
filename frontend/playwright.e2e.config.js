// Browser end-to-end suite: real SPA (vite preview) + real backend (node server.js) + a throwaway
// MongoDB database that backend/scripts/e2e-seed.mjs drops and re-seeds before the API starts.
//
//   npx playwright test --config playwright.e2e.config.js
//
// Knobs: E2E_PREBUILT=1 serves an existing dist/ (built with the VITE_* values below) instead of
// building; E2E_SKIP_SEED=1 keeps an already-seeded database; MONGO_URI points at another mongod.
import { defineConfig, devices } from '@playwright/test';
import { API_URL, BACKEND_PORT, BASE_URL, FRONTEND_PORT } from './tests/e2e/support/env.js';

const isCI = Boolean(process.env.CI);
const DB_NAME = 'driveportz_e2e';

const backendEnv = {
  NODE_ENV: 'development',
  PORT: String(BACKEND_PORT),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
  MONGODB_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
  MONGO_DB_NAME: DB_NAME,
  JWT_SECRET_KEY: 'e2e-only-driveportz-secret-key-2026-min-32-chars',
  FRONTEND_URL: BASE_URL,
  CORS_ALLOWED_ORIGINS: BASE_URL,
  EMAIL_PROVIDER: 'mock',
  SETTLEMENT_MODE: 'MOCK_TEST_MODE',
  SETTLEMENT_PROVIDER: 'mock',
  FINANCIAL_JOBS_ENABLED: 'false',
  PAYMENT_GATEWAY: 'mock',
  RATE_LIMIT_LOGIN_MAX: '1000',
  // Empty values win over backend/.env (dotenv never overrides keys that are already set), so a
  // developer's real keys are never used by the suite.
  GROQ_API_KEY: '',
  GEMINI_API_KEY: '',
  CASHFREE_APP_ID: '',
  CASHFREE_SECRET_KEY: '',
  CASHFREE_ENV: 'TEST',
  GOOGLE_CLIENT_ID: '',
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASS: '',
  FIREBASE_SERVICE_ACCOUNT_PATH: '',
};

const frontendEnv = {
  VITE_API_URL: API_URL,
  VITE_GOOGLE_CLIENT_ID: 'e2e-client.apps.googleusercontent.com',
};

const backendCommand = process.env.E2E_SKIP_SEED ? 'node server.js' : 'node scripts/e2e-seed.mjs && node server.js';
const previewCommand = `npm run preview -- --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`;
const frontendCommand = process.env.E2E_PREBUILT ? previewCommand : `npm run build && ${previewCommand}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/e2e',
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: isCI,
  reporter: isCI
    ? [['line'], ['html', { outputFolder: 'playwright-report/e2e', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/e2e', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1366, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'e2e', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
  webServer: [
    {
      name: 'backend',
      command: backendCommand,
      cwd: '../backend',
      url: `${API_URL}/api/status`,
      env: backendEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'frontend',
      command: frontendCommand,
      url: `${BASE_URL}/`,
      env: frontendEnv,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
