/**
 * @module stores/authStore
 * @description Authentication state management using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthState {
  playerId: string | null;
  playerName: string | null;
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
}

export interface AuthActions {
  login: (response: { playerId: string; playerName: string; token: string; expiresAt: number }) => void;
  logout: () => void;
  isTokenValid: () => boolean;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  playerId: null,
  playerName: null,
  token: null,
  expiresAt: null,
  isAuthenticated: false,
};

/**
 * Authentication store with localStorage persistence
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: (response) => {
        localStorage.setItem('authToken', response.token);
        set({
          playerId: response.playerId,
          playerName: response.playerName,
          token: response.token,
          expiresAt: response.expiresAt,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('authToken');
        set(initialState);
      },

      isTokenValid: () => {
        const { expiresAt } = get();
        if (!expiresAt) return false;
        return Date.now() < expiresAt;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        playerId: state.playerId,
        playerName: state.playerName,
        token: state.token,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
