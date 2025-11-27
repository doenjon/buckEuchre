import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getUserSettings,
  updateUserSettings,
  resetUserSettings,
} from '../services/settings.service';
import { authenticateToken } from '../auth/middleware';

const router = Router();

// Validation schemas
const UpdateSettingsSchema = z.object({
  showCardOverlay: z.boolean().optional(),
  showTooltips: z.boolean().optional(),
  autoSortHand: z.boolean().optional(),
  bidSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
  animationSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
  soundEffects: z.boolean().optional(),
});

/**
 * GET /api/settings
 * Get current user's settings
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const userId = req.user.id;
    const settings = await getUserSettings(userId);

    res.status(200).json(settings);
  } catch (error) {
    console.error('[GET /api/settings] Error getting user settings:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user settings',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PUT /api/settings
 * Update current user's settings
 */
router.put('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const userId = req.user.id;
    console.log('[PUT /api/settings] Updating settings for user:', userId);
    console.log('[PUT /api/settings] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[PUT /api/settings] Request headers:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? 'present' : 'missing',
    });

    // Validate request body
    const validation = UpdateSettingsSchema.safeParse(req.body);

    if (!validation.success) {
      console.error('[PUT /api/settings] Validation failed:', validation.error.errors);
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message,
        details: validation.error.errors,
      });
    }

    console.log('[PUT /api/settings] Validated data:', validation.data);
    const settings = await updateUserSettings(userId, validation.data);
    console.log('[PUT /api/settings] Successfully updated settings');

    res.status(200).json(settings);
  } catch (error) {
    console.error('[PUT /api/settings] Error updating user settings:', error);
    console.error('[PUT /api/settings] Error details:', {
      userId: req.user?.id,
      body: req.body,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update user settings',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/settings/reset
 * Reset current user's settings to defaults
 */
router.post('/reset', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = await resetUserSettings(userId);

    res.status(200).json(settings);
  } catch (error) {
    console.error('Error resetting user settings:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to reset user settings',
    });
  }
});

export default router;
