import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/_meta/**', '**/helpers/**', '**/fixtures/**'],
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // If you want Playwright to start the dev stack itself, uncomment.
  // The README-e2e.md walks through both options (managed vs. external stack).
  // webServer: {
  //   command: 'bun run dev',
  //   url: BASE_URL,
  //   timeout: 120_000,
  //   reuseExistingServer: !CI,
  // },
});
