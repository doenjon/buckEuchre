/**
 * @module ai/providers/ismcts
 * @description ISMCTS AI provider
 *
 * Uses Information Set Monte Carlo Tree Search for strong play.
 * Handles imperfect information through determinization and tree search.
 */

import { Card, Suit, BidAmount, GameState, PlayerPosition } from '@buck-euchre/shared';
import { AIProvider, AIConfig, AIDifficulty, AIAnalysis } from '../types';
import { ISMCTSEngine, ISMCTSConfig } from '../ismcts/ismcts-engine';
import { Action } from '../ismcts/mcts-node';

/**
 * Map difficulty to simulation count
 */
function getSimulationCount(difficulty: AIDifficulty): number {
  switch (difficulty) {
    case 'easy':
      return 100; // ~20ms
    case 'medium':
      return 500; // ~75ms
    case 'hard':
      return 2000; // ~250ms
    case 'expert':
      return 5000; // ~600ms
    default:
      return 500;
  }
}

/**
 * ISMCTS AI Provider
 *
 * Uses tree search with determinization to handle imperfect information.
 * Significantly stronger than rule-based AI.
 */
export class ISMCTSAIProvider implements AIProvider {
  readonly name = 'ISMCTS AI';
  readonly version = '1.0.0';
  readonly description =
    'Information Set Monte Carlo Tree Search - uses determinization and tree search for strong play';

  private engine: ISMCTSEngine | null = null;
  private simulations: number = 500;
  private config: AIConfig | null = null;

  initialize(config: AIConfig): void {
    this.config = config;
    this.simulations = getSimulationCount(config.difficulty);

    const ismctsConfig: ISMCTSConfig = {
      simulations: this.simulations,
      verbose: config.params?.verbose || false,
    };

    this.engine = new ISMCTSEngine(ismctsConfig);

    console.log(
      `[ISMCTS AI] Initialized with difficulty: ${config.difficulty} (${this.simulations} simulations)`
    );
  }

  decideBid(
    hand: Card[],
    turnUpCard: Card,
    currentBid: number | null,
    gameState: GameState
  ): BidAmount {
    if (!this.engine) {
      throw new Error('[ISMCTS AI] Engine not initialized');
    }

    // Find our player position
    const myPosition = gameState.currentBidder;
    if (myPosition === null) {
      throw new Error('[ISMCTS AI] No current bidder');
    }

    const action = this.engine.search(gameState, myPosition);

    if (action.type !== 'BID') {
      console.warn(`[ISMCTS AI] Expected BID action, got ${action.type}`);
      return 'PASS';
    }

    return action.amount;
  }

  decideTrump(hand: Card[], turnUpCard: Card, gameState: GameState): Suit {
    if (!this.engine) {
      throw new Error('[ISMCTS AI] Engine not initialized');
    }

    // Find our player position (should be winning bidder)
    const myPosition = gameState.winningBidderPosition;
    if (myPosition === null) {
      throw new Error('[ISMCTS AI] No winning bidder');
    }

    const action = this.engine.search(gameState, myPosition);

    if (action.type !== 'TRUMP') {
      console.warn(`[ISMCTS AI] Expected TRUMP action, got ${action.type}`);
      // Fallback: choose suit with most cards
      const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
      let bestSuit = suits[0];
      let bestCount = 0;
      for (const suit of suits) {
        const count = hand.filter(c => c.suit === suit).length;
        if (count > bestCount) {
          bestCount = count;
          bestSuit = suit;
        }
      }
      return bestSuit;
    }

    return action.suit;
  }

  decideFold(
    hand: Card[],
    trumpSuit: Suit,
    isClubs: boolean,
    gameState: GameState
  ): boolean {
    if (!this.engine) {
      throw new Error('[ISMCTS AI] Engine not initialized');
    }

    // Find our player position (first undecided non-bidder)
    let myPosition: PlayerPosition | null = null;
    for (let i = 0; i < 4; i++) {
      const player = gameState.players[i];
      if (i !== gameState.winningBidderPosition && player.foldDecision === 'UNDECIDED') {
        myPosition = i as PlayerPosition;
        break;
      }
    }

    if (myPosition === null) {
      throw new Error('[ISMCTS AI] No undecided player found');
    }

    const action = this.engine.search(gameState, myPosition);

    if (action.type !== 'FOLD') {
      console.warn(`[ISMCTS AI] Expected FOLD action, got ${action.type}`);
      return false;
    }

    return action.fold;
  }

  decideCardToPlay(gameState: GameState, aiPosition: PlayerPosition): Card {
    if (!this.engine) {
      throw new Error('[ISMCTS AI] Engine not initialized');
    }

    const action = this.engine.search(gameState, aiPosition);

    if (action.type !== 'CARD') {
      console.warn(`[ISMCTS AI] Expected CARD action, got ${action.type}`);
      // Fallback: play first legal card
      const player = gameState.players[aiPosition];
      return player.hand[0];
    }

    return action.card;
  }

  analyze(gameState: GameState, aiPosition: PlayerPosition): AIAnalysis {
    if (!this.engine) {
      throw new Error('[ISMCTS AI] Engine not initialized');
    }

    // Run search with full statistics
    const result = this.engine.searchWithAnalysis(gameState, aiPosition);

    // Convert to AIAnalysis format
    const alternatives = Array.from(result.statistics.values())
      .filter(s => s.action !== result.bestAction)
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 3) // Top 3 alternatives
      .map(s => ({
        action: this.actionToValue(s.action),
        score: s.avgValue,
        probability: s.visits / result.totalSimulations,
      }));

    const bestStat = result.statistics.get(this.actionKey(result.bestAction));
    const confidence = bestStat ? bestStat.visits / result.totalSimulations : 0;

    return {
      recommendation: this.actionToValue(result.bestAction),
      confidence,
      alternatives,
      reasoning: [
        `ISMCTS analysis with ${result.totalSimulations} simulations`,
        `Most visited action has ${Math.round(confidence * 100)}% of simulations`,
        `Exploration depth varied across ${result.statistics.size} distinct actions`,
      ],
      metadata: {
        provider: 'ismcts',
        version: this.version,
        simulations: this.simulations,
        totalVisits: result.totalSimulations,
        actionsExplored: result.statistics.size,
      },
    };
  }

  private actionKey(action: Action): string {
    switch (action.type) {
      case 'BID':
        return `BID:${action.amount}`;
      case 'TRUMP':
        return `TRUMP:${action.suit}`;
      case 'FOLD':
        return `FOLD:${action.fold}`;
      case 'CARD':
        return `CARD:${action.card.id}`;
    }
  }

  private actionToValue(action: Action): Card | BidAmount | Suit | boolean {
    switch (action.type) {
      case 'BID':
        return action.amount;
      case 'TRUMP':
        return action.suit;
      case 'FOLD':
        return action.fold;
      case 'CARD':
        return action.card;
    }
  }
}

/**
 * Factory function to create ISMCTS AI instances
 */
export function createISMCTSAI(config: AIConfig): ISMCTSAIProvider {
  const provider = new ISMCTSAIProvider();
  provider.initialize(config);
  return provider;
}

/**
 * Metadata for registration
 */
export const ISMCTSAIMetadata = {
  id: 'ismcts',
  name: 'ISMCTS AI',
  version: '1.0.0',
  description:
    'Information Set Monte Carlo Tree Search - uses determinization and tree search for strong play',
  factory: createISMCTSAI,
  supportedDifficulties: ['medium', 'hard', 'expert'] as AIDifficulty[],
  isAsync: false,
  tags: ['mcts', 'tree-search', 'imperfect-information', 'strong'],
};
