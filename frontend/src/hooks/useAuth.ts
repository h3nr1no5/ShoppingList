import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { type User, type LoginRequest, type RegisterRequest, type AuthResponse } from '../types';

// Re-export types for convenience
export { type User, type LoginRequest, type RegisterRequest, type AuthResponse };

export const useAuth = (): {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  loading: boolean;
} => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};