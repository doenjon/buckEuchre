/**
 * @module game/cards
 * @description Card ranking and comparison logic for Buck Euchre
 * 
 * All functions in this module are pure (no I/O, no mutations, no side effects)
 */

import { Card, Suit, Rank } from '../../../shared/src/types/game';
import { TRUMP_RANK_VALUES, NON_TRUMP_RANK_VALUES } from '../../../shared/src/constants/cards';
import { getEffectiveSuit, isSameColor } from './deck';

/**
 * Gets the numeric rank value of a card
 * 
 * Trump suit rankings (highest to lowest):
 * - Right Bower (Jack of trump): 7
 * - Left Bower (Jack of same color): 6
 * - Ace of trump: 5
 * - King of trump: 4
 * - Queen of trump: 3
 * - 10 of trump: 2
 * - 9 of trump: 1
 * 
 * Non-trump suit rankings:
 * - Ace: 6
 * - King: 5
 * - Queen: 4
 * - Jack: 3
 * - 10: 2
 * - 9: 1
 * 
 * @param card - The card to evaluate
 * @param trumpSuit - The current trump suit
 * @param effectiveSuit - The effective suit of the card (considering Left Bower)
 * @returns Numeric value for ranking (higher = stronger)
 */
export function getRankValue(
  card: Card,
  trumpSuit: Suit,
  effectiveSuit: Suit
): number {
  if (effectiveSuit === trumpSuit) {
    // Trump suit rankings
    if (card.rank === 'JACK' && card.suit === trumpSuit) {
      // Right Bower (Jack of trump suit)
      return 7;
    }
    if (card.rank === 'JACK' && isSameColor(card.suit, trumpSuit) && card.suit !== trumpSuit) {
      // Left Bower (Jack of same color as trump)
      return 6;
    }
    // Other trump cards
    return TRUMP_RANK_VALUES[card.rank];
  } else {
    // Non-trump suit rankings
    return NON_TRUMP_RANK_VALUES[card.rank];
  }
}

/**
 * Determines if a card beats the current winning card in a trick
 * 
 * Rules:
 * 1. Trump always beats non-trump
 * 2. Among trump cards, higher rank wins
 * 3. Among non-trump cards of same suit, higher rank wins
 * 4. Led suit beats off-suit (unless trump involved)
 * 5. Off-suit cards cannot win
 * 
 * @param card - The card to evaluate
 * @param currentWinner - The current winning card
 * @param trumpSuit - The trump suit
 * @param ledSuit - The suit that was led (effective suit of first card)
 * @returns true if card beats currentWinner
 */
export function isHigherCard(
  card: Card,
  currentWinner: Card,
  trumpSuit: Suit,
  ledSuit: Suit
): boolean {
  const cardSuit = getEffectiveSuit(card, trumpSuit);
  const winnerSuit = getEffectiveSuit(currentWinner, trumpSuit);

  // Trump beats non-trump
  if (cardSuit === trumpSuit && winnerSuit !== trumpSuit) {
    return true;
  }
  if (cardSuit !== trumpSuit && winnerSuit === trumpSuit) {
    return false;
  }

  // Both trump or both same suit: compare ranks
  if (cardSuit === winnerSuit) {
    return getRankValue(card, trumpSuit, cardSuit) > 
           getRankValue(currentWinner, trumpSuit, winnerSuit);
  }

  // Different non-trump suits: led suit wins
  return cardSuit === ledSuit;
}
