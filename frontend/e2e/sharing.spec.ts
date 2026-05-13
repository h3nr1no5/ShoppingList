import { test, expect } from './fixtures';
import { createList, deleteList, generateShareCode } from './helpers/api';

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

    await page.goto(`http://localhost:5173/shared/${shareCode}`);

    // Should see the list name
    await expect(page.locator(`text=${listName}`)).toBeVisible();

    await context.close();
  });

  test('can add items via shared link', async ({ browser, authedRequest }) => {
    const shareCode = await generateShareCode(authedRequest, '', listId);

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`http://localhost:5173/shared/${shareCode}`);

    // Add an item
    await page.fill('[placeholder="Add new item..."]', 'Shared Item');
    await page.click('button:has-text("Add")');

    await expect(page.locator('text=Shared Item')).toBeVisible();

    await context.close();
  });
});