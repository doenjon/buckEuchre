/**
 * @module stores/settingsStore
 * @description User settings state management using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserSettings {
  showCardOverlay: boolean;
  showBidOverlay: boolean;
  showFoldOverlay: boolean;
  showSuitOverlay: boolean;
  showTooltips: boolean;
  autoSortHand: boolean;
  bidSpeed: 'slow' | 'normal' | 'fast';
  animationSpeed: 'slow' | 'normal' | 'fast';
  soundEffects: boolean;
  showDebugConsole: boolean;
}

export interface SettingsActions {
  updateSettings: (settings: Partial<UserSettings>) => void;
  resetSettings: () => void;
  setSettings: (settings: UserSettings) => void;
}

export type SettingsStore = UserSettings & SettingsActions;

const defaultSettings: UserSettings = {
  showCardOverlay: false,
  showBidOverlay: false,
  showFoldOverlay: false,
  showSuitOverlay: false,
  showTooltips: true,
  autoSortHand: true,
  bidSpeed: 'normal',
  animationSpeed: 'normal',
  soundEffects: true,
  showDebugConsole: false,
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
        showBidOverlay: state.showBidOverlay,
        showFoldOverlay: state.showFoldOverlay,
        showSuitOverlay: state.showSuitOverlay,
        showTooltips: state.showTooltips,
        autoSortHand: state.autoSortHand,
        bidSpeed: state.bidSpeed,
        animationSpeed: state.animationSpeed,
        soundEffects: state.soundEffects,
        showDebugConsole: state.showDebugConsole,
      }),
    }
  )
);
