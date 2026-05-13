import { test as base } from '@playwright/test';
import { type Page, type APIRequestContext } from '@playwright/test';
import { registerUser, createList, loginUser } from '../helpers/api';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD, getRandomEmail } from '../helpers/config';

// Extend the base test with custom fixtures
type E2EFixtures = {
  /**
   * An authenticated page (logged in via API, token stored in localStorage).
   */
  authedPage: Page;

  /**
   * A fresh authenticated user session with its own unique email.
   * Use this when tests need isolated user data.
   */
  freshUser: { page: Page; email: string; token: string };

  /**
   * API context authenticated as the test user.
   */
  authedRequest: APIRequestContext;
};

export const test = base.extend<E2EFixtures>({
  authedPage: async ({ browser }, use) => {
    // Create a fresh auth context with the standard test user
    const email = TEST_USER_EMAIL;
    const password = TEST_USER_PASSWORD;

    const context = await browser.newContext();
    const page = await context.newPage();

    // Register the user (safe to call multiple times - second call will fail silently)
    const request = context.request;
    try {
      await registerUser(request, email, password);
    } catch {
      // User may already exist, try logging in
      const session = await loginUser(request, email, password);
      // Store the token in localStorage
      await page.goto('/');
      await page.evaluate((t) => localStorage.setItem('token', t), session.token);
      await page.goto('/');
      await use(page);
      await context.close();
      return;
    }

    // Registration succeeded, store token
    const session = await loginUser(request, email, password);
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), session.token);
    await page.goto('/');

    await use(page);
    await context.close();
  },

  freshUser: async ({ browser }, use) => {
    const email = getRandomEmail();
    const password = TEST_USER_PASSWORD;

    const context = await browser.newContext();
    const page = await context.newPage();
    const request = context.request;

    const session = await registerUser(request, email, password);

    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), session.token);
    await page.goto('/');

    await use({ page, email, token: session.token });
    await context.close();
  },

  authedRequest: async ({ browser }, use) => {
    const context = await browser.newContext();
    const request = context.request;
    const email = TEST_USER_EMAIL;
    const password = TEST_USER_PASSWORD;

    try {
      await registerUser(request, email, password);
    } catch {
      // already exists
    }

    const session = await loginUser(request, email, password);

    // Create an API context with the token baked in
    const apiContext = await browser.newContext({
      storageState: undefined,
      extraHTTPHeaders: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    await use(apiContext.request);
    await apiContext.close();
    await context.close();
  },
});

export { expect } from '@playwright/test';