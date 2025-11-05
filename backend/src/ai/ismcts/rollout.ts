/**
 * @module ai/ismcts/rollout
 * @description Fast rollout policy for ISMCTS
 *
 * Plays out a game from any state to the end using simple heuristics.
 * Must be fast (~0.5-1ms per rollout) as we run thousands of simulations.
 */

import { GameState, Card, Suit, BidAmount, PlayerPosition } from '@buck-euchre/shared';
import {
  applyBid,
  applyTrumpDeclaration,
  applyFoldDecision,
  applyCardPlay,
  finishRound,
} from '../../game/state';
import { canPlayCard } from '../../game/validation';
import { getEffectiveSuit } from '../../game/deck';
import { getRankValue } from '../../game/cards';

/**
 * Fast heuristic for bidding
 *
 * Counts trump cards and bids based on strength.
 * Simpler than main decision-engine for speed.
 */
function fastBid(
  hand: Card[],
  turnUpCard: Card,
  currentBid: number | null,
  trumpSuit: Suit
): BidAmount {
  const trumpCards = hand.filter(c => getEffectiveSuit(c, trumpSuit) === trumpSuit);
  const trumpCount = trumpCards.length;

  // Count high trumps (Jack, Ace, King)
  const highTrumpCount = trumpCards.filter(
    c => c.rank === 'JACK' || c.rank === 'ACE' || c.rank === 'KING'
  ).length;

  // Simple bidding logic
  let desiredBid = 0;

  if (trumpCount >= 4 && highTrumpCount >= 2) {
    desiredBid = 4;
  } else if (trumpCount >= 3 && highTrumpCount >= 1) {
    desiredBid = 3;
  } else if (trumpCount >= 2) {
    desiredBid = 2;
  }

  // Must beat current bid
  if (desiredBid === 0 || (currentBid !== null && desiredBid <= currentBid)) {
    return 'PASS';
  }

  return Math.min(desiredBid, 5) as 2 | 3 | 4 | 5;
}

/**
 * Fast heuristic for trump declaration
 *
 * Chooses suit with most cards (considering Left Bower).
 */
function fastTrumpDeclaration(hand: Card[]): Suit {
  const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
  let bestSuit = suits[0];
  let bestCount = 0;

  for (const suit of suits) {
    const count = hand.filter(c => getEffectiveSuit(c, suit) === suit).length;
    if (count > bestCount) {
      bestCount = count;
      bestSuit = suit;
    }
  }

  return bestSuit;
}

/**
 * Fast heuristic for fold decision
 *
 * Folds if weak trump holding.
 */
function fastFoldDecision(hand: Card[], trumpSuit: Suit, isClubs: boolean): boolean {
  if (isClubs) return false; // Can't fold on clubs

  const trumpCards = hand.filter(c => getEffectiveSuit(c, trumpSuit) === trumpSuit);
  const trumpCount = trumpCards.length;

  // Count high trumps
  const highTrumpCount = trumpCards.filter(
    c => c.rank === 'JACK' || c.rank === 'ACE' || c.rank === 'KING'
  ).length;

  // Stay if we have high trump
  if (highTrumpCount > 0) return false;

  // Fold if <2 trumps
  return trumpCount < 2;
}

/**
 * Fast heuristic for card play
 *
 * Simple strategy: lead high, follow low.
 */
function fastCardPlay(gameState: GameState, playerPosition: PlayerPosition): Card {
  const player = gameState.players[playerPosition];
  const trumpSuit = gameState.trumpSuit!;
  const isLeading = gameState.currentTrick.cards.length === 0;

  // Get legal cards
  const legalCards = player.hand.filter(
    card => canPlayCard(card, player.hand, gameState.currentTrick, trumpSuit, player.folded === true).valid
  );

  if (legalCards.length === 0) {
    // Shouldn't happen, fallback
    return player.hand[0];
  }

  if (legalCards.length === 1) {
    return legalCards[0];
  }

  // Score each card
  const scoredCards = legalCards.map(card => {
    const effectiveSuit = getEffectiveSuit(card, trumpSuit);
    const rankValue = getRankValue(card, trumpSuit, effectiveSuit);

    let score = rankValue;
    if (isLeading) {
      // When leading, prefer high cards
      score = rankValue * 10;
    } else {
      // When following, prefer low cards
      score = 100 - rankValue * 10;
    }

    return { card, score };
  });

  // Sort by score descending
  scoredCards.sort((a, b) => b.score - a.score);

  return scoredCards[0].card;
}

