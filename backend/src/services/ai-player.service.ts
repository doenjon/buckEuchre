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
 * Default AI player names
 */
const AI_NAMES = [
  'Bot Alice',
  'Bot Bob',
  'Bot Charlie',
  'Bot Diana',
  'Bot Eddie',
  'Bot Fiona',
  'Bot George',
  'Bot Hannah',
];

/**
 * Get a random AI name
 */
function getRandomAIName(): string {
  return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
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
  const name = config?.name || getRandomAIName();
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
    const gameState = await joinGame(gameId, aiUser.id);
    
    console.log(`🤖 AI player ${aiUser.displayName} joined game ${gameId}`);
    
    return gameState;
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
 * AI players have display names like "Bot Alice", "Bot Bob", etc.
 * 
 * @param playerName - Player display name from game state
 * @returns True if player name matches AI pattern, false otherwise
 */
export function isAIPlayerByName(playerName: string): boolean {
  return playerName.startsWith('Bot ');
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
