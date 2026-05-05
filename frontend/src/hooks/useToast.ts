import { useCallback, useEffect, useRef, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface TimeoutEntry {
  timeoutId: ReturnType<typeof setTimeout>;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);
  const timeouts = useRef<Map<number, TimeoutEntry>>(new Map());

  // Cleanup: clear all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeouts.current.forEach((entry) => {
        clearTimeout(entry.timeoutId);
      });
      timeouts.current.clear();
    };
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error', autoDismissMs: number = 3000) => {
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