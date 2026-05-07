import { useState, useEffect, useCallback, useRef } from 'react';
import { getHealthUrl } from '../config/api';

export type ApiHealthStatus = 'connected' | 'disconnected' | 'checking';

interface UseApiHealthOptions {
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

const POLLING_INTERVAL = 10000; // 10 seconds
const FETCH_TIMEOUT = 5000; // 5 seconds

export function useApiHealth(options: UseApiHealthOptions = {}) {
  const [status, setStatus] = useState<ApiHealthStatus>('checking');
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const { onDisconnect, onReconnect } = options;

  // Previous status ref to detect transitions
  const prevStatusRef = useRef<ApiHealthStatus>('checking');

  // Refs for callbacks to keep them stable across renders
  const onDisconnectRef = useRef(onDisconnect);
  const onReconnectRef = useRef(onReconnect);

  // Keep refs updated after every render (NOT in a deps array)
  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
    onReconnectRef.current = onReconnect;
  });

  // Handle status transitions with callbacks
  const handleStatusChange = useCallback(
    (newStatus: ApiHealthStatus) => {
      const previousStatus = prevStatusRef.current;

      // Only trigger callbacks on actual transitions, not initial state
      if (previousStatus === 'connected' && newStatus === 'disconnected') {
        onDisconnectRef.current?.();
      } else if (previousStatus === 'disconnected' && newStatus === 'connected') {
        onReconnectRef.current?.();
      }

      prevStatusRef.current = newStatus;
      setStatus(newStatus);
    },
    [] // Stable: refs and setState are stable across renders
  );

  const checkHealth = useCallback(async () => {
    // Abort previous request if still pending
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const healthUrl = getHealthUrl();
    
    if (!healthUrl) {
      console.error('Cannot construct health URL: VITE_API_URL is not set');
      abortRef.current = null; // Clean up any stale ref before early return
      handleStatusChange('disconnected');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      if (response.ok) {
        // Don't report connected if browser says we're offline.
        // This prevents a race condition where an in-flight health check
        // response arrives after the 'offline' event has already fired.
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          handleStatusChange('connected');
        } else {
          handleStatusChange('disconnected');
        }
      } else {
        handleStatusChange('disconnected');
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      // Treat abort errors (timeout or superseded by new check) as disconnected
      if (error instanceof Error && error.name === 'AbortError') {
        handleStatusChange('disconnected');
        return;
      }

      handleStatusChange('disconnected');
    } finally {
      // Clear the ref if this was the current request
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [handleStatusChange]);

  useEffect(() => {
    mountedRef.current = true; // Must reset on (re-)mount for React Strict Mode compatibility

    // Perform initial health check using IIFE to avoid set-state-in-effect warning
    (async () => {
      await checkHealth();
    })();

    // Set up polling interval (10 seconds)
    intervalRef.current = window.setInterval(() => {
      checkHealth();
    }, POLLING_INTERVAL);

    // Set up online/offline event listeners for immediate status detection
    const handleOnline = () => {
      // Immediately check health when back online
      if (mountedRef.current) {
        checkHealth();
      }
    };

    const handleOffline = () => {
      if (mountedRef.current) {
        // Abort in-flight health checks when going offline
        abortRef.current?.abort();
        handleStatusChange('disconnected');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkHealth, handleStatusChange]);

  return { status };
}