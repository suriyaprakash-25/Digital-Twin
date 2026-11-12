import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // The browser end-to-end suite needs the backend + MongoDB; it has its own config
  // (playwright.e2e.config.js) and must not run under this static-preview smoke config.
  testIgnore: ['**/e2e/**'],
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 1,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    },
    {
      name: 'edge',
      use: { browserName: 'chromium', channel: 'msedge' }
    }
  ]
});
