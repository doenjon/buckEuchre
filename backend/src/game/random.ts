/**
 * @module game/random
 * @description Helpers for deterministic shuffling during tests
 */

import { Card, FULL_DECK } from '@buck-euchre/shared';

let shuffleSeed: string | null = process.env.SHUFFLE_SEED ?? null;
let customDeck: Card[] | null = null;
let dealerOverride: number | null = null;

/**
 * Get the currently configured shuffle seed
 */
export function getShuffleSeed(): string | null {
  return shuffleSeed;
}

/**
 * Set the shuffle seed (used by test control endpoint)
 */
export function setShuffleSeed(seed: string | null): void {
  shuffleSeed = seed;
}

/**
 * Set a custom deck order for the next deal
 */
export function setCustomDeck(cardIds: string[] | null): void {
  if (!cardIds) {
    customDeck = null;
    return;
  }

  if (cardIds.length !== FULL_DECK.length) {
    throw new Error(`Custom deck must contain ${FULL_DECK.length} cards`);
  }

  const deck: Card[] = [];
  for (const id of cardIds) {
    const card = FULL_DECK.find((c) => c.id === id);
    if (!card) {
      throw new Error(`Invalid card id: ${id}`);
    }
    if (deck.some((existing) => existing.id === id)) {
      throw new Error(`Duplicate card id: ${id}`);
    }
    deck.push({ ...card });
  }
  customDeck = deck;
}

/**
 * Consume custom deck if set
 */
export function consumeCustomDeck(): Card[] | null {
    const deck = customDeck;
    customDeck = null;
    return deck ? deck.map((card) => ({ ...card })) : null;
}

export function setDealerOverride(position: number | null): void {
  dealerOverride = position;
}

export function consumeDealerOverride(): number | null {
  const value = dealerOverride;
  dealerOverride = null;
  return value;
}
