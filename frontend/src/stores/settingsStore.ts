/**
 * @module stores/settingsStore
 * @description User settings state management using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserSettings {
  showCardOverlay: boolean;
  showTooltips: boolean;
  autoSortHand: boolean;
  bidSpeed: 'slow' | 'normal' | 'fast';
  animationSpeed: 'slow' | 'normal' | 'fast';
  soundEffects: boolean;
}

export interface SettingsActions {
  updateSettings: (settings: Partial<UserSettings>) => void;
  resetSettings: () => void;
  setSettings: (settings: UserSettings) => void;
}

export type SettingsStore = UserSettings & SettingsActions;

const defaultSettings: UserSettings = {
  showCardOverlay: true,
  showTooltips: true,
  autoSortHand: true,
  bidSpeed: 'normal',
  animationSpeed: 'normal',
  soundEffects: true,
};

/**
 * Settings store with localStorage persistence
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateSettings: (updates) => {
        set((state) => ({
          ...state,
          ...updates,
        }));
      },

      resetSettings: () => {
        set(defaultSettings);
      },

      setSettings: (settings) => {
        set(settings);
      },
    }),
    {
      name: 'user-settings',
      partialize: (state) => ({
        showCardOverlay: state.showCardOverlay,
        showTooltips: state.showTooltips,
        autoSortHand: state.autoSortHand,
        bidSpeed: state.bidSpeed,
        animationSpeed: state.animationSpeed,
        soundEffects: state.soundEffects,
      }),
    }
  )
);
