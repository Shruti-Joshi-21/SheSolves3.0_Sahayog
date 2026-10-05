import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'sahayog_token';
const ROLE_KEY = 'sahayog_role';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const rehydrate = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const role = localStorage.getItem(ROLE_KEY);
    if (token && role) {
      setUser((prev) => ({
        ...prev,
        token,
        role,
        fullName: prev?.fullName ?? '',
        userId: prev?.userId ?? '',
      }));
    }
  }, []);

  useEffect(() => {
    rehydrate();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        const u = data.data;
        setUser({
          token,
          role: u.role || u.role_name,
          fullName: u.fullName || u.name || '',
          userId: u._id ? String(u._id) : u.id || '',
        });
        if (u.role || u.role_name) {
          localStorage.setItem(ROLE_KEY, u.role || u.role_name);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ROLE_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [rehydrate]);

  const login = useCallback((userData) => {
    const next = {
      token: userData.token,
      role: userData.role,
      fullName: userData.fullName ?? userData.name ?? '',
      userId: userData.userId ?? userData.id ?? '',
    };
    localStorage.setItem(TOKEN_KEY, next.token);
    localStorage.setItem(ROLE_KEY, next.role);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const isAuthenticated = !!user?.token;

  const hasRole = useCallback((role) => user?.role === role, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAuthenticated,
      hasRole,
      rehydrate,
    }),
    [user, loading, login, logout, isAuthenticated, hasRole, rehydrate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
