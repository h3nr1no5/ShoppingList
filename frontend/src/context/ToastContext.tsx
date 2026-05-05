import { useToast } from '../hooks/useToast';
import { ToastContext } from './ToastContextType';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();

  return (
    <ToastContext.Provider value={toast}>
      {children}
    </ToastContext.Provider>
  );
}