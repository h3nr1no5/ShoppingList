import React from 'react';
import { ApiHealthContext, type ApiHealthContextValue } from './ApiHealthContext';

export function useApiHealthContext(): ApiHealthContextValue {
  const context = React.useContext(ApiHealthContext);
  if (!context) {
    throw new Error('useApiHealthContext must be used within an ApiHealthProvider');
  }
  return context;
}