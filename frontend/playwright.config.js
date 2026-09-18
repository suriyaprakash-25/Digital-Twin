import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 1,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  }
});
