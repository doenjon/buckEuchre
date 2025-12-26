/**
 * @module ai/ismcts/ismcts-engine
 * @description Main ISMCTS algorithm implementation
 *
 * Information Set Monte Carlo Tree Search for Buck Euchre.
 * Handles imperfect information by determinizing and building a search tree.
 */

import { GameState, Card, Suit, BidAmount, PlayerPosition } from '@buck-euchre/shared';
import { MCTSNode, Action, serializeAction } from './mcts-node';
import { determinize } from './determinize';
import { simulate, SimulationResult } from './rollout';
import { applyBid, applyTrumpDeclaration, applyFoldDecision, applyCardPlay } from '../../game/state';
import { canPlayCard } from '../../game/validation';

/**
 * ISMCTS configuration
 */
export interface ISMCTSConfig {
  /** Number of simulations to run */
  simulations: number;

  /** Exploration constant for UCB1 (default: sqrt(2)) */
  explorationConstant?: number;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Character/personality traits for varied play styles */
  character?: AICharacter;
}

/**
 * AI Character traits that affect play style
 */
export interface AICharacter {
  /** Bidding aggressiveness (0.5 = conservative, 1.0 = balanced, 1.5 = aggressive) */
  biddingAggressiveness?: number;

  /** Risk-taking in card play (0.5 = safe, 1.0 = balanced, 1.5 = risky) */
  riskTaking?: number;

  /** Fold threshold modifier (0.5 = fold more, 1.0 = balanced, 1.5 = fold less) */
  foldThreshold?: number;
}

/**
 * Get legal actions for current game state
 */
function getLegalActions(gameState: GameState, playerPosition: PlayerPosition): Action[] {
  const actions: Action[] = [];
  const player = gameState.players[playerPosition];

  switch (gameState.phase) {
    case 'BIDDING': {
      // Can bid or pass
      const currentBid = gameState.highestBid;

      // Can always pass
      actions.push({ type: 'BID', amount: 'PASS' });

      // Can bid 2-5 if higher than current
      for (let bid = 2; bid <= 5; bid++) {
        if (currentBid === null || bid > currentBid) {
          actions.push({ type: 'BID', amount: bid as 2 | 3 | 4 | 5 });
        }
      }
      break;
    }

    case 'DECLARING_TRUMP': {
      // Can declare any suit
      const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
      for (const suit of suits) {
        actions.push({ type: 'TRUMP', suit });
      }
      break;
    }

    case 'FOLDING_DECISION': {
      // Can stay or fold
      if (!gameState.isClubsTurnUp) {
        actions.push({ type: 'FOLD', fold: true });
      }
      actions.push({ type: 'FOLD', fold: false });
      break;
    }

    case 'PLAYING': {
      // Get playable cards
      const trumpSuit = gameState.trumpSuit!;
      
      // If currentTrick has a winner, it's a completed trick - treat as empty for analysis
      // This handles the case where display state shows completed trick but we're analyzing next trick
      const trickForAnalysis = gameState.currentTrick.winner !== null
        ? { ...gameState.currentTrick, cards: [], winner: null }
        : gameState.currentTrick;
      
      for (const card of player.hand) {
        const validation = canPlayCard(
          card,
          player.hand,
          trickForAnalysis,
          trumpSuit,
          player.folded === true
        );
        if (validation.valid) {
          actions.push({ type: 'CARD', card });
        }
      }
      break;
    }

    default:
      // No actions in other phases
      break;
  }

  return actions;
}

/**
 * Apply an action to game state
 */
function applyAction(gameState: GameState, action: Action, playerPosition: PlayerPosition): GameState {
  switch (action.type) {
    case 'BID':
      return applyBid(gameState, playerPosition, action.amount);

    case 'TRUMP':
      return applyTrumpDeclaration(gameState, action.suit);

    case 'FOLD':
      return applyFoldDecision(gameState, playerPosition, action.fold);

    case 'CARD':
      return applyCardPlay(gameState, playerPosition, action.card.id);

    default:
      return gameState;
  }
}

/**
 * Helper to yield control to event loop periodically
 * This prevents blocking and allows other events (like button presses) to be processed
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * ISMCTS Engine
 */
export class ISMCTSEngine {
  private config: ISMCTSConfig;
  /** Number of simulations to run before yielding to event loop
   *  This makes MCTS "nice" - allows other events (like button presses) to be processed
   *  Yielding every 500 simulations balances responsiveness with performance
   */
  private readonly YIELD_INTERVAL = 500;

  constructor(config: ISMCTSConfig) {
    this.config = config;
  }

