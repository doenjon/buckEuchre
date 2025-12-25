import { Router, Request, Response } from 'express';
import { getLeaderboard, getFriendsLeaderboard } from '../services/stats.service';
import { authenticateToken, optionalAuth } from '../auth/middleware';

const router = Router();

/**
 * GET /api/leaderboard/global
 * Get global leaderboard
 * 
 * Query params:
 *   - metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate'
 *   - limit: number (default: 50, max: 100)
 */
router.get('/global', optionalAuth, async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as string) || 'gamesWon';
    const limit = Math.min(
      parseInt(req.query.limit as string) || 50,
      100
    );

    // Validate metric
    const validMetrics = ['gamesWon', 'winRate', 'totalPoints', 'bidSuccessRate', 'totalRounds', 'foldRate', 'bucks', 'tricksWon', 'avgPointsPerGame', 'avgPointsPerRound'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid metric. Must be one of: gamesWon, winRate, totalPoints, bidSuccessRate, totalRounds, foldRate, bucks, tricksWon, avgPointsPerGame, avgPointsPerRound',
      });
    }

    const leaderboard = await getLeaderboard(
      metric as 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' | 'totalRounds' | 'foldRate' | 'bucks' | 'tricksWon' | 'avgPointsPerGame' | 'avgPointsPerRound',
      limit
    );

    res.status(200).json({
      leaderboard,
      metric,
      limit,
    });
  } catch (error) {
    console.error('Error getting global leaderboard:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get leaderboard',
    });
  }
});

/**
 * GET /api/leaderboard/friends
 * Get friends leaderboard (requires authentication)
 * 
 * Query params:
 *   - metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate'
 */
router.get('/friends', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const metric = (req.query.metric as string) || 'gamesWon';

    // Validate metric
    const validMetrics = ['gamesWon', 'winRate', 'totalPoints', 'bidSuccessRate', 'totalRounds', 'foldRate', 'bucks', 'tricksWon', 'avgPointsPerGame', 'avgPointsPerRound'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid metric. Must be one of: gamesWon, winRate, totalPoints, bidSuccessRate, totalRounds, foldRate, bucks, tricksWon, avgPointsPerGame, avgPointsPerRound',
      });
    }

    const leaderboard = await getFriendsLeaderboard(
      userId,
      metric as 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' | 'totalRounds' | 'foldRate' | 'bucks' | 'tricksWon' | 'avgPointsPerGame' | 'avgPointsPerRound'
    );

    res.status(200).json({
      leaderboard,
      metric,
    });
  } catch (error) {
    console.error('Error getting friends leaderboard:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get friends leaderboard',
    });
  }
});

export default router;



