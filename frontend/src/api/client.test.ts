import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta at the top level
vi.mock('import.meta', () => ({
  env: {
    VITE_API_URL: undefined,
  },
}));

// Mock localStorage before importing the module
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock window.location
const locationMock = {
  pathname: '/',
  href: 'http://localhost:5173/',
};
Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true,
});

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Now import the module
// Note: We need to use a different approach since the module is already loaded
// We'll re-export after mocking
import { authFetch, generateShareLink } from './client';

describe('API_BASE_URL', () => {
  it('should default to /api when VITE_API_URL is not set', async () => {
    // Since API_BASE_URL is evaluated at module load time and we've mocked
    // VITE_API_URL as undefined, it should be /api
    // We verify this by checking the axios client baseURL
    const { default: apiClient } = await import('./client');
    
    // The baseURL should be /api when VITE_API_URL is undefined
    expect(apiClient.defaults.baseURL).toBe('/api');
  });
});

describe('authFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReset();
    (localStorageMock.setItem as ReturnType<typeof vi.fn>).mockReset();
    (localStorageMock.removeItem as ReturnType<typeof vi.fn>).mockReset();
    fetchMock.mockReset();
    locationMock.pathname = '/';
    locationMock.href = 'http://localhost:5173/';
  });

  it('should not set Authorization header when no token in localStorage', async () => {
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await authFetch('/test', { method: 'GET' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );

    // Check that Authorization was NOT added
    const callArgs = fetchMock.mock.calls[0];
    const options = callArgs[1] as RequestInit;
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it('should set Authorization header with Bearer token when token exists', async () => {
    const testToken = 'my-auth-token-123';
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(testToken);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await authFetch('/test', { method: 'GET' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
        }),
      })
    );
  });

  it('should prepend API_BASE_URL to the URL', async () => {
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await authFetch('/lists/abc123/items', { method: 'GET' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/lists/abc123/items',
      expect.any(Object)
    );
  });

  it('should handle 401 by removing token and redirecting to login', async () => {
    const testToken = 'my-auth-token-123';
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(testToken);

    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );

    // Call the function - it should handle 401
    await authFetch('/test', { method: 'GET' });

    // Verify token was removed
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    
    // Verify redirect happened
    expect(locationMock.href).toBe('/login');
  });

  it('should not redirect on 401 when already on login page', async () => {
    const testToken = 'my-auth-token-123';
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(testToken);
    locationMock.pathname = '/login';

    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );

    await authFetch('/test', { method: 'GET' });

    // Token should still be removed (that's always done on 401)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    
    // But href should NOT change to /login (it was already on login)
    expect(locationMock.href).toBe('http://localhost:5173/');
  });

  it('should not redirect on 401 when already on register page', async () => {
    const testToken = 'my-auth-token-123';
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(testToken);
    locationMock.pathname = '/register';

    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );

    await authFetch('/test', { method: 'GET' });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    expect(locationMock.href).toBe('http://localhost:5173/');
  });

  it('should merge custom headers with default headers', async () => {
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await authFetch('/test', {
      method: 'GET',
      headers: { 'X-Custom-Header': 'custom-value' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        }),
      })
    );
  });

  it('should return the fetch Response object', async () => {
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    fetchMock.mockResolvedValueOnce(mockResponse);

    const response = await authFetch('/test', { method: 'GET' });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });
});

describe('generateShareLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockReset();
    fetchMock.mockReset();
    locationMock.pathname = '/';
    locationMock.href = 'http://localhost:5173/';
  });

  it('should call authFetch with correct URL and POST method', async () => {
    const listId = 'list-id-456';
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ share_code: 'abc-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await generateShareLink(listId);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/lists/${listId}/share`,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should return the share_code from the response', async () => {
    const expectedShareCode = 'share-code-xyz-789';
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ share_code: expectedShareCode }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await generateShareLink('list-id-456');

    expect(result).toBe(expectedShareCode);
  });

  it('should throw an error when response is not ok (status 500)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 500 })
    );

    await expect(generateShareLink('list-id-456')).rejects.toThrow('Failed to generate share link');
  });

  it('should throw an error when response is not ok (status 400)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 400 })
    );

    await expect(generateShareLink('list-id-456')).rejects.toThrow('Failed to generate share link');
  });

  it('should throw an error when response is not ok (status 404)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 404 })
    );

    await expect(generateShareLink('list-id-456')).rejects.toThrow('Failed to generate share link');
  });
});