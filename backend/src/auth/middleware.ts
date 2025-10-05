import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyToken, TokenPayload } from './jwt';
import { validatePlayer } from '../services/player.service';

/**
 * Extend Express Request to include authenticated player info
 */
declare global {
  namespace Express {
    interface Request {
      player?: {
        id: string;
        name: string;
      };
    }
  }
}

/**
 * Authentication middleware for Express routes
 * 
 * Validates JWT token from Authorization header and verifies
 * the player exists and is not expired.
 * 
 * If authentication succeeds, adds `req.player` with player info.
 * If authentication fails, sends 401 Unauthorized response.
 * 
 * @example
 * ```typescript
 * router.post('/games/create', authenticateToken, async (req, res) => {
 *   const playerId = req.player!.id;
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

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Validate player still exists and is not expired
    const player = await validatePlayer(decoded.playerId);

    if (!player) {
      res.status(401).json({ error: 'Player session expired or invalid' });
      return;
    }

    // Attach player info to request
    req.player = {
      id: player.id,
      name: player.name,
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
 * If a valid token is provided, sets req.player.
 * If no token or invalid token, req.player remains undefined.
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
      const decoded = verifyToken(token);

      if (decoded) {
        const player = await validatePlayer(decoded.playerId);

        if (player) {
          req.player = {
            id: player.id,
            name: player.name,
          };
        }
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // For optional auth, we don't block the request on errors
    next();
  }
}
