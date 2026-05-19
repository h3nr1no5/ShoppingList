import type { Toast } from '../hooks/useToast';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './ToastContainer.css';

interface ToastContainerProps {
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

function getToastIcon(type: 'success' | 'error' | 'warning'): string {
  return type === 'success' ? '✓' : type === 'warning' ? '⚠' : '';
}

export function ToastContainer({ toasts, dismissToast }: ToastContainerProps) {
  const { t } = useTranslation();
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());

  const handleDismiss = useCallback((id: number) => {
    setExitingIds((prev) => new Set(prev).add(id));
  }, []);

  const handleAnimationEnd = useCallback((id: number) => {
    setExitingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    dismissToast(id);
  }, [dismissToast]);

  // FIX: Check toasts.length instead of visibleToasts.length
  // This ensures we render exiting toasts so their exit animation plays
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" aria-live="polite" aria-label={t('accessibility.notifications')}>
      {toasts.map((toast) => {
        const isExiting = exitingIds.has(toast.id);

        return (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}${isExiting ? ' toast-exit' : ''}`}
            role="alert"
            aria-atomic="true"
            onAnimationEnd={() => isExiting && handleAnimationEnd(toast.id)}
          >
            <span className="toast-icon" aria-hidden="true">
              {getToastIcon(toast.type)}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => handleDismiss(toast.id)}
              aria-label={t('accessibility.dismiss_notification')}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}