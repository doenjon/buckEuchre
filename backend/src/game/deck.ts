/**
 * @module game/deck
 * @description Pure functions for deck operations in Buck Euchre
 * 
 * All functions in this module are pure (no I/O, no mutations, no side effects)
 */

import { Card, Suit } from '../../../shared/src/types/game';
import { FULL_DECK, CARDS_PER_PLAYER, BLIND_SIZE, PLAYER_COUNT } from '../../../shared/src/constants/cards';
import { BLACK_SUITS, RED_SUITS } from '../../../shared/src/constants/cards';

/**
 * Creates a fresh 24-card deck
 * @returns Array of 24 unique cards
 */
export function createDeck(): Card[] {
  // Create a fresh copy of the full deck
  return FULL_DECK.map(card => ({ ...card }));
}

/**
 * Shuffles a deck using Fisher-Yates algorithm
 * @param deck - Array of cards to shuffle
 * @returns New shuffled deck (does not mutate input)
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Deals cards from a shuffled deck
 * @param deck - Shuffled deck of 24 cards
 * @returns Object containing 4 hands (5 cards each) and blind (4 cards)
 */
export function dealCards(deck: Card[]): {
  hands: [Card[], Card[], Card[], Card[]];
  blind: Card[];
} {
  if (deck.length !== 24) {
    throw new Error(`Deck must have 24 cards, got ${deck.length}`);
  }

  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  const blind: Card[] = [];

  // Deal 5 cards to each player
  let cardIndex = 0;
  
  for (let round = 0; round < CARDS_PER_PLAYER; round++) {
    for (let player = 0; player < PLAYER_COUNT; player++) {
      hands[player].push(deck[cardIndex]);
      cardIndex++;
    }
  }

  // Remaining 4 cards go to blind
  for (let i = 0; i < BLIND_SIZE; i++) {
    blind.push(deck[cardIndex]);
    cardIndex++;
  }

  return { hands, blind };
}

/**
 * Gets the effective suit of a card considering Left Bower rule
 * 
 * The Left Bower (Jack of same color as trump) is considered part of trump suit
 * 
 * @param card - The card to evaluate
 * @param trumpSuit - The current trump suit
 * @returns The effective suit (may differ from card.suit for Left Bower)
 */
export function getEffectiveSuit(card: Card, trumpSuit: Suit): Suit {
  // Left Bower: Jack of same color as trump, but different suit
  if (card.rank === 'JACK' && isSameColor(card.suit, trumpSuit) && card.suit !== trumpSuit) {
    return trumpSuit;
  }
  
  return card.suit;
}

/**
 * Checks if two suits are the same color
 * @param suit1 - First suit
 * @param suit2 - Second suit
 * @returns true if both suits are same color
 */
export function isSameColor(suit1: Suit, suit2: Suit): boolean {
  const bothBlack = BLACK_SUITS.includes(suit1) && BLACK_SUITS.includes(suit2);
  const bothRed = RED_SUITS.includes(suit1) && RED_SUITS.includes(suit2);
  
  return bothBlack || bothRed;
}
