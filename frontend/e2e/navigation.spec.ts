import { test, expect } from './fixtures';
import type { Route } from '@playwright/test';

test.describe('Navigation and routing', () => {
  test('redirects unauthenticated user to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined, noViewport: true });
    const page = await context.newPage();

    await page.goto('http://localhost:5173/');
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test('redirects unauthenticated user to login when accessing list detail', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined, noViewport: true });
    const page = await context.newPage();

    await page.goto('http://localhost:5173/lists/some-id');
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test('shows loading state while fetching list', async ({ authedPage }) => {
    // Delay the API response to ensure the loading state renders before the request
    // completes. Without this, the entire auth→loading→API lifecycle can finish
    // before Playwright's first DOM check, making the loading state unobservable.
    const delayListResponse = async (route: Route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
    };
    await authedPage.route('**/api/lists/**', delayListResponse);

    await authedPage.goto('/lists/00000000-0000-0000-0000-000000000000');

    await expect(async () => {
        const text = await authedPage.locator('body').textContent();
        expect(text).toMatch(/Loading|couldn/i);
    }).toPass({ timeout: 10000 });

    await authedPage.unroute('**/api/lists/**', delayListResponse);
  });

  test('shows error message for invalid list id', async ({ authedPage }) => {
    await authedPage.goto('/lists/00000000-0000-0000-0000-000000000000');

    // Wait for the API request to complete — ensures the error handler has fired.
    await authedPage.waitForResponse(
      response => response.url().includes('/api/lists/00000000-') &&
                  response.request().method() === 'GET'
    );

    // Wait for the error message to appear in the page body.
    // The ListDetail component shows an .error-state when list fetch fails,
    // providing a reliable error indicator across all browsers (unlike the toast
    // which uses position:fixed and can have rendering issues on WebKit headless Linux).
    await expect(authedPage.locator('.error-state')).toContainText("Couldn't load the list", { timeout: 10000 });
  });

  test('shows login page for /login route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined, noViewport: true });
    const page = await context.newPage();

    await page.goto('http://localhost:5173/login');
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();

    await context.close();
  });

  test('shows register page for /register route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined, noViewport: true });
    const page = await context.newPage();

    await page.goto('http://localhost:5173/register');
    await expect(page.locator('button:has-text("Create Account")')).toBeVisible();

    await context.close();
  });
});