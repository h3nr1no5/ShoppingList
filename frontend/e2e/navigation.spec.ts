import { test, expect } from './fixtures';

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
    // Navigate to a non-existent list ID
    await authedPage.goto('/lists/00000000-0000-0000-0000-000000000000');

    // Should show loading or error state
    await authedPage.waitForTimeout(1000);
    const loading = await authedPage.locator('text=Loading').isVisible().catch(() => false);
    const error = await authedPage.locator('text=couldn').isVisible().catch(() => false);
    expect(loading || error).toBeTruthy();
  });

  test('shows error message for invalid list id', async ({ authedPage }) => {
    await authedPage.goto('/lists/00000000-0000-0000-0000-000000000000');

    // Wait for the toast error message to appear.
    // Note: Avoid toBeVisible() on .toast-container — it uses getBoundingClientRect
    // which can return zero dimensions on WebKit headless Linux for position:fixed elements.
    await expect(authedPage.locator('.toast-message')).toContainText("Couldn't load the list", { timeout: 7000 });
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