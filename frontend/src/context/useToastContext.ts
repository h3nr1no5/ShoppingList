import { useContext } from 'react';
import { ToastContext } from './ToastContextType';

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}