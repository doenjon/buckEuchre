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
import type { AICharacter } from './ismcts-engine';

/**
 * Fast heuristic for bidding
 *
 * Counts trump cards and bids based on strength.
 * Simpler than main decision-engine for speed.
 * Character affects bidding aggressiveness.
 */
function fastBid(
  hand: Card[],
  turnUpCard: Card,
  currentBid: number | null,
  trumpSuit: Suit,
  character?: AICharacter
): BidAmount {
  const trumpCards = hand.filter(c => getEffectiveSuit(c, trumpSuit) === trumpSuit);
  const trumpCount = trumpCards.length;

  // Count high trumps (Jack, Ace, King)
  const highTrumpCount = trumpCards.filter(
    c => c.rank === 'JACK' || c.rank === 'ACE' || c.rank === 'KING'
  ).length;

  // Apply character aggressiveness modifier (default 1.0 = balanced)
  const aggressiveness = character?.biddingAggressiveness ?? 1.0;
  
  // Adjust thresholds based on aggressiveness
  // Aggressive: lower thresholds (bids more often)
  // Conservative: higher thresholds (bids less often)
  const adjustedTrumpCount = trumpCount * aggressiveness;
  const adjustedHighTrumpCount = highTrumpCount * aggressiveness;

  // Simple bidding logic with character adjustment
  let desiredBid = 0;

  if (adjustedTrumpCount >= 4 && adjustedHighTrumpCount >= 2) {
    desiredBid = 4;
  } else if (adjustedTrumpCount >= 3 && adjustedHighTrumpCount >= 1) {
    desiredBid = 3;
  } else if (adjustedTrumpCount >= 2) {
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
 * Character affects fold threshold.
 */
function fastFoldDecision(
  hand: Card[],
  trumpSuit: Suit,
  isClubs: boolean,
  character?: AICharacter
): boolean {
  if (isClubs) return false; // Can't fold on clubs

  const trumpCards = hand.filter(c => getEffectiveSuit(c, trumpSuit) === trumpSuit);
  const trumpCount = trumpCards.length;

  // Count high trumps
  const highTrumpCount = trumpCards.filter(
    c => c.rank === 'JACK' || c.rank === 'ACE' || c.rank === 'KING'
  ).length;

  // Stay if we have high trump
  if (highTrumpCount > 0) return false;

  // Apply character fold threshold modifier (default 1.0 = balanced)
  // Higher threshold = fold less (stay more), lower = fold more
  const foldThreshold = character?.foldThreshold ?? 1.0;
  const adjustedThreshold = Math.max(1, Math.floor(2 * foldThreshold));

  // Fold if below adjusted threshold
  return trumpCount < adjustedThreshold;
}

/**
 * Fast heuristic for card play
 *
 * Simple strategy: lead high, follow low.
 * Character affects risk-taking in card selection.
 */
function fastCardPlay(
  gameState: GameState,
  playerPosition: PlayerPosition,
  character?: AICharacter
): Card {
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

  // Apply character risk-taking modifier (default 1.0 = balanced)
  const riskTaking = character?.riskTaking ?? 1.0;

  // Score each card
  const scoredCards = legalCards.map(card => {
    const effectiveSuit = getEffectiveSuit(card, trumpSuit);
    const rankValue = getRankValue(card, trumpSuit, effectiveSuit);

    let score = rankValue;
    if (isLeading) {
      // When leading, prefer high cards
      // Risk-taking affects how much we value high cards
      score = rankValue * 10 * riskTaking;
    } else {
      // When following, prefer low cards
      // Risk-taking makes us less likely to play low (more likely to challenge)
      score = (100 - rankValue * 10) / riskTaking;
    }

    return { card, score };
  });

  // Sort by score descending and return best
  scoredCards.sort((a, b) => b.score - a.score);
  return scoredCards[0].card;
}

/**
 * Run a fast rollout from current game state to end of current hand
 *
 * Uses simple heuristics to play out the CURRENT HAND only (not the whole game).
 * Returns the score change from the perspective of the given player.
 *
 * @param state - Current game state (will be cloned)
 * @param playerPosition - Player whose perspective to evaluate from
 * @param character - Optional character traits for varied play styles
 * @returns Score change for this hand only (range: -5 to +5)
 */
export function rollout(
  state: GameState,
  playerPosition: PlayerPosition,
  character?: AICharacter
): number {
  // Clone state to avoid mutations
  let currentState = JSON.parse(JSON.stringify(state)) as GameState;

  const initialScore = currentState.players[playerPosition].score;
  const initialRound = currentState.round;

  // Play until current hand is complete (ROUND_OVER or round number changes)
  let iterations = 0;
  const maxIterations = 200; // Much lower since we're only playing one hand

  while (currentState.phase !== 'ROUND_OVER' &&
         currentState.phase !== 'GAME_OVER' &&
         currentState.round === initialRound &&
         iterations < maxIterations) {
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
          currentState.turnUpCard.suit,
          // Only apply character if this is the player we're evaluating for
          bidder.position === playerPosition ? character : undefined
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
            currentState.isClubsTurnUp,
            // Only apply character if this is the player we're evaluating for
            player.position === playerPosition ? character : undefined
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

        // Get legal cards from current state
        const legalCards = player.hand.filter(
          c => canPlayCard(c, player.hand, currentState.currentTrick, currentState.trumpSuit!, player.folded === true).valid
        );

        if (legalCards.length === 0) {
          // No legal cards - this shouldn't happen, but return early
          console.warn('[Rollout] No legal cards available');
          return 0;
        }

        // Use fastCardPlay to select which card, but get the actual card object from legalCards
        const selectedCard = fastCardPlay(
          currentState,
          player.position,
          // Only apply character if this is the player we're evaluating for
          player.position === playerPosition ? character : undefined
        );
        // Find the card by ID in legalCards to ensure we have the correct reference from current state
        const cardToPlay = legalCards.find(c => c.id === selectedCard.id);
        
        if (!cardToPlay) {
          // Selected card not in legal cards - use first legal card as fallback
          console.warn(`[Rollout] Selected card ${selectedCard.id} not in legal cards, using fallback`);
          const fallbackCard = legalCards[0];
          try {
            currentState = applyCardPlay(currentState, player.position, fallbackCard.id);
          } catch (error: any) {
            console.warn(`[Rollout] Error playing fallback card: ${error.message || error}`);
            return 0;
          }
        } else {
          try {
            currentState = applyCardPlay(currentState, player.position, cardToPlay.id);
          } catch (error: any) {
            // Error playing card - return early with neutral score
            console.warn(`[Rollout] Error playing card: ${error.message || error}`);
            return 0;
          }
        }
        break;
      }

      default:
        // Shouldn't reach here
        console.warn(`[Rollout] Unknown phase: ${currentState.phase}`);
        return 0;
    }
  }

  // If we exited because we reached ROUND_OVER, finish the round to get final scores
  if (currentState.phase === 'ROUND_OVER') {
    currentState = finishRound(currentState);
  }

  if (iterations >= maxIterations) {
    console.warn(`[Rollout] Hit max iterations (${maxIterations})`);
  }

  // Calculate score change for this hand only
  const finalScore = currentState.players[playerPosition].score;
  const scoreChange = finalScore - initialScore;

  return scoreChange;
}

