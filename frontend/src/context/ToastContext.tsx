import { createContext, useContext } from 'react';
import { useToast } from '../hooks/useToast';
import type { Toast } from '../hooks/useToast';

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type: 'success' | 'error', autoDismissMs?: number) => void;
  dismissToast: (id: number) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();

  return (
    <ToastContext.Provider value={toast}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}