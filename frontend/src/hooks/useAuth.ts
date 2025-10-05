/**
 * @module hooks/useAuth
 * @description Custom hook for authentication
 */

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { joinAsGuest, joinSession } from '@/services/api';

export function useAuth() {
  const authStore = useAuthStore();
  const { setError, setLoading } = useUIStore();

  const login = useCallback(async (playerName: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await joinSession(playerName);
      authStore.login(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join session';
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

  const logout = useCallback(() => {
    authStore.logout();
  }, [authStore]);

  const checkAuth = useCallback(() => {
    if (!authStore.isAuthenticated) {
      return false;
    }
    
    if (!authStore.isTokenValid()) {
      authStore.logout();
      return false;
    }
    
    return true;
  }, [authStore]);

  return {
    playerId: authStore.playerId,
    playerName: authStore.playerName,
    token: authStore.token,
    isAuthenticated: authStore.isAuthenticated,
    isGuest: authStore.isGuest,
    login,
    loginAsGuest,
    logout,
    checkAuth,
  };
}
