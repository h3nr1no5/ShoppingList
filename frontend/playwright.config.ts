import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
  webServer: [
    {
      command: 'cd ../backend && bash scripts/e2e_db_clean.sh && bash run.sh',
      port: 8000,
      reuseExistingServer: !!process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        REGISTER_RATE_LIMIT: process.env.REGISTER_RATE_LIMIT || '100/minute',
        LOGIN_RATE_LIMIT: process.env.LOGIN_RATE_LIMIT || '200/minute',
        SHARED_LIST_RATE_LIMIT: process.env.SHARED_LIST_RATE_LIMIT || '500/minute',
        E2E_INVITE_CODE: process.env.E2E_INVITE_CODE || '',
        DATABASE_URL: 'postgresql+asyncpg://postgres:postgres@localhost:5432/shoppinglist_e2e',
      },
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});