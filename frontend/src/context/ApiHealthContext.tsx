import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApiHealth } from '../hooks/useApiHealth';
import { useToastContext } from './useToastContext';
import { ApiHealthContext, type ApiHealthContextValue } from './ApiHealthContextType';

export function ApiHealthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { showToast, dismissAll } = useToastContext();

  const { status } = useApiHealth({
    onDisconnect: () => {
      showToast(t('toasts.connection_lost'), 'error');
    },
    onReconnect: () => {
      showToast(t('toasts.back_online'), 'success');
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