import { test, expect } from './fixtures';
import { createItem, createList, deleteList, generateShareCode } from './helpers/api';

let listId: string;
let listName: string;

test.describe('List sharing', () => {

  test.beforeAll(async ({ authedRequest }) => {
    listName = `Share Test ${Date.now()}`;
    const list = await createList(authedRequest, '', listName);
    listId = list.id;
  });

  test.afterAll(async ({ authedRequest }) => {
    if (listId) {
      try {
        await deleteList(authedRequest, '', listId);
      } catch {
        // ignore
      }
    }
  });

  test('generates a share link', async ({ authedPage }) => {
    // Go to the list detail page
    await authedPage.goto(`/lists/${listId}`);
    await expect(authedPage.locator(`text=${listName}`)).toBeVisible();

    // Click share button
    await authedPage.click('button:has-text("Share")');

    // Share modal should appear — either show "Generate Share Link" or existing share URL
    await expect(authedPage.locator('text=Share List')).toBeVisible();
    
    // If it shows "Generate Share Link", click it
    const generateBtn = authedPage.locator('button:has-text("Generate Share Link")');
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      // Wait for the URL input to appear
      await expect(authedPage.locator('#share-url')).toBeVisible({ timeout: 5000 });
    }

    // The share URL should be visible in the readonly input
    const shareUrl = await authedPage.inputValue('#share-url');
    expect(shareUrl).toContain('/shared/');
  });

  test('opens shared list without authentication', async ({ browser, authedRequest }) => {
    // Generate a share code via API
    const shareCode = await generateShareCode(authedRequest, '', listId);
    expect(shareCode).toBeTruthy();

    // Open the shared URL in a new browser context (no auth)
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/shared/${shareCode}`);

    // Should see the list name
    await expect(page.locator(`text=${listName}`)).toBeVisible();

    await context.close();
  });

  test('can add items via shared link', async ({ browser, authedRequest }) => {
    const shareCode = await generateShareCode(authedRequest, '', listId);

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/shared/${shareCode}`);

    // Add an item
    await page.fill('[placeholder="Add new item..."]', 'Shared Item');
    await page.click('button:has-text("Add")');

    await expect(page.locator('text=Shared Item')).toBeVisible();

    await context.close();
  });

  test.describe('Duplicate items in shared lists', () => {
    let shareCode: string;

    test.beforeAll(async ({ authedRequest }) => {
      // Pre-add "Milk" to the shared list via API before creating share code
      const res = await authedRequest.post(`/api/lists/${listId}/items`, {
        data: { name: 'Milk', quantity: 1 },
      });
      if (!res.ok()) throw new Error(`Pre-add item failed: ${await res.text()}`);
      
      const shareRes = await authedRequest.post(`/api/lists/${listId}/share`, { data: {} });
      if (!shareRes.ok()) throw new Error(`Share code gen failed: ${await shareRes.text()}`);
      const shareBody = await shareRes.json();
      shareCode = shareBody.share_code;
    });

    test('adding a duplicate item via shared link is rejected', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator('text=Milk')).toBeVisible();

      await page.fill('[placeholder="Add new item..."]', 'Milk');
      await page.click('button:has-text("Add")');

      await expect(page.getByText('An item with this name already exists')).toBeVisible();
      await expect(page.locator('.list-item').filter({ hasText: 'Milk' })).toHaveCount(1);
      await context.close();
    });

    test('renaming an item to an existing name via shared link is rejected', async ({ authedRequest, browser }) => {
      // Add a second item via API
      const res = await authedRequest.post(`/api/lists/${listId}/items`, {
        data: { name: 'Eggs', quantity: 1 },
      });
      if (!res.ok()) throw new Error(`Pre-add item failed: ${await res.text()}`);

      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator('text=Milk')).toBeVisible();
      await expect(page.locator('text=Eggs')).toBeVisible();

      // Rename "Eggs" to "Milk"
      const itemRow = page.locator('.list-item').filter({ hasText: 'Eggs' });
      await itemRow.locator('button[title="Edit item"]').click();
      await page.fill('[aria-label="Item name"]', 'Milk');
      await page.click('button[title="Save changes"]');

      await expect(page.getByText('An item with this name already exists')).toBeVisible();
      await expect(page.locator('.list-item').filter({ hasText: 'Milk' })).toHaveCount(1);
      await expect(page.locator('.list-item').filter({ hasText: 'Eggs' })).toHaveCount(1);
      await context.close();
    });
  });

  test.describe('Item CRUD via shared link', () => {
    let shareCode: string;
    let crudListId: string;
    let crudListName: string;

    test.beforeAll(async ({ authedRequest }) => {
      // Create a separate list for CRUD tests
      crudListName = `CRUD Test ${Date.now()}`;
      const list = await createList(authedRequest, '', crudListName);
      crudListId = list.id;

      // Add items to the list
      await authedRequest.post(`/api/lists/${crudListId}/items`, {
        data: { name: 'Toggle Item', quantity: 1 },
      });
      await authedRequest.post(`/api/lists/${crudListId}/items`, {
        data: { name: 'Edit Item', quantity: 1 },
      });
      await authedRequest.post(`/api/lists/${crudListId}/items`, {
        data: { name: 'Delete Item', quantity: 1 },
      });

      // Generate share code
      shareCode = await generateShareCode(authedRequest, '', crudListId);
    });

    test.afterAll(async ({ authedRequest }) => {
      if (crudListId) {
        try {
          await deleteList(authedRequest, '', crudListId);
        } catch {
          // ignore
        }
      }
    });

    test('toggles an item via shared link', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator('text=Toggle Item')).toBeVisible();

      // Click the checkbox to toggle
      const itemRow = page.locator('.list-item').filter({ hasText: 'Toggle Item' });
      await itemRow.locator('label.list-item-checkbox').click();

      // Verify the checkbox became checked
      const checkbox = itemRow.locator('input[type="checkbox"]');
      await expect(checkbox).toBeChecked();

      // Toggle back
      await itemRow.locator('label.list-item-checkbox').click();
      await expect(checkbox).not.toBeChecked();

      await context.close();
    });

    test('edits an item via shared link', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator('text=Edit Item')).toBeVisible();

      // Edit the item
      const itemRow = page.locator('.list-item').filter({ hasText: 'Edit Item' });
      await itemRow.locator('button[title="Edit item"]').click();
      await page.fill('[aria-label="Item name"]', 'Edited Item');
      await page.click('button[title="Save changes"]');

      await expect(page.locator('text=Edited Item')).toBeVisible();
      await expect(page.locator('text=Edit Item')).not.toBeVisible();

      await context.close();
    });

    test('deletes an item via shared link', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator('text=Delete Item')).toBeVisible();

      // Delete the item
      const itemRow = page.locator('.list-item').filter({ hasText: 'Delete Item' });
      await itemRow.locator('button[title="Delete item"]').click();
      await page.click('button:has-text("Delete")');

      await expect(page.locator('text=Delete Item')).not.toBeVisible();

      await context.close();
    });
  });

  test.describe('Share modal interaction', () => {
    let shareCode: string;
    let modalListId: string;
    let modalListName: string;

    test.beforeAll(async ({ authedRequest }) => {
      modalListName = `Modal Test ${Date.now()}`;
      const list = await createList(authedRequest, '', modalListName);
      modalListId = list.id;
      shareCode = await generateShareCode(authedRequest, '', modalListId);
    });

    test.afterAll(async ({ authedRequest }) => {
      if (modalListId) {
        try {
          await deleteList(authedRequest, '', modalListId);
        } catch {
          // ignore
        }
      }
    });

    test('re-generates share link', async ({ authedPage }) => {
      await authedPage.goto(`/lists/${modalListId}`);
      await expect(authedPage.locator(`text=${modalListName}`)).toBeVisible();

      // Click share button
      await authedPage.click('button:has-text("Share")');
      await expect(authedPage.locator('text=Share List')).toBeVisible();

      // Get the first share URL
      const firstShareUrl = await authedPage.inputValue('#share-url');
      expect(firstShareUrl).toContain('/shared/');

      // Close modal by clicking the close button (class modal-close)
      await authedPage.locator('.modal-close').click();
      // Wait for modal to close
      await authedPage.waitForTimeout(500);
      await authedPage.click('button:has-text("Share")');

      // The existing share code should be shown
      const secondShareUrl = await authedPage.inputValue('#share-url');
      expect(secondShareUrl).toContain('/shared/');
      expect(secondShareUrl).toBe(firstShareUrl);
    });

    test('copies share URL to clipboard', async ({ authedPage }) => {
      // Navigate and open share modal
      await authedPage.goto(`/lists/${modalListId}`);
      await authedPage.click('button:has-text("Share")');
      await expect(authedPage.locator('text=Share List')).toBeVisible();

      // Click copy button - the copy button text changes to "Copied" after clicking
      const copyButton = authedPage.locator('button:has-text("Copy")');
      await copyButton.click();

      // Wait a bit for the copy to complete
      await authedPage.waitForTimeout(500);

      // Verify the button text changed to "Copied"
      await expect(authedPage.locator('button:has-text("Copied")')).toBeVisible();
    });
  });

  test.describe('UI states', () => {
    test('shows shared list badge on shared page', async ({ browser, authedRequest }) => {
      const listName = `Badge Test ${Date.now()}`;
      const list = await createList(authedRequest, '', listName);
      const shareCode = await generateShareCode(authedRequest, '', list.id);

      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator(`text=${listName}`)).toBeVisible();
      await expect(page.locator('.badge-shared')).toBeVisible();

      await context.close();

      // Cleanup
      try {
        await deleteList(authedRequest, '', list.id);
      } catch {
        // ignore
      }
    });

    test('shows error for invalid share code', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/shared/invalid-code-12345');

      // Should show error message - check for error-message class or the text
      await expect(page.locator('.error-message')).toBeVisible();

      await context.close();
    });

    test('shows empty state when shared list has no items', async ({ browser, authedRequest }) => {
      const listName = `Empty Test ${Date.now()}`;
      const list = await createList(authedRequest, '', listName);
      const shareCode = await generateShareCode(authedRequest, '', list.id);

      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator(`text=${listName}`)).toBeVisible();
      await expect(page.locator('.empty-state')).toBeVisible();
      await expect(page.getByText('No items in this list.')).toBeVisible();

      await context.close();

      // Cleanup
      try {
        await deleteList(authedRequest, '', list.id);
      } catch {
        // ignore
      }
    });
  });

  test.describe('Progress bar', () => {
    test('shows progress bar in shared list', async ({ browser, authedRequest }) => {
      const listName = `Progress Test ${Date.now()}`;
      const list = await createList(authedRequest, '', listName);
      const listId = list.id;

      // Add items and check some of them
      const item1 = await authedRequest.post(`/api/lists/${listId}/items`, {
        data: { name: 'Item 1', quantity: 1 },
      });
      const item1Id = (await item1.json()).id;

      await authedRequest.post(`/api/lists/${listId}/items`, {
        data: { name: 'Item 2', quantity: 1 },
      });

      await authedRequest.post(`/api/lists/${listId}/items`, {
        data: { name: 'Item 3', quantity: 1 },
      });

      // Check one item via API
      await authedRequest.put(`/api/items/${item1Id}`, {
        data: { is_checked: true },
      });

      const shareCode = await generateShareCode(authedRequest, '', listId);

      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/shared/${shareCode}`);
      await expect(page.locator(`text=${listName}`)).toBeVisible();

      // Verify progress bar is visible
      await expect(page.locator('.progress-bar')).toBeVisible();

      // Verify progress text shows correct count
      await expect(page.getByText('1 of 3 items checked')).toBeVisible();

      // Verify progress fill has correct width (33%)
      const progressFill = page.locator('.progress-fill');
      await expect(progressFill).toBeVisible();
      const width = await progressFill.evaluate((el) => {
        return parseFloat((el as HTMLElement).style.width);
      });
      expect(width).toBeCloseTo(33, 0);

      await context.close();

      // Cleanup
      try {
        await deleteList(authedRequest, '', listId);
      } catch {
        // ignore
      }
    });
  });
});