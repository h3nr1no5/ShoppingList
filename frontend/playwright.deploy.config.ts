import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-deploy-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'deploy-auth-setup',
      testMatch: 'auth.setup.ts',
      use: { browserName: 'chromium' },
    },
    {
      name: 'deploy-smoke',
      testMatch: [
        'auth.spec.ts',
        'lists.spec.ts',
        'items.spec.ts',
        'sharing.spec.ts',
      ],
      use: { browserName: 'chromium' },
      dependencies: ['deploy-auth-setup'],
      storageState: process.env.E2E_AUTH_FILE || './e2e/.auth/user.json',
    },
  ],
});