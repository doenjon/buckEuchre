/**
 * @module stores/uiStore
 * @description UI state management using Zustand
 */

import { create } from 'zustand';

export interface UIState {
  error: string | null;
  isLoading: boolean;
  notification: string | null;
  isConnected: boolean;
}

export interface UIActions {
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setNotification: (notification: string | null) => void;
  clearNotification: () => void;
  setConnected: (connected: boolean) => void;
}

export type UIStore = UIState & UIActions;

const initialState: UIState = {
  error: null,
  isLoading: false,
  notification: null,
  isConnected: false,
};

/**
 * UI state store
 */
export const useUIStore = create<UIStore>()((set) => ({
  ...initialState,

  setError: (error) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setNotification: (notification) => {
    set({ notification });
  },

  clearNotification: () => {
    set({ notification: null });
  },

  setConnected: (isConnected) => {
    set({ isConnected });
  },
}));
