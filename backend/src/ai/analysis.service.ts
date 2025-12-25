/**
 * @module ai/analysis.service
 * @description Service for providing AI analysis of player's hand
 *
 * This service uses ISMCTS to analyze the player's current hand and provide
 * statistics like win probability and expected tricks for each card.
 */

import { GameState, PlayerPosition, Card, BidAmount, Suit } from '@buck-euchre/shared';
import { ISMCTSEngine } from './ismcts/ismcts-engine';
import { Action, serializeAction } from './ismcts/mcts-node';
import { CardAnalysis, BidAnalysis, FoldAnalysis, SuitAnalysis } from '@buck-euchre/shared';

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
  simulations: 5000,  // Balanced number for good analysis performance
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
          expectedScore: 5, // Worst case
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
        expectedScore: expectedScoreChange,
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

/**
 * Analyze bidding options using ISMCTS
 *
 * @param gameState - Current game state
 * @param playerPosition - Position of player to analyze for
 * @param config - Analysis configuration
 * @returns Array of bid analyses with statistics
 */
export async function analyzeBids(
  gameState: GameState,
  playerPosition: PlayerPosition,
  config: AnalysisConfig = {}
): Promise<BidAnalysis[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Only analyze during BIDDING phase
  if (gameState.phase !== 'BIDDING') {
    return [];
  }

  const player = gameState.players[playerPosition];

  // Only analyze if it's the player's turn
  if (gameState.currentPlayerPosition !== playerPosition) {
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

    // Extract bid actions from statistics
    const bidStats = new Map<BidAmount, { visits: number; avgValue: number }>();

    for (const [key, stat] of Array.from(statistics)) {
      // Only include BID actions
      if (stat.action.type === 'BID') {
        bidStats.set(stat.action.amount, {
          visits: stat.visits,
          avgValue: stat.avgValue,
        });
      }
    }

    // Convert to BidAnalysis array
    const analyses: BidAnalysis[] = [];
    const possibleBids: BidAmount[] = ['PASS', 3, 4, 5];

    for (const bidAmount of possibleBids) {
      const stats = bidStats.get(bidAmount);

      if (!stats) {
        // Bid wasn't explored (might be invalid or rarely chosen)
        analyses.push({
          bidAmount,
          winProbability: 0,
          expectedScore: 0,
          confidence: 0,
          visits: 0,
          rank: possibleBids.length,
        });
        continue;
      }

      // Calculate metrics from MCTS values
      const winProbability = stats.avgValue;
      const confidence = Math.min(stats.visits / 200, 1);
      const expectedScore = -(winProbability * 10 - 5);

      analyses.push({
        bidAmount,
        winProbability,
        expectedScore,
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
    console.error('[AI Analysis] Error analyzing bids:', error);
    return [];
  }
}

/**
 * Get the best bid recommendation from analysis
 *
 * @param analyses - Array of bid analyses
 * @returns Best bid amount, or null if no analysis available
 */
export function getBestBid(analyses: BidAnalysis[]): BidAmount | null {
  if (analyses.length === 0) {
    return null;
  }

  // Return the bid with rank 1 (best)
  const best = analyses.find(a => a.rank === 1);
  return best ? best.bidAmount : analyses[0].bidAmount;
}

/**
 * Analyze fold decision using ISMCTS
 *
 * @param gameState - Current game state
 * @param playerPosition - Position of player to analyze for
 * @param config - Analysis configuration
 * @returns Array of fold analyses (fold vs stay)
 */
export async function analyzeFoldDecision(
  gameState: GameState,
  playerPosition: PlayerPosition,
  config: AnalysisConfig = {}
): Promise<FoldAnalysis[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Only analyze during FOLDING_DECISION phase
  if (gameState.phase !== 'FOLDING_DECISION') {
    return [];
  }

  const player = gameState.players[playerPosition];

  // Only analyze if it's the player's turn
  if (gameState.currentPlayerPosition !== playerPosition) {
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

    // Extract fold actions from statistics
    const foldStats = new Map<boolean, { visits: number; avgValue: number }>();

    for (const [key, stat] of Array.from(statistics)) {
      // Only include FOLD actions
      if (stat.action.type === 'FOLD') {
        foldStats.set(stat.action.fold, {
          visits: stat.visits,
          avgValue: stat.avgValue,
        });
      }
    }

    // Convert to FoldAnalysis array
    const analyses: FoldAnalysis[] = [];
    const foldOptions = [false, true]; // Stay, then Fold

    for (const foldOption of foldOptions) {
      const stats = foldStats.get(foldOption);

      if (!stats) {
        // Option wasn't explored
        analyses.push({
          fold: foldOption,
          winProbability: 0,
          expectedScore: 0,
          confidence: 0,
          visits: 0,
          isBest: false,
        });
        continue;
      }

      // Calculate metrics from MCTS values
      const winProbability = stats.avgValue;
      const confidence = Math.min(stats.visits / 200, 1);
      const expectedScore = -(winProbability * 10 - 5);

      analyses.push({
        fold: foldOption,
        winProbability,
        expectedScore,
        confidence,
        visits: stats.visits,
        isBest: false, // Will be set after finding the best
      });
    }

    // Find the best option
    if (analyses.length > 0) {
      const best = analyses.reduce((prev, curr) =>
        curr.winProbability > prev.winProbability ? curr : prev
      );
      best.isBest = true;
    }

    return analyses;
  } catch (error) {
    console.error('[AI Analysis] Error analyzing fold decision:', error);
    return [];
  }
}

/**
 * Get the best fold recommendation from analysis
 *
 * @param analyses - Array of fold analyses
 * @returns Best fold decision (true to fold, false to stay), or null if no analysis available
 */
export function getBestFoldDecision(analyses: FoldAnalysis[]): boolean | null {
  if (analyses.length === 0) {
    return null;
  }

  // Return the decision with isBest = true
  const best = analyses.find(a => a.isBest);
  return best !== undefined ? best.fold : null;
}

/**
 * Analyze trump suit selection using ISMCTS
 *
 * @param gameState - Current game state
 * @param playerPosition - Position of player to analyze for
 * @param config - Analysis configuration
 * @returns Array of suit analyses with statistics
 */
export async function analyzeTrumpSelection(
  gameState: GameState,
  playerPosition: PlayerPosition,
  config: AnalysisConfig = {}
): Promise<SuitAnalysis[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Only analyze during DECLARING_TRUMP phase
  if (gameState.phase !== 'DECLARING_TRUMP') {
    return [];
  }

  // Only analyze if it's the player's turn (they are the winning bidder)
  if (gameState.winningBidderPosition !== playerPosition) {
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

    // Extract trump declaration actions from statistics
    const suitStats = new Map<Suit, { visits: number; avgValue: number }>();

    for (const [key, stat] of Array.from(statistics)) {
      // Only include DECLARE_TRUMP actions
      if (stat.action.type === 'DECLARE_TRUMP') {
        suitStats.set(stat.action.suit, {
          visits: stat.visits,
          avgValue: stat.avgValue,
        });
      }
    }

    // Convert to SuitAnalysis array
    const analyses: SuitAnalysis[] = [];
    const possibleSuits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];

    for (const suit of possibleSuits) {
      const stats = suitStats.get(suit);

      if (!stats) {
        // Suit wasn't explored (shouldn't happen, but handle gracefully)
        analyses.push({
          suit,
          winProbability: 0,
          expectedScore: 5, // Worst case
          confidence: 0,
          visits: 0,
          rank: possibleSuits.length,
        });
        continue;
      }

      // Calculate metrics from MCTS values
      const winProbability = stats.avgValue;
      const confidence = Math.min(stats.visits / 200, 1);
      const expectedScore = -(winProbability * 10 - 5);

      analyses.push({
        suit,
        winProbability,
        expectedScore,
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
    console.error('[AI Analysis] Error analyzing trump selection:', error);
    return [];
  }
}

/**
 * Get the best suit recommendation from analysis
 *
 * @param analyses - Array of suit analyses
 * @returns Best suit, or null if no analysis available
 */
export function getBestSuit(analyses: SuitAnalysis[]): Suit | null {
  if (analyses.length === 0) {
    return null;
  }

  // Return the suit with rank 1 (best)
  const best = analyses.find(a => a.rank === 1);
  return best ? best.suit : analyses[0].suit;
}
