/**
 * @module ai/providers/rule-based
 * @description Rule-based AI provider
 *
 * A simple but functional AI using hand-coded heuristics.
 * Good baseline for testing and easy difficulty.
 */

import { Card, Suit, BidAmount, GameState, PlayerPosition } from '@buck-euchre/shared';
import { AIProvider, AIConfig, AIDifficulty, AIAnalysis } from '../types.js';
import {
  decideBid as originalDecideBid,
  decideTrump as originalDecideTrump,
  decideFold as originalDecideFold,
  decideCardToPlay as originalDecideCardToPlay,
} from '../decision-engine.js';

/**
 * Rule-based AI provider
 *
 * Uses simple heuristics:
 * - Bidding: Count trump cards
 * - Trump: Choose suit with most cards
 * - Folding: Fold if weak trump holding
 * - Card play: Lead high, follow low
 */
export class RuleBasedAIProvider implements AIProvider {
  readonly name = 'Rule-Based AI';
  readonly version = '1.0.0';
  readonly description = 'Simple heuristic-based AI using card counting and basic strategy';

  private config: AIConfig | null = null;

  initialize(config: AIConfig): void {
    this.config = config;
    console.log(`[Rule-Based AI] Initialized with difficulty: ${config.difficulty}`);
  }

  decideBid(
    hand: Card[],
    turnUpCard: Card,
    currentBid: number | null,
    gameState: GameState
  ): BidAmount {
    // Use original decision logic
    return originalDecideBid(hand, turnUpCard, currentBid);
  }

  decideTrump(hand: Card[], turnUpCard: Card, gameState: GameState): Suit {
    // Use original decision logic
    return originalDecideTrump(hand, turnUpCard);
  }

  decideFold(
    hand: Card[],
    trumpSuit: Suit,
    isClubs: boolean,
    gameState: GameState
  ): boolean {
    // Use original decision logic
    return originalDecideFold(hand, trumpSuit, isClubs);
  }

  decideCardToPlay(gameState: GameState, aiPosition: PlayerPosition): Card {
    // Use original decision logic
    return originalDecideCardToPlay(gameState, aiPosition);
  }

  analyze(gameState: GameState, aiPosition: PlayerPosition): AIAnalysis {
    // For rule-based AI, just return the decision with low confidence
    const card = this.decideCardToPlay(gameState, aiPosition);

    return {
      recommendation: card,
      confidence: 0.6, // Rule-based has moderate confidence
      reasoning: [
        'Rule-based heuristic decision',
        'Based on card counting and simple strategy',
      ],
      metadata: {
        provider: 'rule-based',
        version: this.version,
      },
    };
  }
}

/**
 * Factory function to create rule-based AI instances
 */
export function createRuleBasedAI(config: AIConfig): RuleBasedAIProvider {
  const provider = new RuleBasedAIProvider();
  provider.initialize(config);
  return provider;
}

/**
 * Metadata for registration
 */
export const RuleBasedAIMetadata = {
  id: 'rule-based',
  name: 'Rule-Based AI',
  version: '1.0.0',
  description: 'Simple heuristic-based AI using card counting and basic strategy',
  factory: createRuleBasedAI,
  supportedDifficulties: ['easy'] as AIDifficulty[],  // Only easy - medium+ uses ISMCTS
  isAsync: false,
  tags: ['baseline', 'fast', 'deterministic'],
};
