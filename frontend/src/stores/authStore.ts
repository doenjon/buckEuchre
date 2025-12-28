/**
 * @module stores/authStore
 * @description Authentication state management using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthState {
  userId: string | null;
  username: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isAdmin: boolean;
}

export interface AuthActions {
  login: (response: {
    userId: string;
    username: string;
    displayName: string;
    email?: string | null;
    avatarUrl?: string | null;
    token: string;
    expiresAt: number;
    isGuest: boolean;
    isAdmin?: boolean;
  }) => void;
  logout: () => void;
  isTokenValid: () => boolean;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  userId: null,
  username: null,
  displayName: null,
  email: null,
  avatarUrl: null,
  token: null,
  expiresAt: null,
  isAuthenticated: false,
  isGuest: false,
  isAdmin: false,
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
          userId: response.userId,
          username: response.username,
          displayName: response.displayName,
          email: response.email || null,
          avatarUrl: response.avatarUrl || null,
          token: response.token,
          expiresAt: response.expiresAt,
          isAuthenticated: true,
          isGuest: response.isGuest,
          isAdmin: response.isAdmin || false,
        });
      },

      logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('auth-storage');
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
        userId: state.userId,
        username: state.username,
        displayName: state.displayName,
        email: state.email,
        avatarUrl: state.avatarUrl,
        token: state.token,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
