/**
 * Settings service for managing user preferences
 */

import { UserSettings } from '@prisma/client';
import { prisma } from '../db/client';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master' | 'grandmaster';

export interface UpdateSettingsParams {
  showCardOverlay?: boolean;
  showTooltips?: boolean;
  autoSortHand?: boolean;
  bidSpeed?: 'slow' | 'normal' | 'fast';
  animationSpeed?: 'slow' | 'normal' | 'fast';
  soundEffects?: boolean;
  showDebugConsole?: boolean;
  showAIHints?: boolean;
  aiHintDifficulty?: AIDifficulty;
}

/**
 * Get user settings, creating default settings if they don't exist
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  // Defensive check
  if (!prisma) {
    console.error('[getUserSettings] ERROR: prisma is undefined!');
    throw new Error('Prisma client not initialized');
  }
  if (!prisma.userSettings) {
    console.error('[getUserSettings] ERROR: prisma.userSettings is undefined!');
    throw new Error('Prisma userSettings model not available');
  }

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
        showDebugConsole: false,
        showAIHints: true,
        aiHintDifficulty: 'medium',
      }
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
  console.log('[updateUserSettings] Called for user', userId, 'with updates:', updates);
  
  // Ensure settings exist first
  const existing = await getUserSettings(userId);
  console.log('[updateUserSettings] Existing settings found:', !!existing);

  // Filter out undefined values - Prisma doesn't accept undefined in update data
  const cleanUpdates: Partial<{
    showCardOverlay: boolean;
    showTooltips: boolean;
    autoSortHand: boolean;
    bidSpeed: 'slow' | 'normal' | 'fast';
    animationSpeed: 'slow' | 'normal' | 'fast';
    soundEffects: boolean;
    showDebugConsole: boolean;
    showAIHints: boolean;
    aiHintDifficulty: string;
  }> = {};

  if (updates.showCardOverlay !== undefined) cleanUpdates.showCardOverlay = updates.showCardOverlay;
  if (updates.showTooltips !== undefined) cleanUpdates.showTooltips = updates.showTooltips;
  if (updates.autoSortHand !== undefined) cleanUpdates.autoSortHand = updates.autoSortHand;
  if (updates.bidSpeed !== undefined) cleanUpdates.bidSpeed = updates.bidSpeed;
  if (updates.animationSpeed !== undefined) cleanUpdates.animationSpeed = updates.animationSpeed;
  if (updates.soundEffects !== undefined) cleanUpdates.soundEffects = updates.soundEffects;
  if (updates.showDebugConsole !== undefined) cleanUpdates.showDebugConsole = updates.showDebugConsole;
  if (updates.showAIHints !== undefined) cleanUpdates.showAIHints = updates.showAIHints;
  if (updates.aiHintDifficulty !== undefined) cleanUpdates.aiHintDifficulty = updates.aiHintDifficulty;

  console.log('[updateUserSettings] Clean updates (no undefined):', cleanUpdates);

  // If no updates provided, just return existing settings
  if (Object.keys(cleanUpdates).length === 0) {
    console.log('[updateUserSettings] No updates provided, returning existing settings');
    return existing;
  }

  // Update settings
  try {
    // Double-check that settings exist before updating
    const checkSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    
    if (!checkSettings) {
      console.error('[updateUserSettings] Settings not found for user, creating them:', userId);
      // Create settings if they don't exist (shouldn't happen due to getUserSettings above, but just in case)
      const newSettings = await prisma.userSettings.create({
        data: {
          userId,
          ...cleanUpdates,
          // Fill in defaults for any missing required fields
          showCardOverlay: cleanUpdates.showCardOverlay ?? true,
          showTooltips: cleanUpdates.showTooltips ?? true,
          autoSortHand: cleanUpdates.autoSortHand ?? true,
          bidSpeed: cleanUpdates.bidSpeed ?? 'normal',
          animationSpeed: cleanUpdates.animationSpeed ?? 'normal',
          soundEffects: cleanUpdates.soundEffects ?? true,
          showDebugConsole: cleanUpdates.showDebugConsole ?? false,
          showAIHints: cleanUpdates.showAIHints ?? true,
          aiHintDifficulty: cleanUpdates.aiHintDifficulty ?? 'medium',
        }
      });
      console.log('[updateUserSettings] Created new settings for user', userId);
      return newSettings;
    }

    const settings = await prisma.userSettings.update({
      where: { userId },
      data: cleanUpdates,
    });
    console.log('[updateUserSettings] Successfully updated settings for user', userId);
    return settings;
  } catch (error: any) {
    console.error('[updateUserSettings] Error updating settings:', error);
    console.error('[updateUserSettings] Error details:', {
      userId,
      updates,
      cleanUpdates,
      errorMessage: error?.message || String(error),
      errorCode: error?.code,
      errorMeta: error?.meta,
      errorStack: error?.stack,
      errorName: error?.name,
    });
    
    // If it's a Prisma error, provide more context
    if (error?.code === 'P2025') {
      throw new Error(`Settings not found for user ${userId}`);
    }
    if (error?.code === 'P2002') {
      throw new Error('Settings conflict: duplicate entry');
    }
    if (error?.code === 'P2003') {
      throw new Error(`Foreign key constraint failed: ${error?.meta?.field_name}`);
    }
    
    throw error;
  }
}

/**
 * Reset user settings to defaults
 */
export async function resetUserSettings(userId: string): Promise<UserSettings> {
  // Ensure settings exist first
  await getUserSettings(userId);

  // Update to defaults
  const settings = await prisma.userSettings.update({
    where: { userId },
    data: {
      showCardOverlay: true,
      showTooltips: true,
      autoSortHand: true,
      bidSpeed: 'normal',
      animationSpeed: 'normal',
      soundEffects: true,
      showDebugConsole: false,
      showAIHints: true,
      aiHintDifficulty: 'medium',
    } as any, // Type assertion needed until Prisma client is regenerated
  });

  return settings;
}
