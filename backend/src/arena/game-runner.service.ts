/**
 * Headless Game Runner for AI Arena
 *
 * Runs games to completion without WebSocket clients.
 * Used for automated AI vs AI battles.
 */

import { GameState } from '@buck-euchre/shared';
import { prisma } from '../db/client';
import { createAIPlayer } from '../services/ai-player.service';
import { createGame } from '../services/game.service';
import { joinGame } from '../services/game.service';
import { initializeGame, dealNewRound, applyBid, applyTrumpDeclaration, applyFoldDecision, applyCardPlay, finishRound, startNextRound } from '../game/state';
import { aiProviderCache } from '../ai/provider-cache';
import type { ArenaConfig } from './types';
import type { AIConfig } from '../ai/types';

/**
 * Result of a headless game
 */
export interface HeadlessGameResult {
  gameId: string;
  participants: Array<{
    configId: string;
    position: number;
    finalScore: number;
    playerId: string;
  }>;
  roundsPlayed: number;
  duration: number; // milliseconds
  error?: string;
}

/**
 * Create a headless game with 4 AI players
 *
 * @param configs - Array of 4 arena configs (in position order)
 * @returns Game ID and player IDs
 */
async function createHeadlessGame(configs: ArenaConfig[]): Promise<{
  gameId: string;
  playerIds: string[];
}> {
  if (configs.length !== 4) {
    throw new Error('Exactly 4 configs required for a game');
  }

  // Create 4 AI players
  const players = await Promise.all(
    configs.map(async (config, index) => {
      const player = await createAIPlayer({
        name: `${config.name} (P${index})`,
        difficulty: config.difficulty as 'easy' | 'medium' | 'hard',
      });
      return player;
    })
  );

  // Create game (first player is creator)
  const gameState = await createGame(players[0].id);

  // Add remaining players
  for (let i = 1; i < 4; i++) {
    await joinGame(gameState.id, players[i].id);
  }

  return {
    gameId: gameState.id,
    playerIds: players.map((p) => p.id),
  };
}

/**
 * Run a single AI turn (no WebSocket)
 *
 * @param gameState - Current game state
 * @param playerId - Player who should act
 * @returns Updated game state
 */
