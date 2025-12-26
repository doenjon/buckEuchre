/**
 * Arena API Routes
 *
 * Endpoints for AI Arena:
 * - GET /api/arena/configs - List all AI configs
 * - GET /api/arena/stats - Get statistics for all configs
 * - GET /api/arena/matches - Get recent matches
 * - POST /api/arena/run - Run matches
 */

import express from 'express';
import { getAllConfigs, getArenaStats, getRecentMatches, runMatches } from '../arena/arena.service.js';
import { authenticateToken } from '../auth/middleware.js';

const router = express.Router();

/**
 * GET /api/arena/configs
 * Get all AI configurations with ELO ratings
 */
router.get('/configs', authenticateToken, async (req, res) => {
  try {
    const configs = await getAllConfigs();
    res.json(configs);
  } catch (error: any) {
    console.error('[Arena API] Error getting configs:', error);
    res.status(500).json({ error: 'Failed to get configs' });
  }
});

/**
 * GET /api/arena/stats
 * Get statistics for all configs (ELO, win rate, avg score, etc.)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await getArenaStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[Arena API] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/arena/matches
 * Get recent matches
 *
 * Query params:
 * - limit: Number of matches to return (default: 20)
 */
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const matches = await getRecentMatches(limit);
    res.json(matches);
  } catch (error: any) {
    console.error('[Arena API] Error getting matches:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

/**
 * POST /api/arena/run
 * Run arena matches
 *
 * Body:
 * - mode: 'manual' | 'elo'
 * - numGames: number
 * - configIds: string[] (required for manual mode, exactly 4 IDs)
 */
router.post('/run', authenticateToken, async (req, res) => {
  try {
    const { mode, numGames, configIds } = req.body;

    if (!mode || !numGames) {
      return res.status(400).json({ error: 'mode and numGames are required' });
    }

    if (mode !== 'manual' && mode !== 'elo') {
      return res.status(400).json({ error: 'mode must be "manual" or "elo"' });
    }

    if (numGames < 1 || numGames > 100) {
      return res.status(400).json({ error: 'numGames must be between 1 and 100' });
    }

    if (mode === 'manual') {
      if (!configIds || !Array.isArray(configIds) || configIds.length !== 4) {
        return res.status(400).json({ error: 'manual mode requires exactly 4 config IDs' });
      }
    }

    // Run matches (this could take a while)
    console.log(`[Arena API] Starting ${numGames} matches in ${mode} mode`);

    const matches = await runMatches({
      mode,
      numGames,
      configIds,
    });

    res.json({
      success: true,
      matchesRun: matches.length,
      matches,
    });
  } catch (error: any) {
    console.error('[Arena API] Error running matches:', error);
    res.status(500).json({ error: error.message || 'Failed to run matches' });
  }
});

export default router;
