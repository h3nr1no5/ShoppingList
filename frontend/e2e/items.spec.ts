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
      // Wait for React re-render to stabilize before clicking save.
      // The fill triggers state updates that re-render the form; without this
      // wait the button can get detached from the DOM on slower browsers (WebKit).
      await authedPage.locator('button[title="Save changes"]').waitFor({ state: 'visible' });
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
      // Set up response waiter BEFORE clicking Add
      const addResponsePromise = authedPage.waitForResponse(
        response => /\/api\/lists\/[^/]+\/items\/?$/.test(response.url()) &&
            response.request().method() === 'POST'
      );
      await authedPage.click('button:has-text("Add")');
      await addResponsePromise; // Wait for API to complete
      await expect(authedPage.locator(`text=${itemName}`)).toBeVisible();

      // Find the delete button within the list-item container
      const itemRow = authedPage.locator('.list-item').filter({ hasText: itemName });
      await itemRow.locator('button[title="Delete item"]').click();
      await authedPage.click('button:has-text("Delete")');

      await expect(authedPage.locator(`text=${itemName}`)).not.toBeVisible();
    });
  });

  test.describe('Duplicate names', () => {
    test('adding an item with an existing name succeeds', async ({ authedPage }) => {
      const itemName = `Dupe Add ${Date.now()}`;
      await authedPage.goto(`/lists/${listId}`);

      // Add first item
      await authedPage.fill('[placeholder="Add new item..."]', itemName);
      await authedPage.click('button:has-text("Add")');
      await expect(authedPage.locator('.list-item').filter({ hasText: itemName })).toHaveCount(1);

      // Add same name again
      await authedPage.fill('[placeholder="Add new item..."]', itemName);
      await authedPage.click('button:has-text("Add")');
      // Second add should be rejected by frontend duplicate validation
      await expect(authedPage.getByText('An item with this name already exists')).toBeVisible();
      await expect(authedPage.locator('.list-item').filter({ hasText: itemName })).toHaveCount(1);
    });

    test('renaming an item to an existing name is rejected', async ({ authedPage }) => {
      const base = `Dupe Rename ${Date.now()}`;
      const nameA = `${base} A`;
      const nameB = `${base} B`;
      await authedPage.goto(`/lists/${listId}`);

      // Add two items with different names
      await authedPage.fill('[placeholder="Add new item..."]', nameA);
      const addAResponse = authedPage.waitForResponse(
        response => /\/api\/lists\/[^/]+\/items\/?$/.test(response.url()) &&
            response.request().method() === 'POST'
      );
      await authedPage.click('button:has-text("Add")');
      await addAResponse;
      await expect(authedPage.locator('.list-item').filter({ hasText: nameA })).toHaveCount(1);

      await authedPage.fill('[placeholder="Add new item..."]', nameB);
      const addBResponse = authedPage.waitForResponse(
        response => /\/api\/lists\/[^/]+\/items\/?$/.test(response.url()) &&
            response.request().method() === 'POST'
      );
      await authedPage.click('button:has-text("Add")');
      await addBResponse;
      await expect(authedPage.locator('.list-item').filter({ hasText: nameB })).toHaveCount(1);

      // Rename B to A's name
      const itemRow = authedPage.locator('.list-item').filter({ hasText: nameB });
      await itemRow.locator('button[title="Edit item"]').click();
      await authedPage.fill('[aria-label="Item name"]', nameA);
      await authedPage.click('button[title="Save changes"]');

      // Rename should be rejected by frontend duplicate validation — items retain distinct names
      await expect(authedPage.getByText('An item with this name already exists')).toBeVisible();
      await expect(authedPage.locator('.list-item').filter({ hasText: nameA })).toHaveCount(1);
      await expect(authedPage.locator('.list-item').filter({ hasText: nameB })).toHaveCount(1);
    });
  });
});