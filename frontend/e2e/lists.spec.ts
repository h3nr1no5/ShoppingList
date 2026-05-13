import { test, expect } from './fixtures';
import { createList, deleteList } from './helpers/api';

const LIST_NAME = `E2E List ${Date.now()}`;
const UPDATED_NAME = `${LIST_NAME} Updated`;

let createdListId: string;

test.describe('Shopping list management', () => {

  test.afterAll(async ({ authedRequest }) => {
    if (createdListId) {
      try {
        await deleteList(authedRequest, '', createdListId);
      } catch {
        // ignore cleanup failures
      }
    }
  });

  test.describe('Create list', () => {
    test('creates a new list and shows it on home page', async ({ freshUser: { page } }) => {
      await page.goto('/');

      // Click "+ New List" button to open the form
      await page.click('button:has-text("+ New List")');

      // Type list name
      await page.fill('#listName', LIST_NAME);
      await page.click('button:has-text("Create List")');

      // Should appear on the home page
      await expect(page.locator(`text=${LIST_NAME}`)).toBeVisible();
    });
  });

  test.describe('Rename list', () => {
    test('renames a list and shows updated name', async ({ freshUser: { page, token } }) => {
      const listName = `Rename Test ${Date.now()}`;
      // Create a list first via API
      const list = await createList(page.request, token, listName);
      createdListId = list.id;

      await page.goto('/');
      await page.locator(`text=${listName}`).click();

      // Wait for list detail to load
      await expect(page).toHaveURL(/\/lists\//);

      // Click edit list name button
      await page.click('button:has-text("Edit list name")');
      await page.fill('#listName', UPDATED_NAME);
      await page.click('button:has-text("Update List")');

      // Verify updated name is shown
      await expect(page.locator(`text=${UPDATED_NAME}`)).toBeVisible();
    });
  });

  test.describe('Navigate to list', () => {
    test('clicks a list card and navigates to detail view', async ({ freshUser: { page, token } }) => {
      const listName = `Nav Test ${Date.now()}`;
      const list = await createList(page.request, token, listName);
      createdListId = list.id;

      await page.goto('/');
      await page.locator(`text=${listName}`).click();

      // Should navigate to /lists/:id
      await expect(page).toHaveURL(/\/lists\//);
      await expect(page.locator(`text=${listName}`)).toBeVisible();
    });

    test('back button returns to home page', async ({ freshUser: { page, token } }) => {
      const list = await createList(page.request, token, `Back Test ${Date.now()}`);
      createdListId = list.id;

      await page.goto('/');
      await page.locator(`text=${list.name}`).click();
      await expect(page).toHaveURL(/\/lists\//);

      // Click back button
      await page.click('text=Back');

      // Should return to home
      await expect(page).toHaveURL(/\/$/);
    });
  });

  test.describe('Delete list', () => {
    test('deletes a list and removes it from home page', async ({ freshUser: { page, token } }) => {
      const listName = `Delete Test ${Date.now()}`;
      const list = await createList(page.request, token, listName);
      createdListId = list.id;

      await page.goto('/');
      await expect(page.locator(`text=${listName}`)).toBeVisible();

      // Find the list card's delete button by card class filter
      const listCard = page.locator('.shopping-list-card').filter({ hasText: listName });
      await listCard.locator('button[title="Delete List"]').click();

      // Confirm in the delete dialog
      await page.click('button:has-text("Delete")');

      // Should disappear
      await expect(page.locator(`text=${listName}`)).not.toBeVisible();
    });
  });

  test.describe('Empty state', () => {
    test('shows empty state when user has no lists', async ({ freshUser: { page } }) => {
      await page.goto('/');
      await expect(page.locator('text=No shopping lists yet.')).toBeVisible();
    });
  });
});