import { createContext } from 'react';
import type { Toast } from '../types/toast';

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type: 'success' | 'error', autoDismissMs?: number) => void;
  dismissToast: (id: number) => void;
  dismissAll: () => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);