/**
 * Run a fast rollout from current game state to end
 *
 * Uses simple heuristics to play out the game quickly.
 * Returns the score change from the perspective of the given player.
 *
 * @param state - Current game state (will be cloned)
 * @param playerPosition - Player whose perspective to evaluate from
 * @returns Score change (negative is better in Buck Euchre)
 */
export function rollout(state: GameState, playerPosition: PlayerPosition): number {
  // Clone state to avoid mutations
  let currentState = JSON.parse(JSON.stringify(state)) as GameState;

  const initialScore = currentState.players[playerPosition].score;

  // Play until game over
  let iterations = 0;
  const maxIterations = 1000; // Safety limit

  while (!currentState.gameOver && iterations < maxIterations) {
    iterations++;

    switch (currentState.phase) {
      case 'BIDDING': {
        // Find current bidder
        if (currentState.currentBidder === null) {
          console.warn('[Rollout] No current bidder in BIDDING phase');
          return 0;
        }

        const bidder = currentState.players[currentState.currentBidder];
        if (!currentState.turnUpCard) {
          console.warn('[Rollout] No turn up card in BIDDING phase');
          return 0;
        }

        const bid = fastBid(
          bidder.hand,
          currentState.turnUpCard,
          currentState.highestBid,
          currentState.turnUpCard.suit
        );

        currentState = applyBid(currentState, bidder.position, bid);
        break;
      }

      case 'DECLARING_TRUMP': {
        if (currentState.winningBidderPosition === null) {
          console.warn('[Rollout] No winning bidder in DECLARING_TRUMP phase');
          return 0;
        }

        const bidder = currentState.players[currentState.winningBidderPosition];
        const trumpSuit = fastTrumpDeclaration(bidder.hand);

        currentState = applyTrumpDeclaration(currentState, trumpSuit);
        break;
      }

      case 'FOLDING_DECISION': {
        // All non-bidders make fold decisions
        let allDecided = true;

        for (let i = 0; i < 4; i++) {
          const player = currentState.players[i];
          if (i === currentState.winningBidderPosition) continue;
          if (player.foldDecision !== 'UNDECIDED') continue;

          allDecided = false;

          if (!currentState.trumpSuit) {
            console.warn('[Rollout] No trump suit in FOLDING_DECISION phase');
            return 0;
          }

          const shouldFold = fastFoldDecision(
            player.hand,
            currentState.trumpSuit,
            currentState.isClubsTurnUp
          );

          currentState = applyFoldDecision(currentState, player.position, shouldFold);
        }

        // If all decided, phase should transition automatically
        if (allDecided) {
          console.warn('[Rollout] All decided but still in FOLDING_DECISION');
        }
        break;
      }

      case 'PLAYING': {
        if (currentState.currentPlayerPosition === null) {
          console.warn('[Rollout] No current player in PLAYING phase');
          return 0;
        }

        const player = currentState.players[currentState.currentPlayerPosition];

        // Skip folded players
        if (player.folded) {
          console.warn('[Rollout] Current player has folded');
          return 0;
        }

        const card = fastCardPlay(currentState, player.position);
        currentState = applyCardPlay(currentState, player.position, card.id);
        break;
      }

      case 'ROUND_OVER': {
        currentState = finishRound(currentState);
        break;
      }

      default:
        // Shouldn't reach here
        console.warn(`[Rollout] Unknown phase: ${currentState.phase}`);
        return 0;
    }
  }

  if (iterations >= maxIterations) {
    console.warn('[Rollout] Hit max iterations');
  }

  // Calculate score change
  const finalScore = currentState.players[playerPosition].score;
  const scoreChange = finalScore - initialScore;

  return scoreChange;
}

/**
 * Evaluate a terminal state
 *
 * Converts score change to a normalized value (0-1 range).
 *
 * @param scoreChange - Change in score
 * @returns Normalized value (higher is better)
 */
export function evaluateTerminalState(scoreChange: number): number {
  // In Buck Euchre, lower score is better
  // Score typically ranges from -15 to +15
  // Normalize to 0-1 where 1 is best (most negative score)

  // Invert and normalize
  const value = -scoreChange; // More negative score = higher value
  const normalized = (value + 15) / 30; // Map [-15, 15] to [0, 1]

  return Math.max(0, Math.min(1, normalized)); // Clamp to [0, 1]
}

/**
 * Perform a complete simulation from current state
 *
 * @param state - Current game state
 * @param playerPosition - Player to evaluate from
 * @returns Normalized value (0-1, higher is better)
 */
export function simulate(state: GameState, playerPosition: PlayerPosition): number {
  const scoreChange = rollout(state, playerPosition);
  return evaluateTerminalState(scoreChange);
}
