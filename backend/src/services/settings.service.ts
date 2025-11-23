/**
 * Settings service for managing user preferences
 */

import { UserSettings } from '@prisma/client';
import { prisma } from '../db/client';

export interface UpdateSettingsParams {
  showCardOverlay?: boolean;
  showTooltips?: boolean;
  autoSortHand?: boolean;
  bidSpeed?: 'slow' | 'normal' | 'fast';
  animationSpeed?: 'slow' | 'normal' | 'fast';
  soundEffects?: boolean;
}

/**
 * Get user settings, creating default settings if they don't exist
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  let settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  // Create default settings if they don't exist
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: {
        userId,
        showCardOverlay: true,
        showTooltips: true,
        autoSortHand: true,
        bidSpeed: 'normal',
        animationSpeed: 'normal',
        soundEffects: true,
      },
    });
  }

  return settings;
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  updates: UpdateSettingsParams
): Promise<UserSettings> {
  // Ensure settings exist first
  await getUserSettings(userId);

  // Update settings
  const settings = await prisma.userSettings.update({
    where: { userId },
    data: updates,
  });

  return settings;
}

/**
 * Reset user settings to defaults
 */
export async function resetUserSettings(userId: string): Promise<UserSettings> {
  const settings = await prisma.userSettings.update({
    where: { userId },
    data: {
      showCardOverlay: true,
      showTooltips: true,
      autoSortHand: true,
      bidSpeed: 'normal',
      animationSpeed: 'normal',
      soundEffects: true,
    },
  });

  return settings;
}
