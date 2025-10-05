import { prisma } from '../db/client';
import { Player } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

/**
 * JWT Payload structure
 */
interface TokenPayload {
  playerId: string;
  playerName: string;
}

/**
 * Create a new player session
 * 
 * Creates a player record in the database and generates a JWT token
 * for authentication. The token expires in 24 hours.
 * 
 * @param name - Player's display name
 * @returns Player record and JWT token
 */
export async function createPlayer(name: string): Promise<{
  player: Player;
  token: string;
}> {
  if (!name || name.trim().length === 0) {
    throw new Error('Player name is required');
  }

  if (name.length > 50) {
    throw new Error('Player name must be 50 characters or less');
  }

  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  // Calculate expiration time (24 hours from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // Create player in database
  const player = await prisma.player.create({
    data: {
      name: name.trim(),
      expiresAt,
    },
  });

  // Generate JWT token
  const payload: TokenPayload = {
    playerId: player.id,
    playerName: player.name,
  };
  const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn } as jwt.SignOptions);

  return { player, token };
}

/**
 * Generate a guest player session with a random display name.
 *
 * Ensures that the generated name is unlikely to collide with
 * an existing player by attempting several random numeric suffixes
 * before falling back to a UUID-based suffix.
 */
export async function createGuestPlayer(): Promise<{
  player: Player;
  token: string;
}> {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await prisma.player.count({
      where: { name: candidate },
    });

    if (existing === 0) {
      return createPlayer(candidate);
    }
  }

  const fallback = `Guest ${randomUUID().slice(0, 8).toUpperCase()}`;
  return createPlayer(fallback);
}

/**
 * Validate that a player exists and is not expired
 * 
 * @param playerId - Player's unique ID
 * @returns Player record if valid, null if not found or expired
 */
export async function validatePlayer(playerId: string): Promise<Player | null> {
  if (!playerId) {
    return null;
  }

  try {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return null;
    }

    // Check if player session has expired
    if (new Date() > player.expiresAt) {
      return null;
    }

    return player;
  } catch (error) {
    console.error('Error validating player:', error);
    return null;
  }
}

/**
 * Get player information from a JWT token
 * 
 * Verifies the token and retrieves the player record from the database.
 * 
 * @param token - JWT token string
 * @returns Player record if valid, null if invalid or expired
 */
export async function getPlayerFromToken(token: string): Promise<Player | null> {
  if (!token) {
    return null;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    // Verify and decode token
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;

    // Validate player still exists and is not expired
    return await validatePlayer(decoded.playerId);
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
 * Clean up expired player sessions
 * 
 * This should be called periodically to remove old player records.
 * For MVP, this can be called on server startup or manually.
 */
export async function cleanupExpiredPlayers(): Promise<number> {
  try {
    const result = await prisma.player.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      console.log(`🧹 Cleaned up ${result.count} expired player session(s)`);
    }

    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired players:', error);
    return 0;
  }
}
