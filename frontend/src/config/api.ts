/**
 * Centralized API configuration
 * Single source of truth for all API URL construction
 */

const isDev = import.meta.env.DEV;
const apiUrl = import.meta.env.VITE_API_URL;

// Validate at module load time
if (!isDev && !apiUrl) {
  console.error(
    'FATAL: VITE_API_URL is not set in production. ' +
    'Set it in frontend/.env or via the build process.'
  );
  // In production, throw to fail fast
  throw new Error('VITE_API_URL is required in production');
}

export function isDevelopment(): boolean {
  return isDev;
}

/**
 * Get the base URL for API calls (includes /api suffix)
 * Used by axios client and fetch helpers
 */
export function getApiBaseUrl(): string {
  if (apiUrl) {
    return `${apiUrl}/api`;
  }
  // In development, use relative path (Vite proxies /api to localhost:8000)
  if (isDev) {
    return '/api';
  }
  // This should never happen due to validation above, but fallback gracefully
  console.error('VITE_API_URL is not set');
  return '/api';
}

/**
 * Get the URL for the health endpoint (NO /api prefix)
 * The /health endpoint is at the root of the backend server
 */
export function getHealthUrl(): string | null {
  if (apiUrl) {
    return `${apiUrl}/health`;
  }
  // In development, hit localhost:8000 directly
  if (isDev) {
    return 'http://localhost:8000/health';
  }
  // In production without VITE_API_URL, return null (health check will be disabled)
  console.error('Cannot construct health URL: VITE_API_URL is not set');
  return null;
}