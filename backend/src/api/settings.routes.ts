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
    const userId = req.user!.id;
    const settings = await getUserSettings(userId);

    res.status(200).json(settings);
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user settings',
    });
  }
});

/**
 * PUT /api/settings
 * Update current user's settings
 */
router.put('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const validation = UpdateSettingsSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message,
        details: validation.error.errors,
      });
    }

    const settings = await updateUserSettings(userId, validation.data);

    res.status(200).json(settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update user settings',
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
