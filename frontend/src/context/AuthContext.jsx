import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  async function loadUser() {
    setLoading(true);
    setSessionError('');
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setStoredToken(null);
      }
    } catch (err) {
      setUser(null);
      if (err.status === 401 || err.status === 403) setStoredToken(null);
      else setSessionError('Your session could not be checked. The server may be starting or temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    if (res.success && res.data) {
      setStoredToken(res.data.token);
      setUser(res.data.user);
      return res.data.user;
    }
    throw new Error('Login failed');
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    if (res.success && res.data) {
      setStoredToken(res.data.token);
      setUser(res.data.user);
      return res.data.user;
    }
    throw new Error('Registration failed');
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
    setSessionError('');
  };

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, retrySession: loadUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
