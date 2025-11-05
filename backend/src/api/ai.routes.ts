import { Router, Request, Response } from 'express';
import { authenticateToken } from '../auth/middleware';
import { getActiveGameState } from '../services/state.service';
import { aiProviderCache } from '../ai/provider-cache';
import {
  PlayerPosition,
  AIAnalysisResponse,
  AIActionType
} from '@buck-euchre/shared';
import type { AIDifficulty } from '../ai/types';

const router = Router();

/**
 * POST /api/ai/analyze
 * Get AI analysis for current game state
 *
 * Request body:
 * {
 *   gameId: string;
 *   difficulty?: 'easy' | 'medium' | 'hard' | 'expert';  // Optional, defaults to 'hard'
 * }
 *
 * Response:
 * {
 *   recommendation: { type, value, confidence },
 *   actions: [{ type, value, percentage, score, rank }, ...],
 *   reasoning: string[],
 *   metadata: { provider, difficulty, analysisTime, ... }
 * }
 */
router.post('/analyze', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { gameId, difficulty = 'hard' } = req.body;

    if (!gameId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'gameId is required'
      });
    }

    // Get game state
    const gameState = getActiveGameState(gameId);
    if (!gameState) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Game not found'
      });
    }

    // Find player's position in game
    const playerIndex = gameState.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not in this game'
      });
    }

    const playerPosition = playerIndex as PlayerPosition;

    // Check if it's the player's turn
    const isPlayerTurn = (
      (gameState.phase === 'BIDDING' && gameState.currentBidder === playerPosition) ||
      (gameState.phase === 'DECLARING_TRUMP' && gameState.winningBidderPosition === playerPosition) ||
      (gameState.phase === 'FOLDING_DECISION' && gameState.players[playerPosition].foldDecision === 'UNDECIDED') ||
      (gameState.phase === 'PLAYING' && gameState.currentPlayerPosition === playerPosition)
    );

    if (!isPlayerTurn) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Not your turn'
      });
    }

    // Get AI provider for analysis
    // Use hard difficulty by default for quality analysis, or user-specified
    const startTime = Date.now();
    const aiProvider = await aiProviderCache.getProvider(
      `analysis_${userId}`,
      difficulty as AIDifficulty
    );

    // Check if provider supports analysis
    if (!aiProvider.analyze) {
      return res.status(501).json({
        error: 'Not implemented',
        message: 'Current AI provider does not support analysis'
      });
    }

    // Run analysis
    const analysis = await aiProvider.analyze(gameState, playerPosition);
    const analysisTime = Date.now() - startTime;

    // Format response
    const response: AIAnalysisResponse = formatAnalysisResponse(
      analysis,
      aiProvider.name,
      difficulty as string,
      analysisTime
    );

    res.json(response);

  } catch (error: any) {
    console.error('Error analyzing game state:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Failed to analyze game state'
    });
  }
});

/**
 * Format AI analysis into standardized response
 */
function formatAnalysisResponse(
  analysis: any,
  providerName: string,
  difficulty: string,
  analysisTime: number
): AIAnalysisResponse {
  // Extract recommendation
  const recommendation = {
    type: getActionType(analysis.recommendation),
    value: analysis.recommendation,
    confidence: analysis.confidence || 0,
  };

  // Format alternatives into actions array
  const actions: AIAnalysisResponse['actions'] = [];

  // Add main recommendation as first action
  actions.push({
    type: recommendation.type,
    value: recommendation.value,
    percentage: analysis.confidence || 0,
    score: 1.0,
    rank: 1,
  });

  // Add alternatives
  if (analysis.alternatives) {
    for (let i = 0; i < analysis.alternatives.length; i++) {
      const alt = analysis.alternatives[i];
      actions.push({
        type: getActionType(alt.action),
        value: alt.action,
        percentage: alt.probability || 0,
        score: alt.score || 0,
        rank: i + 2,
      });
    }
  }

  return {
    recommendation,
    actions,
    reasoning: analysis.reasoning || [],
    metadata: {
      provider: providerName,
      difficulty,
      analysisTime,
      ...analysis.metadata,
    },
  };
}

/**
 * Determine action type from value
 */
function getActionType(value: any): 'BID' | 'TRUMP' | 'FOLD' | 'CARD' {
  if (typeof value === 'boolean') return 'FOLD';
  if (typeof value === 'string') {
    if (['PASS', 2, 3, 4, 5].includes(value) || value === 'PASS') return 'BID';
    if (['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'].includes(value)) return 'TRUMP';
  }
  if (typeof value === 'number' && value >= 2 && value <= 5) return 'BID';
  if (value && typeof value === 'object' && 'suit' in value && 'rank' in value) return 'CARD';

  return 'CARD'; // Default fallback
}

export default router;
