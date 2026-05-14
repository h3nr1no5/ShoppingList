import { test, expect } from './fixtures';
import { getRandomEmail, TEST_USER_PASSWORD, INVITE_CODE, API_BASE_URL } from './helpers/config';

test.describe('Authentication flows', () => {

  test.describe('Registration', () => {
    test('registers with valid invite code and redirects to home', async ({ page }) => {
      const email = getRandomEmail();
      await page.goto('/register');

      await page.fill('#inviteCode', INVITE_CODE);
      await page.fill('#email', email);
      await page.fill('#password', TEST_USER_PASSWORD);
      await page.fill('#confirmPassword', TEST_USER_PASSWORD);
      await page.click('button:has-text("Create Account")');

      // Should redirect to home page
      await expect(page).toHaveURL(/\/$/);
      // Should have token in localStorage
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
    });

    test('shows error with invalid invite code', async ({ page }) => {
      const email = getRandomEmail();
      await page.goto('/register');

      await page.fill('#inviteCode', 'WRONG_CODE');
      await page.fill('#email', email);
      await page.fill('#password', TEST_USER_PASSWORD);
      await page.fill('#confirmPassword', TEST_USER_PASSWORD);
      await page.click('button:has-text("Create Account")');

      // Should show error toast and stay on register page
      await expect(page).toHaveURL(/\/register/);
      await expect(page.locator('.toast-message')).toContainText('Invalid invite code');
    });

    test('shows validation error when passwords do not match', async ({ page }) => {
      const email = getRandomEmail();
      await page.goto('/register');

      await page.fill('#inviteCode', INVITE_CODE);
      await page.fill('#email', email);
      await page.fill('#password', TEST_USER_PASSWORD);
      await page.fill('#confirmPassword', 'different-password');
      await page.click('button:has-text("Create Account")');

      // Should show error toast
      await expect(page).toHaveURL(/\/register/);
      await expect(page.locator('.toast-message')).toContainText('Passwords do not match');
    });
  });

  test.describe('Login', () => {
    test('logs in with valid credentials and redirects to home', async ({ page }) => {
      const email = getRandomEmail();
      const password = TEST_USER_PASSWORD;

      // First register the user via API
      const res = await page.request.post(`${API_BASE_URL}/auth/register`, {
        data: { email, password, invite_code: INVITE_CODE },
      });
      expect(res.ok()).toBeTruthy();

      // Now test login flow
      await page.goto('/login');

      await page.fill('#email', email);
      await page.fill('#password', password);
      await page.click('button:has-text("Sign In")');

      // Should redirect to home
      await expect(page).toHaveURL(/\/$/);
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
    });

    test('shows error with wrong password', async ({ page }) => {
      const email = getRandomEmail();

      // Register user via API
      const res = await page.request.post(`${API_BASE_URL}/auth/register`, {
        data: { email, password: TEST_USER_PASSWORD, invite_code: INVITE_CODE },
      });
      expect(res.ok()).toBeTruthy();

      await page.goto('/login');

      await page.fill('#email', email);
      await page.fill('#password', 'wrong-password');
      await page.click('button:has-text("Sign In")');

      // Should show error toast and stay on login page
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('.toast-message')).toContainText('Incorrect email or password');
    });

    test('shows error with non-existent email', async ({ page }) => {
      await page.goto('/login');

      await page.fill('#email', 'noone@example.com');
      await page.fill('#password', TEST_USER_PASSWORD);
      await page.click('button:has-text("Sign In")');

      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('.toast-message')).toContainText('Incorrect email or password');
    });
  });

  test.describe('Logout', () => {
    test('logs out and redirects to login', async ({ freshUser: { page } }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/);

      // Click logout button in the header
      await page.click('button:has-text("Logout")');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);

      // Token should be removed
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeNull();
    });
  });
});