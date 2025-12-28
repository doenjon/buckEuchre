import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../db/client.js';
import { authenticateToken, requireAdmin } from '../auth/middleware.js';

const router = Router();
const SALT_ROUNDS = 10;

// Validation schemas
const ResetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * GET /api/admin/users
 * List all users (admin only)
 * Returns basic user info excluding sensitive data
 */
router.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isGuest: true,
        isAdmin: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ users });
  } catch (error) {
    console.error('[ADMIN] Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset a user's password (admin only)
 *
 * This endpoint is designed to be compatible with future user-initiated
 * password reset flows. The admin version bypasses email verification.
 */
router.post(
  '/users/:userId/reset-password',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Validate request body
      const validation = ResetPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors,
        });
      }

      const { newPassword } = validation.data;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          isGuest: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.isGuest) {
        return res.status(400).json({
          error: 'Cannot set password for guest users',
          suggestion: 'Guest users do not have password authentication'
        });
      }

      // Hash the new password
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update the user's password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      console.log(`[ADMIN] Password reset by ${req.user!.username} for user ${user.username}`);

      res.json({
        success: true,
        message: `Password reset successfully for user '${user.username}'`,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
      });
    } catch (error) {
      console.error('[ADMIN] Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

/**
 * GET /api/admin/check
 * Check if current user has admin access
 */
router.get('/check', authenticateToken, async (req: Request, res: Response) => {
  res.json({
    isAdmin: req.user?.isAdmin || false,
    username: req.user?.username,
  });
});

export default router;
