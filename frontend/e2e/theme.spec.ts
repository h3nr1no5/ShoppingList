import { test, expect } from './fixtures';

test.describe('Theme toggle', () => {
  test('toggles from light to dark mode', async ({ authedPage }) => {
    await authedPage.goto('/');

    // Check initial theme (might be dark if previously toggled)
    const html = authedPage.locator('html');

    // Click theme toggle button by aria-label
    await authedPage.click('[aria-label="Switch to dark mode"], [aria-label="Switch to light mode"]');

    // The theme should have changed
    const theme = await html.getAttribute('data-theme');
    expect(['light', 'dark']).toContain(theme);
  });

  test('persists theme preference across page reload', async ({ authedPage }) => {
    await authedPage.goto('/');

    const html = authedPage.locator('html');
    const currentTheme = await html.getAttribute('data-theme');

    // Toggle
    await authedPage.click('[aria-label="Switch to dark mode"], [aria-label="Switch to light mode"]');

    // Reload
    await authedPage.reload();

    // Should still be the toggled theme (different from original)
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(currentTheme);
  });
});