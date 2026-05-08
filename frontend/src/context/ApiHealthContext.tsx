import React from 'react';
import { useApiHealth, type ApiHealthStatus } from '../hooks/useApiHealth';
import { useToastContext } from './useToastContext';

interface ApiHealthContextValue {
  status: ApiHealthStatus;
  isConnected: boolean;
}

const ApiHealthContext = React.createContext<ApiHealthContextValue | undefined>(undefined);
export { ApiHealthContext };

export function ApiHealthProvider({ children }: { children: React.ReactNode }) {
  const { showToast, dismissAll } = useToastContext();

  const { status } = useApiHealth({
    onDisconnect: () => {
      showToast('Connection lost. Please check your internet.', 'error');
    },
    onReconnect: () => {
      showToast('Back online!', 'success');
      dismissAll();
    },
  });

  const value: ApiHealthContextValue = {
    status,
    isConnected: status === 'connected',
  };

  return (
    <ApiHealthContext.Provider value={value}>
      {children}
    </ApiHealthContext.Provider>
  );
}

export function useApiHealthContext(): ApiHealthContextValue {
  const context = React.useContext(ApiHealthContext);
  if (!context) {
    throw new Error('useApiHealthContext must be used within an ApiHealthProvider');
  }
  return context;
}