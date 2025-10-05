import { prisma } from '../db/client';
import { Player } from '@prisma/client';
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
 * Creates a player record with a special AI prefix in the ID.
 * AI players don't expire like regular players.
 * 
 * @param config - AI player configuration
 * @returns AI player record
 */
export async function createAIPlayer(config?: Partial<AIPlayerConfig>): Promise<Player> {
  const name = config?.name || getRandomAIName();
  const difficulty = config?.difficulty || 'medium';
  
  // Create AI player ID with special prefix
  const aiId = `ai-${uuidv4()}`;
  
  // AI players don't expire (set far future date)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 100);
  
  // Create AI player in database
  const player = await prisma.player.create({
    data: {
      id: aiId,
      name: name.trim(),
      expiresAt,
    },
  });
  
  console.log(`🤖 Created AI player: ${player.name} (${difficulty})`);
  
  return player;
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
  
  // Create AI player
  const aiPlayer = await createAIPlayer(config);
  
  // Add to game using existing joinGame logic
  try {
    const gameState = await joinGame(gameId, aiPlayer.id);
    
    console.log(`🤖 AI player ${aiPlayer.name} joined game ${gameId}`);
    
    return gameState;
  } catch (error: any) {
    // If join failed, clean up the AI player
    await prisma.player.delete({
      where: { id: aiPlayer.id },
    }).catch(err => console.error('Failed to clean up AI player:', err));
    
    throw error;
  }
}

/**
 * Check if a player ID belongs to an AI player
 * 
 * @param playerId - Player ID to check
 * @returns True if player is AI, false otherwise
 */
export function isAIPlayer(playerId: string): boolean {
  return playerId.startsWith('ai-');
}

/**
 * Get all AI players in a game
 * 
 * @param gameId - ID of the game
 * @returns Array of AI player IDs in the game
 */
export async function getAIPlayersInGame(gameId: string): Promise<string[]> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: {
          player: true,
        },
      },
    },
  });
  
  if (!game) {
    return [];
  }
  
  return game.players
    .filter(gp => isAIPlayer(gp.player.id))
    .map(gp => gp.player.id);
}

/**
 * Clean up AI players that are not in any active games
 * 
 * This should be called periodically to remove unused AI players.
 */
export async function cleanupUnusedAIPlayers(): Promise<number> {
  try {
    // Find all AI players
    const allAIPlayers = await prisma.player.findMany({
      where: {
        id: {
          startsWith: 'ai-',
        },
      },
    });
    
    // Find AI players not in any active games
    const unusedAIPlayers = await Promise.all(
      allAIPlayers.map(async (player) => {
        const activeGames = await prisma.gamePlayer.findFirst({
          where: {
            playerId: player.id,
            game: {
              status: {
                in: ['WAITING', 'IN_PROGRESS'],
              },
            },
          },
        });
        return activeGames ? null : player.id;
      })
    );
    
    const toDelete = unusedAIPlayers.filter(id => id !== null) as string[];
    
    if (toDelete.length > 0) {
      const result = await prisma.player.deleteMany({
        where: {
          id: {
            in: toDelete,
          },
        },
      });
      
      console.log(`🧹 Cleaned up ${result.count} unused AI player(s)`);
      return result.count;
    }
    
    return 0;
  } catch (error) {
    console.error('Error cleaning up AI players:', error);
    return 0;
  }
}