/**
 * Evaluate a terminal state (end of current hand)
 *
 * Converts score change to a normalized value (0-1 range).
 *
 * @param scoreChange - Change in score from rollout of current hand only
 * @returns Normalized value (higher is better)
 */
export function evaluateTerminalState(scoreChange: number): number {
  // In Buck Euchre, lower score is better (race to 0)
  // Score change per hand ranges from -5 to +5:
  //   Best:  -5 (took all 5 tricks)
  //   Worst: +5 (failed contract or took 0 tricks)
  // Normalize to 0-1 where 1 is best (most negative score change)

  // Invert and normalize
  const value = -scoreChange; // More negative score change = higher value
  const normalized = (value + 5) / 10; // Map [-5, 5] to [0, 1]

  return Math.max(0, Math.min(1, normalized)); // Clamp to [0, 1]
}

/**
 * Perform a complete simulation from current state
 *
 * @param state - Current game state
 * @param playerPosition - Player to evaluate from
 * @param character - Optional character traits for varied play styles
 * @returns Normalized value (0-1, higher is better)
 */
export function simulate(
  state: GameState,
  playerPosition: PlayerPosition,
  character?: AICharacter
): number {
  const scoreChange = rollout(state, playerPosition, character);
  return evaluateTerminalState(scoreChange);
}
