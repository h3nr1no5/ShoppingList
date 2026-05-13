import 'dotenv/config';

export const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL || 'e2e-test@example.com';
export const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD || 'TestE2EPassword123!';
export const INVITE_CODE = process.env.E2E_INVITE_CODE || process.env.REGISTRATION_KEY || 'Try_The_Best_Shopping_List_App_Ever_2026';
export const API_BASE_URL = 'http://localhost:8000/api';

// Must match backend requirements for password validation
export const getRandomEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;