async function runAITurn(gameState: GameState, playerId: string): Promise<GameState> {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player ${playerId} not found in game`);
  }

  const position = player.position;

  // Get AI provider for this player
  const provider = await aiProviderCache.getProvider(playerId, 'medium');

  let updatedState = gameState;

  try {
    switch (gameState.phase) {
      case 'BIDDING': {
        const bid = await provider.decideBid(
          player.hand,
          gameState.turnUpCard!,
          gameState.highestBid,
          gameState
        );
        updatedState = applyBid(gameState, position, bid);
        break;
      }

      case 'DECLARING_TRUMP': {
        const trumpSuit = await provider.decideTrump(
          player.hand,
          gameState.turnUpCard!,
          gameState
        );
        updatedState = applyTrumpDeclaration(gameState, trumpSuit);
        break;
      }

      case 'FOLDING_DECISION': {
        const shouldFold = await provider.decideFold(
          player.hand,
          gameState.trumpSuit!,
          gameState.isClubsTurnUp,
          gameState
        );
        updatedState = applyFoldDecision(gameState, position, shouldFold);
        break;
      }

      case 'PLAYING': {
        const cardToPlay = await provider.decideCardToPlay(gameState, position as any);
        updatedState = applyCardPlay(gameState, position, cardToPlay.id);
        break;
      }

      default:
        // No action needed
        break;
    }
  } catch (error: any) {
    console.error(`[Headless] Error in AI turn:`, error.message);
    throw error;
  }

  return updatedState;
}

/**
 * Get the player who should act next
 *
 * @param gameState - Current game state
 * @returns Player ID or null
 */
function getCurrentActingPlayer(gameState: GameState): string | null {
  switch (gameState.phase) {
    case 'BIDDING':
      if (gameState.currentBidder !== null) {
        return gameState.players[gameState.currentBidder].id;
      }
      break;

    case 'DECLARING_TRUMP':
      if (gameState.winningBidderPosition !== null) {
        return gameState.players[gameState.winningBidderPosition].id;
      }
      break;

    case 'FOLDING_DECISION':
      // Return first undecided player
      for (let i = 0; i < 4; i++) {
        const player = gameState.players[i];
        if (i !== gameState.winningBidderPosition && player.foldDecision === 'UNDECIDED') {
          return player.id;
        }
      }
      break;

    case 'PLAYING':
      if (gameState.currentPlayerPosition !== null) {
        return gameState.players[gameState.currentPlayerPosition].id;
      }
      break;

    default:
      return null;
  }

  return null;
}

/**
 * Run a complete headless game to completion
 *
 * @param configs - Array of 4 arena configs
 * @returns Game result with final scores
 */
export async function runHeadlessGame(configs: ArenaConfig[]): Promise<HeadlessGameResult> {
  const startTime = Date.now();

  try {
    // Create game
    const { gameId, playerIds } = await createHeadlessGame(configs);

    // Load initial game state from database
    let gameState = await loadGameState(gameId);

    console.log(`[Headless] Starting game ${gameId}`);

    // Game loop - run until completed
    let iterations = 0;
    const MAX_ITERATIONS = 10000; // Safety limit

    while (gameState.phase !== 'GAME_OVER' && iterations < MAX_ITERATIONS) {
      iterations++;

      const actingPlayerId = getCurrentActingPlayer(gameState);

      if (!actingPlayerId) {
        // Phase transition might be needed
        if (gameState.phase === 'ROUND_OVER') {
          // Check if game is over
          const maxScore = Math.max(...gameState.players.map((p) => p.score));
          if (maxScore >= 25) {
            // Game over!
            gameState = { ...gameState, phase: 'GAME_OVER' };
            break;
          }

          // Start next round
          gameState = startNextRound(gameState);
          gameState = dealNewRound(gameState);
        } else {
          console.warn(`[Headless] No acting player in phase ${gameState.phase}`);
          break;
        }
        continue;
      }

      // Run AI turn
      gameState = await runAITurn(gameState, actingPlayerId);
    }

    if (iterations >= MAX_ITERATIONS) {
      throw new Error('Game exceeded maximum iterations - possible infinite loop');
    }

    console.log(`[Headless] Game ${gameId} completed in ${iterations} iterations`);

    // Extract final scores
    const participants = configs.map((config, index) => ({
      configId: config.id,
      position: index,
      finalScore: gameState.players[index].score,
      playerId: playerIds[index],
    }));

    const duration = Date.now() - startTime;

    // Clean up game and AI players
    await cleanupHeadlessGame(gameId, playerIds);

    return {
      gameId,
      participants,
      roundsPlayed: gameState.round,
      duration,
    };
  } catch (error: any) {
    console.error(`[Headless] Error running game:`, error.message);

    const duration = Date.now() - startTime;

    return {
      gameId: 'error',
      participants: configs.map((config, index) => ({
        configId: config.id,
        position: index,
        finalScore: 0,
        playerId: 'error',
      })),
      roundsPlayed: 0,
      duration,
      error: error.message,
    };
  }
}

/**
 * Load game state from database
 */
async function loadGameState(gameId: string): Promise<GameState> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      gameState: true,
      players: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!game) {
    throw new Error(`Game ${gameId} not found`);
  }

  if (!game.gameState) {
    throw new Error(`Game state not found for ${gameId}`);
  }

  return game.gameState.state as any;
}

/**
 * Clean up headless game and AI players
 */
async function cleanupHeadlessGame(gameId: string, playerIds: string[]): Promise<void> {
  try {
    // Delete game (cascades to game players)
    await prisma.game.delete({
      where: { id: gameId },
    });

    // Delete AI users
    await prisma.user.deleteMany({
      where: {
        id: {
          in: playerIds,
        },
      },
    });

    console.log(`[Headless] Cleaned up game ${gameId} and ${playerIds.length} AI players`);
  } catch (error: any) {
    console.error(`[Headless] Error cleaning up game:`, error.message);
  }
}
