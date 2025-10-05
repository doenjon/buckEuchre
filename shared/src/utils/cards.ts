import { Card, Suit } from '../types/game';
import { BLACK_SUITS, RED_SUITS } from '../constants/cards';

/**
 * Determines whether two suits share the same color.
 */
export function isSameColor(suit1: Suit, suit2: Suit): boolean {
  const bothBlack = BLACK_SUITS.includes(suit1) && BLACK_SUITS.includes(suit2);
  const bothRed = RED_SUITS.includes(suit1) && RED_SUITS.includes(suit2);

  return bothBlack || bothRed;
}

/**
 * Gets the effective suit of a card taking the Left Bower rule into account.
 */
export function getEffectiveSuit(card: Card, trumpSuit: Suit): Suit {
  if (card.rank === 'JACK' && isSameColor(card.suit, trumpSuit) && card.suit !== trumpSuit) {
    return trumpSuit;
  }

  return card.suit;
}
