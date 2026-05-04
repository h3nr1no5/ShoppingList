import React, { createContext, useState, type ReactNode } from 'react';
import { type User, type LoginRequest, type RegisterRequest, type AuthResponse } from '../types';
import apiClient from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to decode JWT token
const decodeToken = (token: string): User | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub,
      email: payload.email || '',
    };
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token');
  });

  // Initialize user from stored token (don't store user object in localStorage)
  const [user, setUser] = useState<User | null>(() => {
    const storedToken = localStorage.getItem('token');
    return storedToken ? decodeToken(storedToken) : null;
  });

  const login = async (credentials: LoginRequest): Promise<void> => {
    // OAuth2PasswordRequestForm expects form-encoded data with 'username' field
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    const response = await apiClient.post<AuthResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token } = response.data;

    localStorage.setItem('token', access_token);
    setToken(access_token);

    // Decode token to get user info
    const decodedUser = decodeToken(access_token);
    setUser(decodedUser);
  };

  const register = async (data: RegisterRequest): Promise<void> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    const { access_token } = response.data;

    localStorage.setItem('token', access_token);
    setToken(access_token);

    // Decode token to get user info
    const decodedUser = decodeToken(access_token);
    setUser(decodedUser);
  };

  const logout = (): void => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        user,
        token,
        login,
        register,
        logout,
        loading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};