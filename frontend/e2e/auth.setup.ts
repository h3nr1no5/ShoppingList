import { test as setup } from '@playwright/test';
import { registerUser } from './helpers/api';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD, API_BASE_URL } from './helpers/config';

const authFile = process.env.E2E_AUTH_FILE || './e2e/.auth/user.json';
const BASE_ORIGIN = process.env.E2E_BASE_URL || 'http://localhost:5173';

setup('authenticate as test user', async ({ request }) => {
  // Register the test user (safe to call if already exists — will fail and we'll fall back to login)
  try {
    await registerUser(request, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  } catch {
    // User already exists, that's fine
  }

  // Log in to get a fresh token
  const formData = new URLSearchParams();
  formData.append('username', TEST_USER_EMAIL);
  formData.append('password', TEST_USER_PASSWORD);

  const loginRes = await request.post(`${API_BASE_URL}/auth/login`, {
    data: formData.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!loginRes.ok()) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }

  const body = await loginRes.json();
  const token = body.access_token as string;

  // Save storage state with the token in localStorage
  await setup.storageState({
    path: authFile,
    state: {
      origins: [
        {
          origin: BASE_ORIGIN,
          localStorage: [
            { name: 'token', value: token },
          ],
        },
      ],
      cookies: [],
    },
  });
});