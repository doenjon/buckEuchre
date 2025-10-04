import jwt from 'jsonwebtoken';

/**
 * JWT Token Payload
 */
export interface TokenPayload {
  playerId: string;
  playerName: string;
}

/**
 * Generate a JWT token for a player
 * 
 * @param playerId - Player's unique ID
 * @param playerName - Player's display name
 * @returns Signed JWT token
 */
export function generateToken(playerId: string, playerName: string): string {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  if (!playerId || !playerName) {
    throw new Error('Player ID and name are required to generate token');
  }

  const payload: TokenPayload = {
    playerId,
    playerName,
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 * 
 * @param token - JWT token string
 * @returns Decoded token payload, or null if invalid
 */
export function verifyToken(token: string): TokenPayload | null {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return null;
    }
    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Extract token from Authorization header
 * 
 * Supports "Bearer <token>" format
 * 
 * @param authHeader - Authorization header value
 * @returns Token string, or null if not found
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
