'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, storeToken, removeToken, getMe, type AuthResponse } from '../services/authService';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  name?: string;
  image_url?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for token on mount and validate it
    const storedToken = getToken();
    if (storedToken) {
      setToken(storedToken);
      // Validate token by fetching user profile
      getMe(storedToken)
        .then((userData) => {
          setUser(userData || null);
          setIsAuthenticated(true);
        })
        .catch(() => {
          // Token is invalid, remove it
          removeToken();
          setToken(null);
          setIsAuthenticated(false);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, userData: User) => {
    storeToken(newToken);
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    removeToken();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};