  /**
   * Select best action using ISMCTS
   *
   * @param gameState - Current game state
   * @param playerPosition - Our player position
   * @returns Best action to take
   */
  async search(gameState: GameState, playerPosition: PlayerPosition): Promise<Action> {
    const startTime = Date.now();

    // Get legal actions at root
    const legalActions = getLegalActions(gameState, playerPosition);

    if (legalActions.length === 0) {
      throw new Error('[ISMCTS] No legal actions available');
    }

    if (legalActions.length === 1) {
      // Only one choice, return it
      return legalActions[0];
    }

    // Create root node
    const root = new MCTSNode(null, null, legalActions);

    // Run simulations with periodic yields to prevent blocking event loop
    for (let i = 0; i < this.config.simulations; i++) {
      // 1. DETERMINIZE: Sample opponent hands
      const determinizedState = determinize(gameState, playerPosition);

      // 2-5. Run one simulation on determinized state
      this.runSimulation(root, determinizedState, playerPosition);

      // Yield to event loop periodically to allow other events to be processed
      // This makes MCTS "nice" and prevents blocking button presses
      if ((i + 1) % this.YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }
    }

    const elapsed = Date.now() - startTime;

    if (this.config.verbose) {
      console.log(`[ISMCTS] Completed ${this.config.simulations} simulations in ${elapsed}ms`);
      console.log(`[ISMCTS] Root visits: ${root.visits}`);

      const stats = root.getChildStatistics();
      console.log(`[ISMCTS] Action statistics:`);
      for (const [key, stat] of stats) {
        console.log(`  ${key}: visits=${stat.visits}, avgValue=${stat.avgValue.toFixed(3)}`);
      }
    }

    // Return most visited action (robust child selection)
    const bestChild = root.getMostVisitedChild();
    if (!bestChild || !bestChild.action) {
      // Fallback: return first legal action
      console.warn('[ISMCTS] No best child found, returning first legal action');
      return legalActions[0];
    }

    return bestChild.action;
  }

  /**
   * Run one MCTS simulation
   *
   * For ISMCTS with imperfect information, we only build a tree for the root
   * player's immediate actions. Building a deeper tree would include opponent
   * moves, which are invalid across different determinizations (opponent hands
   * change with each sample).
   */
  private runSimulation(
    root: MCTSNode,
    gameState: GameState,
    playerPosition: PlayerPosition
  ): void {
    let node = root;
    let state = gameState;

    // FLAT MONTE CARLO: Only expand at root level
    // Don't build a deep tree because opponent moves are different in each determinization

    // EXPANSION: Try an unexplored action at root
    if (!this.isTerminal(state) && !node.isFullyExpanded()) {
      const untriedAction = node.getUntriedAction();
      if (untriedAction) {
        // Apply the action
        const currentPlayer = this.getCurrentPlayer(state);
        state = applyAction(state, untriedAction, currentPlayer);
        // Create leaf child node (no further expansion)
        node = node.expand(untriedAction, []);
      }
    }
    // SELECTION: If all actions tried at root, pick one via UCB1
    else if (!this.isTerminal(state) && node.isFullyExpanded() && !node.isLeaf()) {
      const selectedChild = node.selectBestChild();
      if (selectedChild && selectedChild.action) {
        node = selectedChild;
        const currentPlayer = this.getCurrentPlayer(state);
        state = applyAction(state, selectedChild.action, currentPlayer);
      }
    }

    // SIMULATION: Play out rest of hand using rollout
    let value: number;
    let wasBucked: boolean;
    if (this.isTerminal(state)) {
      const result = this.evaluateState(state, playerPosition);
      value = result.value;
      wasBucked = result.wasBucked;
    } else {
      const result = simulate(state, playerPosition, this.config.character);
      value = result.value;
      wasBucked = result.wasBucked;
    }

    // BACKPROPAGATION: Update statistics up to root
    node.backpropagate(value, wasBucked);
  }

  /**
   * Check if state is terminal (hand is complete)
   */
  private isTerminal(state: GameState): boolean {
    // A hand is complete when we reach ROUND_OVER or GAME_OVER
    return state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER';
  }

  /**
   * Get current player for state
   */
  private getCurrentPlayer(state: GameState): PlayerPosition {
    switch (state.phase) {
      case 'BIDDING':
        return state.currentBidder !== null ? state.currentBidder : 0;

      case 'DECLARING_TRUMP':
        return state.winningBidderPosition !== null ? state.winningBidderPosition : 0;

      case 'FOLDING_DECISION':
        // For folding, we need to find first undecided player
        for (let i = 0; i < 4; i++) {
          const player = state.players[i];
          if (i !== state.winningBidderPosition && player.foldDecision === 'UNDECIDED') {
            return i as PlayerPosition;
          }
        }
        return 0; // Fallback

      case 'PLAYING':
        return state.currentPlayerPosition !== null ? state.currentPlayerPosition : 0;

      default:
        return 0;
    }
  }

  /**
   * Evaluate a terminal state (when hand is already complete)
   *
   * This is called when we reach a terminal state during tree expansion,
   * before running a rollout. Since we only simulate one hand at a time,
   * we need to evaluate based on the score change for that hand.
   */
  private evaluateState(state: GameState, playerPosition: PlayerPosition): SimulationResult {
    // If we're at ROUND_OVER, we need to finish the round to get final scores
    // Note: The state passed in might not have scores calculated yet
    // For now, just use the simulate() function which handles this correctly
    // This should rarely be called since we usually run rollouts instead
    return simulate(state, playerPosition, this.config.character);
  }

