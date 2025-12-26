import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createUser,
  createGuestUser,
  authenticateUser,
  invalidateSession,
  getUserWithStats,
} from '../services/user.service.js';
import { authenticateToken } from '../auth/middleware.js';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(30, 'Display name must be at most 30 characters'),
});

const LoginSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/register
 * Register a new user account with email/password
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('[REGISTER] Starting registration request');
    
    // Validate request body
    const validation = RegisterSchema.safeParse(req.body);

    if (!validation.success) {
      console.log('[REGISTER] Validation failed:', validation.error.errors);
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message,
        details: validation.error.errors,
      });
    }

    const { email, username, password, displayName } = validation.data;
    console.log('[REGISTER] Creating user:', { username, email: email ? 'provided' : 'not provided' });

    // Create user
    const { user, token, session } = await createUser({
      email,
      username,
      password,
      displayName,
      isGuest: false,
    });

    console.log('[REGISTER] User created successfully:', { userId: user.id, username: user.username });

    // Send response
    const responseData = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      token,
      expiresAt: session.expiresAt.getTime(),
      isGuest: false,
    };

    console.log('[REGISTER] Sending success response');
    res.status(201).json(responseData);
    console.log('[REGISTER] Response sent successfully');
  } catch (error) {
    console.error('[REGISTER] Error registering user:', error);
    console.error('[REGISTER] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    if (error instanceof Error) {
      if (error.message === 'Username already taken' || error.message === 'Email already registered') {
        console.log('[REGISTER] Conflict error:', error.message);
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
      }
    }

    console.log('[REGISTER] Sending 500 error response');
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to register user',
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email/username and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = LoginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        message: validation.error.errors[0].message,
      });
    }

    const { emailOrUsername, password } = validation.data;

    // Authenticate user
    const { user, token, session } = await authenticateUser(emailOrUsername, password);

    res.status(200).json({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      token,
      expiresAt: session.expiresAt.getTime(),
      isGuest: user.isGuest,
    });
  } catch (error) {
    console.error('Error logging in:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    if (error instanceof Error && error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email/username or password',
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Failed to login',
    });
  }
});

/**
 * POST /api/auth/guest
 * Create a guest user session
 */
router.post('/guest', async (_req: Request, res: Response) => {
  try {
    const { user, token, session } = await createGuestUser();

    res.status(201).json({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      token,
      expiresAt: session.expiresAt.getTime(),
      isGuest: true,
    });
  } catch (error) {
    console.error('Error creating guest user:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Failed to create guest session',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      await invalidateSession(token);
    }

    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to logout',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile with stats
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userWithStats = await getUserWithStats(userId);

    if (!userWithStats) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    res.status(200).json({
      user: {
        id: userWithStats.id,
        username: userWithStats.username,
        displayName: userWithStats.displayName,
        email: userWithStats.email,
        avatarUrl: userWithStats.avatarUrl,
        isGuest: userWithStats.isGuest,
        createdAt: userWithStats.createdAt,
        lastLoginAt: userWithStats.lastLoginAt,
      },
      stats: userWithStats.stats ? {
        ...userWithStats.stats,
        totalTricksTaken: userWithStats.stats.tricksWon, // Frontend expects this field name
      } : null,
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user profile',
    });
  }
});

export default router;
