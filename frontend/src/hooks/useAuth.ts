/**
 * @module hooks/useAuth
 * @description Custom hook for authentication
 */

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { login as loginAPI, register as registerAPI, logout as logoutAPI, joinAsGuest } from '@/services/api';
import { handleSessionExpired } from '@/lib/authSession';

export function useAuth() {
  const authStore = useAuthStore();
  const { setError, setLoading } = useUIStore();

  const register = useCallback(async (data: {
    username: string;
    email?: string;
    password: string;
    displayName: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await registerAPI(data);
      authStore.login(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register';
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [authStore, setError, setLoading]);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await loginAPI(emailOrUsername, password);
      authStore.login(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to login';
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [authStore, setError, setLoading]);

  const loginAsGuest = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await joinAsGuest();
      authStore.login(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join as guest';
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [authStore, setError, setLoading]);

  const logout = useCallback(async () => {
    try {
      await logoutAPI();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      authStore.logout();
    }
  }, [authStore]);

  const checkAuth = useCallback(() => {
    if (!authStore.isAuthenticated) {
      return false;
    }
    
    if (!authStore.isTokenValid()) {
      handleSessionExpired();
      return false;
    }
    
    return true;
  }, [authStore]);

  return {
    userId: authStore.userId,
    username: authStore.username,
    displayName: authStore.displayName,
    email: authStore.email,
    avatarUrl: authStore.avatarUrl,
    token: authStore.token,
    isAuthenticated: authStore.isAuthenticated,
    isGuest: authStore.isGuest,
    isAdmin: authStore.isAdmin,
    register,
    login,
    loginAsGuest,
    logout,
    checkAuth,
  };
}
