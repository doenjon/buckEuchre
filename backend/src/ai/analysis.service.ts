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
  simulations: 500,  // Moderate number for real-time analysis
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

      // Calculate metrics
      const winProbability = stats.avgValue; // avgValue is already 0-1
      const confidence = Math.min(stats.visits / 100, 1); // Confidence based on visit count

      // Estimate expected tricks based on win probability
      // This is a rough heuristic: higher win prob = more tricks
      const remainingTricks = 5 - gameState.tricks.length;
      const expectedTricks = winProbability * remainingTricks;

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
