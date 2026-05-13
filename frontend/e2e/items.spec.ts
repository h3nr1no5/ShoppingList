import { test, expect } from './fixtures';
import { createList, deleteList } from './helpers/api';

let listId: string;

test.describe('Item management', () => {

  test.beforeAll(async ({ authedRequest }) => {
    const list = await createList(authedRequest, '', `Items Test ${Date.now()}`);
    listId = list.id;
  });

  test.afterAll(async ({ authedRequest }) => {
    if (listId) {
      try {
        await deleteList(authedRequest, '', listId);
      } catch {
        // ignore cleanup failures
      }
    }
  });

  test.describe('Add items', () => {
    test('adds an item to a list', async ({ authedPage }) => {
      await authedPage.goto(`/lists/${listId}`);
      await expect(authedPage).toHaveURL(/\/lists\//);

      await authedPage.fill('[placeholder="Add new item..."]', 'Milk');
      await authedPage.click('button:has-text("Add")');

      await expect(authedPage.locator('text=Milk')).toBeVisible();
    });

    test('adds an item with quantity', async ({ authedPage }) => {
      await authedPage.goto(`/lists/${listId}`);

      await authedPage.fill('[placeholder="Add new item..."]', 'Eggs');
      await authedPage.fill('[aria-label="Quantity"]', '12');
      await authedPage.click('button:has-text("Add")');

      await expect(authedPage.locator('text=Eggs')).toBeVisible();
      await expect(authedPage.locator('text=x12')).toBeVisible();
    });
  });

  test.describe('Check/uncheck items', () => {
    test('checks off an item', async ({ authedPage }) => {
      const itemName = `Check Test ${Date.now()}`;
      await authedPage.goto(`/lists/${listId}`);

      // Add item
      await authedPage.fill('[placeholder="Add new item..."]', itemName);
      await authedPage.click('button:has-text("Add")');
      await expect(authedPage.locator(`text=${itemName}`)).toBeVisible();

      // Click the label wrapping the checkbox (input is visually hidden)
      const itemRow = authedPage.locator('.list-item').filter({ hasText: itemName });
      await itemRow.locator('label.list-item-checkbox').click();

      // Verify the checkbox became checked
      const checkbox = itemRow.locator('input[type="checkbox"]');
      await expect(checkbox).toBeChecked();
    });

    test('unchecks a checked item', async ({ authedPage }) => {
      await authedPage.goto(`/lists/${listId}`);

      // Click the parent label of the first checked checkbox (input is visually hidden)
      const checkedLabel = authedPage.locator('input[type="checkbox"]:checked').first().locator('..');
      if (await checkedLabel.count() > 0) {
        // Use element handle to avoid lazy re-resolution issues
        const labelHandle = await checkedLabel.elementHandle();
        if (labelHandle) {
          await labelHandle.click();
          // Verify — re-query the checkbox inside this label
          const checkboxHandle = await labelHandle.$('input[type="checkbox"]');
          expect(checkboxHandle).not.toBeNull();
          expect(await checkboxHandle!.isChecked()).toBe(false);
        }
      }
    });
  });

  test.describe('Edit items', () => {
    test('edits an item name', async ({ authedPage }) => {
      const itemName = `Edit Test ${Date.now()}`;
      const updatedName = `${itemName} Updated`;
      await authedPage.goto(`/lists/${listId}`);

      // Add item
      await authedPage.fill('[placeholder="Add new item..."]', itemName);
      await authedPage.click('button:has-text("Add")');
      await expect(authedPage.locator(`text=${itemName}`)).toBeVisible();

      // Find the edit button within the list-item container
      const itemRow = authedPage.locator('.list-item').filter({ hasText: itemName });
      await itemRow.locator('button[title="Edit item"]').click();

      // Change name and save
      await authedPage.fill('[aria-label="Item name"]', updatedName);
      await authedPage.click('button[title="Save changes"]');

      await expect(authedPage.locator(`text=${updatedName}`)).toBeVisible();
    });
  });

  test.describe('Delete items', () => {
    test('deletes an item', async ({ authedPage }) => {
      const itemName = `Delete Item ${Date.now()}`;
      await authedPage.goto(`/lists/${listId}`);

      // Add item
      await authedPage.fill('[placeholder="Add new item..."]', itemName);
      await authedPage.click('button:has-text("Add")');
      await expect(authedPage.locator(`text=${itemName}`)).toBeVisible();

      // Find the delete button within the list-item container
      const itemRow = authedPage.locator('.list-item').filter({ hasText: itemName });
      await itemRow.locator('button[title="Delete item"]').click();
      await authedPage.click('button:has-text("Delete")');

      await expect(authedPage.locator(`text=${itemName}`)).not.toBeVisible();
    });
  });
});