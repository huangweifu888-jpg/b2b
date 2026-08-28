import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.B2B_E2E_BASE_URL || 'http://127.0.0.1:4173';
const channel = process.env.B2B_E2E_CHANNEL === 'chrome' || (process.platform === 'win32' && !process.env.CI)
  ? 'chrome'
  : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, channel, trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: process.env.B2B_E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: baseURL, reuseExistingServer: !process.env.CI },
});
