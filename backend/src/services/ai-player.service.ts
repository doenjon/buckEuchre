import { prisma } from '../db/client';
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { joinGame } from './game.service';
import { GameState } from '@buck-euchre/shared';

/**
 * AI Player Configuration
 */
export interface AIPlayerConfig {
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  thinkingDelay: number; // ms delay to simulate thinking
}

/**
 * Default AI player names - fun and varied!
 */
const AI_NAMES = [
  'Pickles',
  'Waffles',
  'Noodles',
  'Sprinkles',
  'Giggles',
  'Bubbles',
  'Zippy',
  'Dash',
  'Flash',
  'Spark',
  'Zoom',
  'Blitz',
  'Whiskers',
  'Paws',
  'Mittens',
  'Buttons',
  'Patches',
  'Ace',
  'Rex',
  'Jazz',
  'Chip',
  'Sky',
  'Nova',
  'Cookie',
  'Muffin',
  'Biscuit',
  'Pepper',
  'Ginger',
  'Clover',
  'Maple',
  'River',
  'Storm',
  'Phoenix',
  'Cosmo',
  'Luna',
  'Atlas',
  'Echo',
  'Pixel',
  'Ziggy',
  'Comet',
];

/**
 * Get a random AI name that's not currently in use
 *
 * @returns A unique AI name
 */
async function getRandomAIName(): Promise<string> {
  // Get all currently active AI player names
  const activeAIPlayers = await prisma.user.findMany({
    where: {
      username: {
        startsWith: 'AI_',
      },
      isGuest: true,
      gamePlayers: {
        some: {
          game: {
            status: {
              in: ['WAITING', 'IN_PROGRESS'],
            },
          },
        },
      },
    },
    select: {
      displayName: true,
    },
  });

  const usedNames = new Set(activeAIPlayers.map(p => p.displayName));
  const availableNames = AI_NAMES.filter(name => !usedNames.has(name));

  // If all names are in use, just pick a random one (very unlikely with 40 names)
  const namesToChooseFrom = availableNames.length > 0 ? availableNames : AI_NAMES;

  return namesToChooseFrom[Math.floor(Math.random() * namesToChooseFrom.length)];
}

/**
 * Create an AI player
 * 
 * Creates a user record with isGuest: true for AI players.
 * AI players are special guest users with AI- prefix.
 * 
 * @param config - AI player configuration
 * @returns AI user record
 */
export async function createAIPlayer(config?: Partial<AIPlayerConfig>): Promise<User> {
  const name = config?.name || await getRandomAIName();
  const difficulty = config?.difficulty || 'medium';
  
  // Create unique username for AI
  const username = `AI_${name.replace(/\s+/g, '_')}_${Date.now()}`;
  
  // Create AI user in database as a guest
  const aiUser = await prisma.user.create({
    data: {
      username,
      displayName: name.trim(),
      isGuest: true,
    },
  });
  
  console.log(`🤖 Created AI player: ${aiUser.displayName} (${difficulty})`);
  
  return aiUser;
}

/**
 * Add an AI player to a game
 * 
 * Creates a new AI player and adds them to the specified game.
 * If the game becomes full (4 players), the game will start automatically.
 * 
 * @param gameId - ID of the game to join
 * @param config - Optional AI configuration
 * @returns Game state if game started, null if still waiting
 */
