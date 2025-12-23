import { Router, Request, Response } from 'express';
import { authenticateToken } from '../auth/middleware';
import {
  createGame,
  listAvailableGames,
  getGameState,
  getGame,
  getUserActiveGames,
  leaveGame,
  createRematchGame,
  getRoundHistory
} from '../services/game.service';
import { addAIToGame } from '../services/ai-player.service';
import { getSocketServer } from '../utils/socketManager';
import { checkAndTriggerAI } from '../ai/trigger';
import type { AddAIPlayerResponse } from '@buck-euchre/shared';

const router = Router();

/**
 * POST /api/games
 * Create a new game
 * Requires authentication
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    console.log(`[POST /api/games] Creating game for userId: ${userId}, isGuest: ${req.user!.isGuest}`);

    // Create game
    const game = await createGame(userId);
    console.log(`[POST /api/games] Game created: ${game.id}, creatorId: ${game.creatorId}, players: ${game.players.map(p => p.userId).join(', ')}`);

    res.status(201).json({
      gameId: game.id,
      createdBy: userId,
      createdAt: game.createdAt.getTime()
    });
  } catch (error: any) {
    console.error('Error creating game:', error);
    // Return the actual error message if it's a known validation error
    if (error.message === 'User is already in an active game') {
      return res.status(400).json({
        error: 'Bad request',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Failed to create game'
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
 * GET /api/games/my
 * Get user's active games
 * Requires authentication
 * This route must come before /:gameId to avoid matching "my" as a game ID
 */
router.get('/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    console.log(`[GET /api/games/my] Querying games for userId: ${userId}, isGuest: ${req.user!.isGuest}`);
    const games = await getUserActiveGames(userId);
    console.log(`[GET /api/games/my] Returning ${games.length} games`);

    res.status(200).json({
      games
    });
  } catch (error) {
    console.error('Error getting user games:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user games'
    });
  }
});

/**
 * DELETE /api/games/:gameId
 * Leave a game
 * Requires authentication
 */
router.delete('/:gameId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    
    console.log(`[DELETE /api/games/:gameId] Leaving game ${gameId} for userId: ${userId}, isGuest: ${req.user!.isGuest}`);

    await leaveGame(gameId, userId);

    res.status(200).json({
      success: true,
      message: 'Left game successfully'
    });
  } catch (error: any) {
    console.error('[DELETE /api/games/:gameId] Error leaving game:', error);
    const statusCode = error.message === 'Game not found' || error.message === 'User is not in this game' ? 404 : 500;
    res.status(statusCode).json({
      error: 'Server error',
      message: error.message || 'Failed to leave game'
    });
  }
});

/**
 * POST /api/games/:gameId/rematch
 * Create a rematch game with the same 4 players
 * Requires authentication
 * Must come before /:gameId route
 */
router.post('/:gameId/rematch', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    
    console.log(`[POST /api/games/:gameId/rematch] Creating rematch for game ${gameId} by userId: ${userId}`);

    const rematchGame = await createRematchGame(gameId, userId);

    res.status(201).json({
      gameId: rematchGame.id,
      createdBy: userId,
      createdAt: rematchGame.createdAt.getTime()
    });
  } catch (error: any) {
    console.error('Error creating rematch:', error);
    const statusCode = error.message === 'Original game not found' || error.message === 'You were not in the original game' 
      ? 404 
      : error.message === 'Original game must have exactly 4 players' || error.message.includes('already in an active game')
      ? 400
      : 500;
    res.status(statusCode).json({
      error: 'Server error',
      message: error.message || 'Failed to create rematch'
    });
  }
});

/**
 * GET /api/games/:gameId/rounds
 * Get round history for a game
 * Requires authentication
 */
router.get('/:gameId/rounds', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    const rounds = await getRoundHistory(gameId);

    res.status(200).json({
      rounds
    });
  } catch (error) {
    console.error('Error getting round history:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get round history'
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
    console.log(`[REST:ADD_AI] ENTRY gameId=${gameId} difficulty=${difficulty || 'medium'} name=${name || 'undefined'}`);
    let gameState = await addAIToGame(gameId, {
        difficulty: difficulty || 'medium',
        name: name || undefined,
      });
    console.log(`[REST:ADD_AI] gameId=${gameId} - addAIToGame returned gameState=${gameState ? `phase=${gameState.phase} version=${gameState.version}` : 'null'}`);

    const updatedGame = await getGame(gameId);
    const playerCount = updatedGame ? updatedGame.players.length : Math.min(4, game.players.length + 1);
    const playersNeeded = Math.max(0, 4 - playerCount);
    const waitingMessage = playersNeeded > 0
      ? `Waiting for ${playersNeeded} more player${playersNeeded === 1 ? '' : 's'}...`
      : 'All seats filled. Starting shortly...';

    // If game started (gameState is not null), broadcast the state
    // joinGame now deals cards directly, so gameState is already in BIDDING phase
    if (gameState) {
      console.log(`[REST:ADD_AI] gameId=${gameId} - game started, getting socket server`);
    const io = getSocketServer();
    
    if (io) {
        console.log(`[REST:ADD_AI] gameId=${gameId} - broadcasting GAME_STATE_UPDATE phase=${gameState.phase} version=${gameState.version}`);
        // Broadcast the game state to all players in the room
        io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
          gameState,
          event: 'GAME_STARTED'
        });
        console.log(`[REST:ADD_AI] gameId=${gameId} - broadcast sent, triggering AI`);
        
        // Trigger AI if needed
        checkAndTriggerAI(gameId, gameState, io).catch((aiError: any) => {
          console.error(`[REST:ADD_AI] Error triggering AI for game ${gameId}:`, aiError);
          // Don't fail the request - game started successfully
        });
      } else {
        console.log(`[REST:ADD_AI] gameId=${gameId} - WARNING: socket server not available!`);
      }
    }

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

/**
 * Update AI difficulty for a specific player
 * PATCH /api/games/:gameId/ai/:playerId/difficulty
 * Requires authentication
 */
router.patch('/:gameId/ai/:playerId/difficulty', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId, playerId } = req.params;
    const { difficulty } = req.body;

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard', 'expert', 'master', 'grandmaster'];
    if (!difficulty || !validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: 'Bad request',
        message: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}`
      });
    }

    // Validate game exists
    const gameState = getActiveGameState(gameId);
    if (!gameState) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Game not found'
      });
    }

    // Validate player exists and is AI
    const player = gameState.players.find((p: any) => p.id === playerId);
    if (!player) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Player not found in game'
      });
    }

    // Check if player is AI (import the check function)
    const { isAIPlayerByName } = await import('../services/ai-player.service');
    if (!isAIPlayerByName(player.name)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Player is not an AI'
      });
    }

    // Update AI difficulty in provider cache
    const { aiProviderCache } = await import('../ai/provider-cache');
    await aiProviderCache.removeProvider(playerId);
    await aiProviderCache.getProvider(playerId, difficulty);

    console.log(`[REST:UPDATE_AI_DIFFICULTY] Updated AI ${player.name} (${playerId}) to ${difficulty} in game ${gameId}`);

    res.status(200).json({
      success: true,
      message: `AI difficulty updated to ${difficulty}`,
      playerId,
      playerName: player.name,
      difficulty
    });
  } catch (error: any) {
    console.error('Error updating AI difficulty:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Failed to update AI difficulty'
    });
  }
});

export default router;
