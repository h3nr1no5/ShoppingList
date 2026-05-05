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

  // Handle status transitions with callbacks
  const handleStatusChange = useCallback(
    (newStatus: ApiHealthStatus) => {
      const previousStatus = prevStatusRef.current;

      // Only trigger callbacks on actual transitions, not initial state
      if (previousStatus === 'connected' && newStatus === 'disconnected') {
        onDisconnect?.();
      } else if (previousStatus === 'disconnected' && newStatus === 'connected') {
        onReconnect?.();
      }

      prevStatusRef.current = newStatus;
      setStatus(newStatus);
    },
    [onDisconnect, onReconnect]
  );

  const checkHealth = useCallback(async () => {
    // Abort previous request if still pending
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const healthUrl = getHealthUrl();
    
    if (!healthUrl) {
      console.error('Cannot construct health URL: VITE_API_URL is not set');
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
      });

      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      if (response.ok) {
        handleStatusChange('connected');
      } else {
        handleStatusChange('disconnected');
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      // Don't treat abort errors as disconnects if we aborted due to unmount
      if (error instanceof Error && error.name === 'AbortError') {
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