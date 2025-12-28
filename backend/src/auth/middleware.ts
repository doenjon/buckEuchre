import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyToken, TokenPayload } from './jwt.js';
import { validateSession } from '../services/user.service.js';

/**
 * Extend Express Request to include authenticated user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        displayName: string;
        isGuest: boolean;
        isAdmin: boolean;
      };
    }
  }
}

/**
 * Authentication middleware for Express routes
 * 
 * Validates JWT token from Authorization header and verifies
 * the user session is valid.
 * 
 * If authentication succeeds, adds `req.user` with user info.
 * If authentication fails, sends 401 Unauthorized response.
 * 
 * @example
 * ```typescript
 * router.post('/games/create', authenticateToken, async (req, res) => {
 *   const userId = req.user!.id;
 *   // ... create game
 * });
 * ```
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: 'Authentication token required' });
      return;
    }

    // Validate session
    const result = await validateSession(token);

    if (!result) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    // Attach user info to request
    req.user = {
      id: result.user.id,
      username: result.user.username,
      displayName: result.user.displayName,
      isGuest: result.user.isGuest,
      isAdmin: result.user.isAdmin,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // JWT verification errors should return 401, not 500
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication middleware
 * 
 * Similar to authenticateToken, but allows requests without a token to proceed.
 * If a valid token is provided, sets req.user.
 * If no token or invalid token, req.user remains undefined.
 * 
 * Useful for endpoints that work for both authenticated and unauthenticated users.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const result = await validateSession(token);

      if (result) {
        req.user = {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName,
          isGuest: result.user.isGuest,
          isAdmin: result.user.isAdmin,
        };
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // For optional auth, we don't block the request on errors
    next();
  }
}

/**
 * Admin authorization middleware
 *
 * Must be used AFTER authenticateToken middleware.
 * Checks if the authenticated user has admin privileges.
 *
 * If user is not admin, sends 403 Forbidden response.
 *
 * @example
 * ```typescript
 * router.post('/admin/users/:id/reset-password',
 *   authenticateToken,
 *   requireAdmin,
 *   async (req, res) => {
 *     // Only admins can access this
 *   }
 * );
 * ```
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