export async function addAIToGame(
  gameId: string,
  config?: Partial<AIPlayerConfig>
): Promise<GameState | null> {
  if (!gameId) {
    throw new Error('Game ID is required');
  }
  
  // Create AI user
  const aiUser = await createAIPlayer(config);
  
  // Add to game using existing joinGame logic
  try {
    // Under load Prisma can throw connection-pool timeouts (P2024). Retry a few times to
    // make "Add AI" much more reliable without creating duplicate players.
    let attempt = 0;
    const maxAttempts = 4;
    let lastError: any = null;

    while (attempt < maxAttempts) {
      try {
        const gameState = await joinGame(gameId, aiUser.id);
    
        console.log(`🤖 AI player ${aiUser.displayName} joined game ${gameId}`);
    
        return gameState;
      } catch (err: any) {
        lastError = err;

        // Retry only on transient DB/pool errors; otherwise fail fast.
        const isPoolTimeout =
          err?.code === 'P2024' ||
          (typeof err?.message === 'string' &&
            (err.message.includes('Timed out fetching a new connection') ||
              err.message.includes('connection pool') ||
              err.message.includes('P2024')));

        if (!isPoolTimeout) {
          throw err;
        }

        attempt++;
        if (attempt >= maxAttempts) {
          break;
        }

        // Exponential backoff with jitter (250ms, 500ms, 1000ms...)
        const base = 250 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 150);
        const delayMs = base + jitter;
        console.warn(
          `🤖 [addAIToGame] Transient DB error (attempt ${attempt}/${maxAttempts - 1}), retrying in ${delayMs}ms:`,
          err?.message || err
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError || new Error('Failed to add AI player');
  } catch (error: any) {
    // If join failed, clean up the AI user
    await prisma.user.delete({
      where: { id: aiUser.id },
    }).catch(err => console.error('Failed to clean up AI user:', err));
    
    throw error;
  }
}

/**
 * Check if a user ID belongs to an AI player (async - queries database)
 * 
 * @param userId - User ID to check
 * @returns True if user is AI, false otherwise
 */
export async function isAIPlayerAsync(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    
    return user ? isAIUsername(user.username) : false;
  } catch (error) {
    console.error('Error checking if user is AI:', error);
    return false;
  }
}

/**
 * Check if a player name indicates an AI player (fast - checks name pattern)
 * AI players have display names from the AI_NAMES list.
 *
 * @param playerName - Player display name from game state
 * @returns True if player name matches AI pattern, false otherwise
 */
export function isAIPlayerByName(playerName: string): boolean {
  return AI_NAMES.includes(playerName);
}

/**
 * Check if a user ID belongs to an AI player
 * This is a synchronous version that requires checking via player name
 * Use isAIPlayerByName() with player.name from GameState for best performance
 * 
 * @param userId - User ID to check (deprecated - use isAIPlayerByName or isAIPlayerAsync)
 * @returns False (always) - Use async version or name-based check instead
 * @deprecated Use isAIPlayerAsync() or isAIPlayerByName() instead
 */
export function isAIPlayer(userId: string): boolean {
  // This function is deprecated but kept for backward compatibility
  // The trigger will use the async version or name-based check
  return false;
}

/**
 * Check if a username belongs to an AI player
 * 
 * @param username - Username to check
 * @returns True if username is AI, false otherwise
 */
export function isAIUsername(username: string): boolean {
  return username.startsWith('AI_');
}

/**
 * Get all AI players in a game
 * 
 * @param gameId - ID of the game
 * @returns Array of AI user IDs in the game
 */
export async function getAIPlayersInGame(gameId: string): Promise<string[]> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              isGuest: true,
            },
          },
        },
      },
    },
  });
  
  if (!game) {
    return [];
  }
  
  return game.players
    .filter(gp => gp.user && isAIUsername(gp.user.username))
    .map(gp => gp.user!.id);
}

/**
 * Clean up AI users that are not in any active games
 * 
 * This should be called periodically to remove unused AI users.
 */
export async function cleanupUnusedAIPlayers(): Promise<number> {
  try {
    // Find all AI users (usernames starting with AI_)
    const allAIUsers = await prisma.user.findMany({
      where: {
        username: {
          startsWith: 'AI_',
        },
        isGuest: true,
      },
    });
    
    // Find AI users not in any active games
    const unusedAIUsers = await Promise.all(
      allAIUsers.map(async (user) => {
        const activeGames = await prisma.gamePlayer.findFirst({
          where: {
            userId: user.id,
            game: {
              status: {
                in: ['WAITING', 'IN_PROGRESS'],
              },
            },
          },
        });
        return activeGames ? null : user.id;
      })
    );
    
    const toDelete = unusedAIUsers.filter(id => id !== null) as string[];
    
    if (toDelete.length > 0) {
      const result = await prisma.user.deleteMany({
        where: {
          id: {
            in: toDelete,
          },
        },
      });
      
      console.log(`🧹 Cleaned up ${result.count} unused AI user(s)`);
      return result.count;
    }
    
    return 0;
  } catch (error) {
    console.error('Error cleaning up AI users:', error);
    return 0;
  }
}
