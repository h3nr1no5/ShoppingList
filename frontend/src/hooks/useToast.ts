import { useCallback, useEffect, useRef, useState } from 'react';
import type { Toast } from '../types/toast';

export type { Toast } from '../types/toast';

interface TimeoutEntry {
  timeoutId: ReturnType<typeof setTimeout>;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);
  const timeouts = useRef<Map<number, TimeoutEntry>>(new Map());

  // Cleanup: clear all pending timeouts on unmount
  useEffect(() => {
    // Copy ref to local variable at the start of effect
    const timeoutsCopy = timeouts.current;
    return () => {
      timeoutsCopy.forEach((entry) => {
        clearTimeout(entry.timeoutId);
      });
      timeoutsCopy.clear();
    };
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning', autoDismissMs: number = 3000) => {
      const id = ++idCounter.current;

      setToasts((prev) => [...prev, { id, message, type }]);

      if (autoDismissMs > 0) {
        const timeoutId = setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
          timeouts.current.delete(id);
        }, autoDismissMs);

        timeouts.current.set(id, { timeoutId });
      }
    },
    []
  );

  const dismissToast = useCallback(
    (id: number) => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));

      const timeoutEntry = timeouts.current.get(id);
      if (timeoutEntry) {
        clearTimeout(timeoutEntry.timeoutId);
        timeouts.current.delete(id);
      }
    },
    []
  );

  const dismissAll = useCallback(() => {
    setToasts([]);

    timeouts.current.forEach((entry) => {
      clearTimeout(entry.timeoutId);
    });
    timeouts.current.clear();
  }, []);

  return { toasts, showToast, dismissToast, dismissAll };
}