import { Router, Request, Response } from 'express';
import { authenticateToken } from '../auth/middleware';
import { 
  createGame, 
  listAvailableGames,
  getGameState,
  getGame
} from '../services/game.service';
import { addAIToGame } from '../services/ai-player.service';
import { getSocketServer } from '../utils/socketManager';
import type { AddAIPlayerResponse } from '@buck-euchre/shared';

const router = Router();

/**
 * POST /api/games
 * Create a new game
 * Requires authentication
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Create game
    const game = await createGame(playerId);

    res.status(201).json({
      gameId: game.id,
      createdBy: playerId,
      createdAt: game.createdAt.getTime()
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to create game'
    });
  }
});

/**
 * GET /api/games
 * List all available games
 * Requires authentication
 */
router.get('/', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const games = await listAvailableGames();

    res.status(200).json({
      games
    });
  } catch (error) {
    console.error('Error listing games:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to list games'
    });
  }
});

/**
 * GET /api/games/:gameId
 * Get current game state or game info
 * Requires authentication
 */
router.get('/:gameId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Try to get full game state first (if game has started)
    const gameState = await getGameState(gameId);

    if (gameState) {
      return res.status(200).json(gameState);
    }

    // If no game state, get basic game info (game hasn't started yet)
    const game = await getGame(gameId);

    if (!game) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Game not found'
      });
    }

    res.status(200).json(game);
  } catch (error) {
    console.error('Error getting game:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get game'
    });
  }
});

/**
 * POST /api/games/:gameId/ai
 * Add an AI player to a game
 * Requires authentication
 */
router.post('/:gameId/ai', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { difficulty, name } = req.body;

    // Validate game exists
    const game = await getGame(gameId);
    if (!game) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Game not found'
      });
    }

    // Check if game is full
    if (game.players.length >= 4) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Game is full'
      });
    }

    // Add AI to game
    const gameState = await addAIToGame(gameId, {
      difficulty: difficulty || 'medium',
      name: name || undefined,
    });

    const updatedGame = await getGame(gameId);
    const playerCount = updatedGame ? updatedGame.players.length : Math.min(4, game.players.length + 1);
    const playersNeeded = Math.max(0, 4 - playerCount);
    const waitingMessage = playersNeeded > 0
      ? `Waiting for ${playersNeeded} more player${playersNeeded === 1 ? '' : 's'}...`
      : 'All seats filled. Starting shortly...';

    if (!gameState) {
      const io = getSocketServer();
      if (io) {
        io.to(`game:${gameId}`).emit('GAME_WAITING', {
          gameId,
          playerCount,
          playersNeeded,
          message: waitingMessage,
        });
      }
    }

    const response: AddAIPlayerResponse = {
      success: true,
      message: 'AI player added',
      gameStarted: gameState !== null,
      gameState: gameState || undefined,
      playerCount,
      playersNeeded,
      waitingMessage,
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error adding AI player:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Failed to add AI player'
    });
  }
});

export default router;
