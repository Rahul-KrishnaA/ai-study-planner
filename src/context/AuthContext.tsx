import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AuthUser } from '../types';
import {
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  loadSession,
  getUserById,
  updateUserName,
  changePassword,
} from '../services/auth';
import type { AuthError } from '../services/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateName: (name: string) => Promise<void>;
  changeUserPassword: (current: string, next: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      const found = getUserById(session.userId);
      if (found) setUser(found);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await authLogin(email, password);
    setUser(u);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user: u } = await authRegister(name, email, password);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  const updateName = useCallback(async (name: string) => {
    if (!user) return;
    await updateUserName(user.id, name);
    setUser((prev) => prev ? { ...prev, name } : prev);
  }, [user]);

  const changeUserPassword = useCallback(async (current: string, next: string) => {
    if (!user) return;
    await changePassword(user.id, current, next);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateName, changeUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export type { AuthError };
