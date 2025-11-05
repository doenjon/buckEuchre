/**
 * @module ai/types
 * @description Type definitions for AI plugin system
 */

import { Card, Suit, BidAmount, GameState, PlayerPosition } from '@buck-euchre/shared';

/**
 * AI difficulty levels
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Configuration for an AI provider
 */
export interface AIConfig {
  /** Difficulty level (affects simulation count, strategy depth, etc.) */
  difficulty: AIDifficulty;

  /** Optional custom parameters specific to the AI implementation */
  params?: Record<string, any>;

  /** Random seed for reproducibility (optional) */
  seed?: number;
}

/**
 * Analysis result from AI decision
 * Useful for teaching features and debugging
 */
export interface AIAnalysis {
  /** Recommended action */
  recommendation: Card | BidAmount | Suit | boolean;

  /** Confidence level (0-1) */
  confidence: number;

  /** Alternative options with their scores */
  alternatives?: Array<{
    action: Card | BidAmount | Suit | boolean;
    score: number;
    probability?: number;
  }>;

  /** Human-readable reasoning */
  reasoning?: string[];

  /** Additional metadata (visit counts, win rates, etc.) */
  metadata?: Record<string, any>;
}

/**
 * Base interface that all AI providers must implement
 *
 * This allows different AI implementations (rule-based, MCTS, neural networks, etc.)
 * to be plugged in without changing the executor infrastructure.
 */
export interface AIProvider {
  /** Unique identifier for this AI provider */
  readonly name: string;

  /** Version of this AI provider */
  readonly version: string;

  /** Description of the AI strategy */
  readonly description: string;

  /**
   * Initialize the AI provider with configuration
   * Called once when the provider is created
   */
  initialize(config: AIConfig): Promise<void> | void;

  /**
   * Decide what bid to place
   *
   * @param hand - AI player's hand
   * @param turnUpCard - The turn-up card from the blind
   * @param currentBid - Current highest bid (null if none)
   * @param gameState - Full game state for context
   * @returns Bid amount
   */
  decideBid(
    hand: Card[],
    turnUpCard: Card,
    currentBid: number | null,
    gameState: GameState
  ): Promise<BidAmount> | BidAmount;

  /**
   * Decide which suit to declare as trump
   *
   * @param hand - AI player's hand
   * @param turnUpCard - The turn-up card (for reference)
   * @param gameState - Full game state for context
   * @returns Trump suit to declare
   */
  decideTrump(
    hand: Card[],
    turnUpCard: Card,
    gameState: GameState
  ): Promise<Suit> | Suit;

  /**
   * Decide whether to fold or stay
   *
   * @param hand - AI player's hand
   * @param trumpSuit - The declared trump suit
   * @param isClubs - Whether the turn-up was Clubs (cannot fold)
   * @param gameState - Full game state for context
   * @returns True to fold, false to stay
   */
  decideFold(
    hand: Card[],
    trumpSuit: Suit,
    isClubs: boolean,
    gameState: GameState
  ): Promise<boolean> | boolean;

  /**
   * Decide which card to play
   *
   * @param gameState - Current game state
   * @param aiPosition - AI player's position
   * @returns Card to play
   */
  decideCardToPlay(
    gameState: GameState,
    aiPosition: PlayerPosition
  ): Promise<Card> | Card;

  /**
   * Optional: Provide detailed analysis of a decision
   * Useful for teaching features, debugging, and testing
   *
   * @param gameState - Current game state
   * @param aiPosition - AI player's position
   * @returns Analysis of the decision
   */
  analyze?(
    gameState: GameState,
    aiPosition: PlayerPosition
  ): Promise<AIAnalysis> | AIAnalysis;

  /**
   * Optional: Cleanup resources when AI is no longer needed
   */
  cleanup?(): Promise<void> | void;
}

/**
 * Factory function type for creating AI providers
 */
export type AIProviderFactory = (config: AIConfig) => AIProvider | Promise<AIProvider>;

/**
 * Metadata about a registered AI provider
 */
export interface AIProviderMetadata {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Version string */
  version: string;

  /** Description */
  description: string;

  /** Factory function to create instances */
  factory: AIProviderFactory;

  /** Supported difficulty levels */
  supportedDifficulties: AIDifficulty[];

  /** Whether this AI requires async operations */
  isAsync: boolean;

  /** Tags for categorization */
  tags?: string[];
}
