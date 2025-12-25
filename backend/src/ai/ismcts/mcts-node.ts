/**
 * @module ai/ismcts/mcts-node
 * @description MCTS tree node with UCB1 selection
 *
 * Represents a node in the Monte Carlo Tree Search tree.
 * Tracks visit counts, values, and implements UCB1 for action selection.
 */

import { Card, BidAmount, Suit } from '@buck-euchre/shared';

/**
 * Action types in Buck Euchre
 */
export type Action =
  | { type: 'BID'; amount: BidAmount }
  | { type: 'TRUMP'; suit: Suit }
  | { type: 'FOLD'; fold: boolean }
  | { type: 'CARD'; card: Card };

/**
 * Serialize an action to a unique string key
 */
export function serializeAction(action: Action): string {
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

/**
 * MCTS tree node
 */
export class MCTSNode {
  /** Number of times this node has been visited */
  visits: number = 0;

  /** Sum of all simulation values from this node */
  totalValue: number = 0;

  /** Sum of squared simulation values (for variance calculation) */
  totalValueSquared: number = 0;

  /** Parent node (null for root) */
  parent: MCTSNode | null;

  /** Child nodes mapped by action */
  children: Map<string, MCTSNode> = new Map();

  /** Action that led to this node from parent (null for root) */
  action: Action | null;

  /** Actions that haven't been expanded yet */
  untriedActions: Action[];

  /** Exploration constant for UCB1 */
  private static readonly C = Math.sqrt(2); // Standard value

  constructor(parent: MCTSNode | null, action: Action | null, legalActions: Action[]) {
    this.parent = parent;
    this.action = action;
    this.untriedActions = [...legalActions];
  }

  /**
   * Check if this is a leaf node (no children expanded yet)
   */
  isLeaf(): boolean {
    return this.children.size === 0;
  }

  /**
   * Check if this node is fully expanded (all legal actions tried)
   */
  isFullyExpanded(): boolean {
    return this.untriedActions.length === 0;
  }

  /**
   * Get average value of this node
   */
  get averageValue(): number {
    return this.visits > 0 ? this.totalValue / this.visits : 0;
  }

  /**
   * Calculate variance of simulation values
   *
   * Variance = E[X²] - E[X]²
   *
   * For ISMCTS with discrete outcomes from rollouts, the empirical variance
   * may be very low if determinizations lead to similar outcomes. We add
   * a minimum variance floor based on the number of visits to ensure
   * confidence intervals reflect epistemic uncertainty (not just aleatoric).
   */
  getVariance(): number {
    if (this.visits === 0) return 0;
    const mean = this.averageValue;
    const meanOfSquares = this.totalValueSquared / this.visits;
    const empiricalVariance = meanOfSquares - mean * mean;

    // Add minimum variance floor to account for epistemic uncertainty
    // (model uncertainty) even when aleatoric uncertainty (outcome variance) is low.
    // For avgValue in [0,1], we use a floor of (0.05)^2 = 0.0025
    // This ensures SE >= 0.05/sqrt(n), giving meaningful confidence intervals
    // even when rollout outcomes are very consistent.
    const minVariance = 0.0025; // Equivalent to ±0.5 on the score scale

    return Math.max(empiricalVariance, minVariance);
  }

  /**
   * Calculate standard deviation of simulation values
   */
  getStdDev(): number {
    return Math.sqrt(Math.max(0, this.getVariance())); // max(0, ...) handles floating point errors
  }

  /**
   * Calculate standard error of the mean
   *
   * SE = σ / sqrt(n)
   */
  getStandardError(): number {
    if (this.visits === 0) return 0;
    return this.getStdDev() / Math.sqrt(this.visits);
  }

  /**
   * Calculate confidence interval for the average value
   *
   * @param confidenceLevel - Confidence level (0.95 for 95%, 0.99 for 99%)
   * @returns Confidence interval with lower and upper bounds
   */
  getConfidenceInterval(confidenceLevel: number = 0.95): { lower: number; upper: number; width: number } {
    if (this.visits === 0) {
      return { lower: 0, upper: 0, width: 0 };
    }

    // Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    const z = zScores[confidenceLevel] || 1.96; // Default to 95%
    const se = this.getStandardError();
    const margin = z * se;

    return {
      lower: this.averageValue - margin,
      upper: this.averageValue + margin,
      width: 2 * margin,
    };
  }

  /**
   * Calculate UCB1 value for this node
   *
   * UCB1 = Q/N + C * sqrt(ln(N_parent) / N)
   * where:
   * - Q = total value
   * - N = visit count
   * - N_parent = parent visit count
   * - C = exploration constant
   */
  getUCB1Value(): number {
    if (this.visits === 0) {
      return Infinity; // Unvisited nodes have infinite value
    }

    if (!this.parent) {
      return this.averageValue; // Root has no parent
    }

    const exploitation = this.averageValue;
    const exploration = MCTSNode.C * Math.sqrt(Math.log(this.parent.visits) / this.visits);

    return exploitation + exploration;
  }

  /**
   * Select best child using UCB1
   *
   * @returns Child node with highest UCB1 value
   */
  selectBestChild(): MCTSNode | null {
    if (this.children.size === 0) {
      return null;
    }

    let bestChild: MCTSNode | null = null;
    let bestValue = -Infinity;

    for (const child of this.children.values()) {
      const value = child.getUCB1Value();
      if (value > bestValue) {
        bestValue = value;
        bestChild = child;
      }
    }

    return bestChild;
  }

  /**
   * Expand a new child node
   *
   * Takes an untried action and creates a child node for it.
   *
   * @param action - Action to expand
   * @param legalActions - Legal actions from the new state
   * @returns New child node
   */
  expand(action: Action, legalActions: Action[]): MCTSNode {
    // Remove from untried actions
    const index = this.untriedActions.findIndex(
      a => serializeAction(a) === serializeAction(action)
    );
    if (index >= 0) {
      this.untriedActions.splice(index, 1);
    }

    // Create child node
    const child = new MCTSNode(this, action, legalActions);
    const key = serializeAction(action);
    this.children.set(key, child);

    return child;
  }

  /**
   * Get an untried action
   *
   * @returns Random untried action, or null if all tried
   */
  getUntriedAction(): Action | null {
    if (this.untriedActions.length === 0) {
      return null;
    }

    // Return random untried action
    const index = Math.floor(Math.random() * this.untriedActions.length);
    return this.untriedActions[index];
  }

  /**
   * Backpropagate simulation result up the tree
   *
   * @param value - Simulation result value
   */
  backpropagate(value: number): void {
    this.visits++;
    this.totalValue += value;
    this.totalValueSquared += value * value;

    if (this.parent) {
      this.parent.backpropagate(value);
    }
  }

  /**
   * Get most visited child (used to select final action)
   *
   * @returns Most visited child node, or null if no children
   */
  getMostVisitedChild(): MCTSNode | null {
    if (this.children.size === 0) {
      return null;
    }

    let bestChild: MCTSNode | null = null;
    let mostVisits = -1;

    for (const child of this.children.values()) {
      if (child.visits > mostVisits) {
        mostVisits = child.visits;
        bestChild = child;
      }
    }

    return bestChild;
  }

  /**
   * Get child with highest average value (alternative to most visited)
   *
   * @returns Child with best average value
   */
  getBestValueChild(): MCTSNode | null {
    if (this.children.size === 0) {
      return null;
    }

    let bestChild: MCTSNode | null = null;
    let bestValue = -Infinity;

    for (const child of this.children.values()) {
      if (child.averageValue > bestValue) {
        bestValue = child.averageValue;
        bestChild = child;
      }
    }

    return bestChild;
  }

  /**
   * Get statistics for all child actions (useful for analysis/teaching)
   *
   * @returns Map of action to statistics
   */
  getChildStatistics(): Map<
    string,
    {
      visits: number;
      avgValue: number;
      action: Action;
      stdError: number;
      confidenceInterval: { lower: number; upper: number; width: number };
    }
  > {
    const stats = new Map();

    for (const [key, child] of this.children) {
      if (child.action) {
        stats.set(key, {
          visits: child.visits,
          avgValue: child.averageValue,
          action: child.action,
          stdError: child.getStandardError(),
          confidenceInterval: child.getConfidenceInterval(),
        });
      }
    }

    return stats;
  }

  /**
   * Get total simulations run through this node
   */
  getTotalSimulations(): number {
    return this.visits;
  }

  /**
   * Get visit distribution for all children (normalized to probabilities)
   */
  getVisitDistribution(): Map<string, number> {
    const distribution = new Map<string, number>();
    const totalVisits = this.visits;

    if (totalVisits === 0) return distribution;

    for (const [key, child] of this.children) {
      distribution.set(key, child.visits / totalVisits);
    }

    return distribution;
  }
}
