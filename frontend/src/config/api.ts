/**
 * Centralized API configuration
 * Single source of truth for all API URL construction
 *
 * Architecture: Same-origin (FastAPI serves both API + static files)
 * - VITE_API_URL is optional (defaults to same-origin /api in production)
 * - Still useful for development overrides or testing against different backends
 */

const apiUrl = import.meta.env.VITE_API_URL;

/**
 * Get the base URL for API calls (includes /api suffix)
 * Used by axios client and fetch helpers
 */
export function getApiBaseUrl(): string {
  if (apiUrl) {
    return `${apiUrl}/api`;
  }
  return '/api';
}

/**
 * Get the URL for the health endpoint (NO /api prefix)
 * The /health endpoint is at the root of the backend server
 */
export function getHealthUrl(): string {
  if (apiUrl) {
    return `${apiUrl}/health`;
  }
  return '/health';
}