/**
 * @module types/ai
 * @description Type definitions for AI analysis API
 */

import { Card, BidAmount, Suit } from './game';

/**
 * AI action types
 */
export type AIActionType = 'BID' | 'TRUMP' | 'FOLD' | 'CARD';

/**
 * AI action value (polymorphic based on type)
 */
export type AIActionValue = BidAmount | Suit | boolean | Card;

/**
 * Recommendation from AI analysis
 */
export interface AIRecommendation {
  /** Type of action */
  type: AIActionType;

  /** The recommended action value */
  value: AIActionValue;

  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Statistics for a single action
 */
export interface AIActionStatistics {
  /** Type of action */
  type: AIActionType;

  /** The action value */
  value: AIActionValue;

  /** Percentage of simulations that chose this action (0-1) */
  percentage: number;

  /** Average score/value from simulations (0-1, higher is better) */
  score: number;

  /** Ranking (1 = best, 2 = second best, etc.) */
  rank: number;
}

/**
 * Complete AI analysis response
 */
export interface AIAnalysisResponse {
  /** Overall recommendation */
  recommendation: AIRecommendation;

  /** Statistics for all possible actions */
  actions: AIActionStatistics[];

  /** Human-readable reasoning */
  reasoning: string[];

  /** Metadata about the analysis */
  metadata: {
    /** AI provider name (e.g., "ISMCTS AI", "Rule-Based AI") */
    provider: string;

    /** Difficulty level used */
    difficulty: string;

    /** Time taken for analysis in milliseconds */
    analysisTime: number;

    /** Additional provider-specific metadata */
    [key: string]: any;
  };
}

/**
 * Request body for AI analysis
 */
export interface AIAnalysisRequest {
  /** Game ID to analyze */
  gameId: string;

  /** Difficulty level for analysis (optional, defaults to 'hard') */
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
}

/**
 * Type guard to check if action is a Card
 */
export function isCard(value: AIActionValue): value is Card {
  return (
    typeof value === 'object' &&
    value !== null &&
    'suit' in value &&
    'rank' in value &&
    'id' in value
  );
}

/**
 * Type guard to check if action is a BidAmount
 */
export function isBidAmount(value: AIActionValue): value is BidAmount {
  return value === 'PASS' || (typeof value === 'number' && value >= 2 && value <= 5);
}

/**
 * Type guard to check if action is a Suit
 */
export function isSuit(value: AIActionValue): value is Suit {
  return (
    typeof value === 'string' &&
    ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'].includes(value)
  );
}

/**
 * Type guard to check if action is a boolean (fold decision)
 */
export function isBoolean(value: AIActionValue): value is boolean {
  return typeof value === 'boolean';
}
