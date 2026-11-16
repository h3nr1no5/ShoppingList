import { createContext } from 'react';
import type { ApiHealthStatus } from '../hooks/useApiHealth';

export interface ApiHealthContextValue {
  status: ApiHealthStatus;
  isConnected: boolean;
}

export const ApiHealthContext = createContext<ApiHealthContextValue | undefined>(undefined);
