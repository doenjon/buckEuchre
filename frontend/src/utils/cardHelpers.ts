/**
 * @module utils/cardHelpers
 * @description Helper utilities for card operations
 */

import type { Card, Suit, Rank } from '@buck-euchre/shared';

/**
 * Format card for display
 */
export function formatCard(card: Card): string {
  return `${formatRank(card.rank)} of ${formatSuit(card.suit)}`;
}

/**
 * Format rank for display
 */
export function formatRank(rank: Rank): string {
  const rankNames: Record<Rank, string> = {
    '9': '9',
    '10': '10',
    'JACK': 'Jack',
    'QUEEN': 'Queen',
    'KING': 'King',
    'ACE': 'Ace',
  };
  return rankNames[rank];
}

/**
 * Format suit for display
 */
export function formatSuit(suit: Suit): string {
  const suitNames: Record<Suit, string> = {
    'SPADES': 'Spades',
    'HEARTS': 'Hearts',
    'DIAMONDS': 'Diamonds',
    'CLUBS': 'Clubs',
  };
  return suitNames[suit];
}

/**
 * Get suit emoji/symbol
 */
export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    'SPADES': '♠',
    'HEARTS': '♥',
    'DIAMONDS': '♦',
    'CLUBS': '♣',
  };
  return symbols[suit];
}

/**
 * Get suit color
 */
export function getSuitColor(suit: Suit): 'red' | 'black' {
  return suit === 'HEARTS' || suit === 'DIAMONDS' ? 'red' : 'black';
}

/**
 * Sort cards by suit and rank
 */
export function sortCards(cards: Card[], trumpSuit?: Suit): Card[] {
  const suitOrder: Record<Suit, number> = {
    'SPADES': 0,
    'HEARTS': 1,
    'DIAMONDS': 2,
    'CLUBS': 3,
  };

  const rankOrder: Record<Rank, number> = {
    '9': 0,
    '10': 1,
    'JACK': 2,
    'QUEEN': 3,
    'KING': 4,
    'ACE': 5,
  };

  return [...cards].sort((a, b) => {
    // Trump cards come first
    if (trumpSuit) {
      if (a.suit === trumpSuit && b.suit !== trumpSuit) return -1;
      if (a.suit !== trumpSuit && b.suit === trumpSuit) return 1;
    }

    // Sort by suit
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) return suitDiff;

    // Sort by rank within suit
    return rankOrder[b.rank] - rankOrder[a.rank]; // Higher ranks first
  });
}

/**
 * Group cards by suit
 */
export function groupCardsBySuit(cards: Card[]): Record<Suit, Card[]> {
  return cards.reduce((groups, card) => {
    if (!groups[card.suit]) {
      groups[card.suit] = [];
    }
    groups[card.suit].push(card);
    return groups;
  }, {} as Record<Suit, Card[]>);
}

/**
 * Check if hand has suit
 */
export function hasSuit(cards: Card[], suit: Suit): boolean {
  return cards.some(card => card.suit === suit);
}

/**
 * Get cards of specific suit
 */
export function getCardsOfSuit(cards: Card[], suit: Suit): Card[] {
  return cards.filter(card => card.suit === suit);
}
