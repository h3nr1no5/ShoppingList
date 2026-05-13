import { test, expect } from './fixtures';

test.describe('Language toggle', () => {
  test('switches to Hungarian', async ({ authedPage }) => {
    await authedPage.goto('/');

    // Click language toggle in desktop nav to switch to Hungarian
    await authedPage.click('.nav [title="Magyar"]');

    // Wait for i18n to update
    await authedPage.waitForTimeout(500);

    // The toggle should now show "Angol" (Hungarian for "English")
    await expect(authedPage.locator('.nav [title="Angol"]')).toBeVisible();
  });

  test('switches back to English', async ({ authedPage }) => {
    await authedPage.goto('/');

    // First switch to Hungarian
    await authedPage.click('.nav [title="Magyar"]');
    await authedPage.waitForTimeout(1000);

    // Then switch back to English
    await authedPage.click('.nav [title="Angol"]');
    await authedPage.waitForTimeout(500);

    // Should be back on English
    await expect(authedPage.locator('.nav [title="Magyar"]')).toBeVisible();
  });
});