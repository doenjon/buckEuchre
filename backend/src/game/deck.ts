/**
 * @module game/deck
 * @description Pure functions for deck operations in Buck Euchre
 * 
 * All functions in this module are pure (no I/O, no mutations, no side effects)
 */

import { Card } from '@buck-euchre/shared';
import { FULL_DECK, CARDS_PER_PLAYER, BLIND_SIZE, PLAYER_COUNT } from '../../../shared/src/constants/cards';
import { getShuffleSeed } from './random';
import { getEffectiveSuit, isSameColor } from '../../../shared/src/utils/cards';

export { getEffectiveSuit, isSameColor };

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

  // Optional deterministic shuffle when SHUFFLE_SEED is provided (tests)
  const seed = getShuffleSeed();
  let seededRandom = Math.random;
  if (seed) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let s = h >>> 0;
    seededRandom = () => {
      // xorshift32
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      // map to [0,1)
      return ((s >>> 0) / 4294967296);
    };
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    const r = seed ? seededRandom() : Math.random();
    const j = Math.floor(r * (i + 1));
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
