/**
 * @module ai/analysis.service
 * @description Service for providing AI analysis of player's hand
 *
 * This service uses ISMCTS to analyze the player's current hand and provide
 * statistics like win probability and expected tricks for each card.
 */

import { GameState, PlayerPosition, Card } from '@buck-euchre/shared';
import { ISMCTSEngine } from './ismcts/ismcts-engine';
import { Action, serializeAction } from './ismcts/mcts-node';
import { CardAnalysis } from '@buck-euchre/shared';

/**
 * Configuration for AI analysis
 */
export interface AnalysisConfig {
  /** Number of MCTS simulations to run (more = better quality, slower) */
  simulations?: number;

  /** Whether to enable verbose logging */
  verbose?: boolean;
}

/**
 * Default analysis configuration
 */
const DEFAULT_CONFIG: Required<AnalysisConfig> = {
  simulations: 2000,  // Higher number for more accurate analysis (increased from 500)
  verbose: false,
};

/**
 * Analyze player's hand using ISMCTS
 *
 * @param gameState - Current game state
 * @param playerPosition - Position of player to analyze for
 * @param config - Analysis configuration
 * @returns Array of card analyses with statistics
 */
export async function analyzeHand(
  gameState: GameState,
  playerPosition: PlayerPosition,
  config: AnalysisConfig = {}
): Promise<CardAnalysis[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Only analyze during PLAYING phase
  if (gameState.phase !== 'PLAYING') {
    return [];
  }

  const player = gameState.players[playerPosition];

  // Only analyze if it's the player's turn
  if (gameState.currentPlayerPosition !== playerPosition) {
    return [];
  }

  // Skip if player has folded
  if (player.folded) {
    return [];
  }

  // Skip if player has no cards
  if (!player.hand || player.hand.length === 0) {
    return [];
  }

  try {
    // Create ISMCTS engine
    const engine = new ISMCTSEngine({
      simulations: mergedConfig.simulations,
      verbose: mergedConfig.verbose,
    });

    // Run analysis
    const { bestAction, statistics, totalSimulations } = engine.searchWithAnalysis(
      gameState,
      playerPosition
    );

    // Extract card actions from statistics
    const cardStats = new Map<string, { visits: number; avgValue: number }>();

    for (const [key, stat] of Array.from(statistics)) {
      // Only include CARD actions
      if (stat.action.type === 'CARD') {
        cardStats.set(stat.action.card.id, {
          visits: stat.visits,
          avgValue: stat.avgValue,
        });
      }
    }

    // Convert to CardAnalysis array
    const analyses: CardAnalysis[] = [];

    for (const card of player.hand) {
      const stats = cardStats.get(card.id);

      if (!stats) {
        // Card wasn't explored (shouldn't happen, but handle gracefully)
        analyses.push({
          cardId: card.id,
          winProbability: 0,
          expectedTricks: 0,
          confidence: 0,
          visits: 0,
          rank: player.hand.length,
        });
        continue;
      }

      // Calculate metrics from MCTS values
      // avgValue is normalized score change where:
      //   1.0 = best outcome (-5 score: took all 5 tricks)
      //   0.5 = neutral outcome (0 score change)
      //   0.0 = worst outcome (+5 score: got set/failed)
      // We call this "winProbability" for display, but it's really "expected value"
      const winProbability = stats.avgValue;

      // Confidence increases with more visits
      const confidence = Math.min(stats.visits / 200, 1);

      // Estimate expected score change for this hand
      // Map winProbability [0,1] back to score change [-5, +5]
      const expectedScoreChange = -(winProbability * 10 - 5); // Reverse the normalization

      // Convert score change to estimated tricks
      // Rough heuristic: -1 score ≈ 1 trick (though not always true due to euchre rules)
      const remainingTricks = 5 - gameState.tricks.length;
      const expectedTricks = Math.max(0, Math.min(remainingTricks, -expectedScoreChange));

      analyses.push({
        cardId: card.id,
        winProbability,
        expectedTricks,
        confidence,
        visits: stats.visits,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by win probability (descending) and assign ranks
    analyses.sort((a, b) => b.winProbability - a.winProbability);
    analyses.forEach((analysis, index) => {
      analysis.rank = index + 1;
    });

    return analyses;
  } catch (error) {
    console.error('[AI Analysis] Error analyzing hand:', error);
    return [];
  }
}

/**
 * Get the best card recommendation from analysis
 *
 * @param analyses - Array of card analyses
 * @returns Card ID of the best card, or null if no analysis available
 */
export function getBestCard(analyses: CardAnalysis[]): string | null {
  if (analyses.length === 0) {
    return null;
  }

  // Return the card with rank 1 (best)
  const best = analyses.find(a => a.rank === 1);
  return best ? best.cardId : analyses[0].cardId;
}
