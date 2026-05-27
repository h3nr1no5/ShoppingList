import { type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, INVITE_CODE } from './config';

interface UserSession {
  token: string;
  userId: string;
}

interface CreatedList {
  id: string;
  name: string;
}

interface CreatedItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

/** Build headers with Authorization only if token is provided */
function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Register a new user via the backend API and return their JWT token and user ID.
 */
export async function registerUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<UserSession> {
  const res = await request.post(`${API_BASE_URL}/auth/register`, {
    data: { email, password, invite_code: INVITE_CODE },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Register failed (${res.status()}): ${body}`);
  }

  const body = await res.json();
  const token: string = body.access_token;

  const payload = JSON.parse(atob(token.split('.')[1]));
  const userId: string = payload.sub;

  return { token, userId };
}

/**
 * Log in as an existing user.
 */
export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<UserSession> {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const res = await request.post(`${API_BASE_URL}/auth/login`, {
    data: formData.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status()}): ${body}`);
  }

  const body = await res.json();
  const token: string = body.access_token;
  const payload = JSON.parse(atob(token.split('.')[1]));
  const userId: string = payload.sub;

  return { token, userId };
}

/**
 * Create a new shopping list on behalf of the authenticated user.
 * When using authedRequest fixture, pass an empty string for token.
 */
export async function createList(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<CreatedList> {
  const res = await request.post(`${API_BASE_URL}/lists`, {
    data: { name },
    headers: authHeaders(token),
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Create list failed (${res.status()}): ${body}`);
  }

  return res.json() as unknown as CreatedList;
}

/**
 * Add an item to a shopping list.
 * When using authedRequest fixture, pass an empty string for token.
 */
export async function createItem(
  request: APIRequestContext,
  token: string,
  listId: string,
  name: string,
  quantity = 1,
  unit = 'pcs',
): Promise<CreatedItem> {
  const res = await request.post(`${API_BASE_URL}/lists/${listId}/items`, {
    data: { name, quantity, unit },
    headers: authHeaders(token),
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Create item failed (${res.status()}): ${body}`);
  }

  return res.json() as unknown as CreatedItem;
}

/**
 * Delete a shopping list.
 * When using authedRequest fixture, pass an empty string for token.
 */
export async function deleteList(
  request: APIRequestContext,
  token: string,
  listId: string,
): Promise<void> {
  const res = await request.delete(`${API_BASE_URL}/lists/${listId}`, {
    headers: authHeaders(token),
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Delete list failed (${res.status()}): ${body}`);
  }
}

/**
 * Generate a share code for a list.
 * When using authedRequest fixture, pass an empty string for token.
 */
export async function generateShareCode(
  request: APIRequestContext,
  token: string,
  listId: string,
): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/lists/${listId}/share`, {
    data: {},
    headers: authHeaders(token),
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Generate share code failed (${res.status()}): ${body}`);
  }

  const body = await res.json();
  return body.share_code as string;
}