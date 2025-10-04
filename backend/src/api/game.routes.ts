import { Router, Request, Response } from 'express';
import { authenticateToken } from '../auth/middleware';
import { 
  createGame, 
  listAvailableGames,
  getGameState
} from '../services/game.service';

const router = Router();

/**
 * POST /api/games
 * Create a new game
 * Requires authentication
 */
router.post('/games', authenticateToken, async (req: Request, res: Response) => {
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
router.get('/games', authenticateToken, async (_req: Request, res: Response) => {
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
 * Get current game state
 * Requires authentication
 */
router.get('/games/:gameId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    const gameState = await getGameState(gameId);

    if (!gameState) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Game not found'
      });
    }

    res.status(200).json({
      gameState
    });
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get game state'
    });
  }
});

export default router;
