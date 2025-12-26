/**
 * @module ai/providers/ismcts
 * @description ISMCTS AI provider
 *
 * Uses Information Set Monte Carlo Tree Search for strong play.
 * Handles imperfect information through determinization and tree search.
 */

import { Card, Suit, BidAmount, GameState, PlayerPosition } from '@buck-euchre/shared';
import { AIProvider, AIConfig, AIDifficulty, AIAnalysis } from '../types';
import { ISMCTSEngine, ISMCTSConfig, AICharacter, Action } from '@buck-euchre/shared';
import { getCharacterPreset } from '../character';

/**
 * Map difficulty to simulation count
 * 
 * Default is 5000 iterations. Can be overridden via customIterations parameter.
 * Difficulty-based values are kept for backward compatibility but default is now 5000.
 */
function getSimulationCount(difficulty: AIDifficulty, customIterations?: number): number {
  // If custom iterations provided, use that
  if (customIterations !== undefined && customIterations > 0) {
    return customIterations;
  }
  
  // Default to 5000 iterations as requested
  // Difficulty-based values kept for reference but not used by default
  return 5000;
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
    
    // Get iterations from params, or use default 5000
    const customIterations = config.params?.iterations;
    this.simulations = getSimulationCount(config.difficulty, customIterations);

    // Get character from params (can be a preset name string or a character object)
    let character: AICharacter | undefined;
    if (config.params?.character) {
      if (typeof config.params.character === 'string') {
        // It's a preset name, get the preset
        character = getCharacterPreset(config.params.character);
      } else {
        // It's already a character object
        character = config.params.character as AICharacter;
      }
    }

    const ismctsConfig: ISMCTSConfig = {
      simulations: this.simulations,
      verbose: config.params?.verbose || false,
      character,
    };

    this.engine = new ISMCTSEngine(ismctsConfig);

    const characterInfo = character ? ` (character: ${JSON.stringify(character)})` : '';
    console.log(
      `[ISMCTS AI] Initialized with difficulty: ${config.difficulty} (${this.simulations} simulations)${characterInfo}`
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
      default:
        return 'UNKNOWN';
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
      default:
        // TypeScript requires a default case for exhaustiveness checking
        throw new Error(`Unknown action type`);
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
