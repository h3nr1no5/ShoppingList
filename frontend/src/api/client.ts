import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getApiBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();

function createApiClient(withRedirectInterceptor: boolean) {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add JWT token
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  if (withRedirectInterceptor) {
    // Response interceptor to handle 401 errors (only on standard client)
    client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          // Don't redirect if already on login or register page
          if (!window.location.pathname.startsWith('/login') &&
              !window.location.pathname.startsWith('/register')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  return client;
}

const apiClient = createApiClient(true);
const apiClientNoRedirect = createApiClient(false);

export default apiClient;
export { apiClientNoRedirect };

// Helper function for authenticated fetch requests
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    if (!window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }
  }

  return response;
}

// API functions
export async function generateShareLink(listId: string): Promise<string> {
  const response = await authFetch(`/lists/${listId}/share`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to generate share link');
  }

  const data = await response.json();
  return data.share_code;
}