  /**
   * Get analysis of all actions (for teaching features)
   */
  async searchWithAnalysis(
    gameState: GameState,
    playerPosition: PlayerPosition
  ): Promise<{
    bestAction: Action;
    statistics: Map<string, { visits: number; avgValue: number; action: Action; stdError: number; confidenceInterval: { lower: number; upper: number; width: number }; buckProbability: number }>;
    totalSimulations: number;
  }> {
    // Run normal search
    const legalActions = getLegalActions(gameState, playerPosition);
    if (legalActions.length === 0) {
      throw new Error('[ISMCTS] No legal actions available for analysis');
    }

    const root = new MCTSNode(null, null, legalActions);
    let successfulSimulations = 0;
    let failedSimulations = 0;

    for (let i = 0; i < this.config.simulations; i++) {
      try {
        const determinizedState = determinize(gameState, playerPosition);
        this.runSimulation(root, determinizedState, playerPosition);
        successfulSimulations++;
      } catch (error: any) {
        // Log but continue - individual simulation failures shouldn't break analysis
        failedSimulations++;
        if (failedSimulations <= 10) {
          console.error(`[ISMCTS] Simulation ${i} failed:`, error.message || error, error.stack);
        }
        // Continue with next simulation
      }

      // Yield to event loop periodically to allow other events to be processed
      // This makes MCTS "nice" and prevents blocking button presses
      if ((i + 1) % this.YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }
    }

    // Always log simulation results
    console.log(`[ISMCTS] Simulations: ${successfulSimulations} succeeded, ${failedSimulations} failed out of ${this.config.simulations}`);
    console.log(`[ISMCTS] Root visits: ${root.visits}, Children: ${root.children.size}`);

    const childStats = root.getChildStatistics();
    for (const [key, stat] of childStats) {
      console.log(`[ISMCTS] Child ${key}: visits=${stat.visits}, avgValue=${stat.avgValue.toFixed(3)}`);
    }

    // If too many simulations failed, we might not have enough data
    if (successfulSimulations < this.config.simulations * 0.5) {
      console.warn(
        `[ISMCTS] Only ${successfulSimulations}/${this.config.simulations} simulations succeeded. Analysis may be unreliable.`
      );
    }

    const bestChild = root.getMostVisitedChild();
    const bestAction = bestChild?.action || legalActions[0];
    const statistics = root.getChildStatistics();

    return {
      bestAction,
      statistics,
      totalSimulations: root.visits,
    };
  }

  /**
   * Analyze hand with progress callbacks for UI updates
   * Returns statistics for all playable cards
   */
  async analyzeHandWithProgress(
    gameState: GameState,
    playerPosition: PlayerPosition,
    onProgress?: (simulations: number, total: number) => void,
    onIntermediateResults?: (results: Record<string, { visits: number; value: number; confidence?: { lower: number; upper: number }; buckProbability?: number }>) => void,
    abortSignal?: AbortSignal
  ): Promise<Record<string, { visits: number; value: number; confidence?: { lower: number; upper: number }; buckProbability?: number }>> {
    const legalActions = getLegalActions(gameState, playerPosition);
    if (legalActions.length === 0) {
      return {};
    }

    const root = new MCTSNode(null, null, legalActions);
    const totalSimulations = this.config.simulations;
    const progressInterval = 100; // Update progress every 100 simulations
    const intermediateResultsInterval = 1000; // Send intermediate results every 1000 simulations

    // Helper to convert current tree state to results
    const getResults = () => {
      const statistics = root.getChildStatistics();
      const results: Record<string, any> = {};

      for (const [key, stat] of statistics) {
        // Extract card ID from action key (format: "CARD:SUIT_RANK")
        const match = key.match(/^CARD:(.+)$/);
        if (match) {
          const cardId = match[1];
          results[cardId] = {
            visits: stat.visits,
            value: stat.avgValue, // Normalized value [0, 1]
            confidence: stat.confidenceInterval,
            buckProbability: stat.buckProbability
          };
        }
      }

      return results;
    };

    // Run simulations with progress updates
    for (let i = 0; i < totalSimulations; i++) {
      // Check if aborted
      if (abortSignal?.aborted) {
        console.log(`[ISMCTS] Analysis aborted after ${i} simulations`);
        break;
      }

      try {
        const determinizedState = determinize(gameState, playerPosition);
        this.runSimulation(root, determinizedState, playerPosition);
      } catch (error) {
        // Skip failed simulations
      }

      const currentSim = i + 1;

      // Report intermediate results periodically
      if (onIntermediateResults && currentSim % intermediateResultsInterval === 0) {
        const intermediateResults = getResults();
        onIntermediateResults(intermediateResults);
      }

      // Report progress
      if (onProgress && (currentSim % progressInterval === 0 || currentSim === totalSimulations)) {
        onProgress(currentSim, totalSimulations);
      }

      // Yield to event loop periodically to keep UI responsive
      if (currentSim % this.YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }
    }

    // Return final results
    return getResults();
  }
}
