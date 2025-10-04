/**
 * @module constants/cards
 * @description Card-related constants for Buck Euchre
 * 
 * Defines the 24-card deck, suits, ranks, and card rankings
 */

import { Suit, Rank, Card } from '../types/game';

/**
 * All suits in the game
 */
export const SUITS: readonly Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const;

/**
 * All ranks in the game (24-card deck uses 9-A)
 */
export const RANKS: readonly Rank[] = ['9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'] as const;

/**
 * Full 24-card deck
 */
export const FULL_DECK: readonly Card[] = SUITS.flatMap(suit =>
  RANKS.map(rank => ({
    suit,
    rank,
    id: `${suit}_${rank}`
  }))
);

/**
 * Number of cards in the deck
 */
export const DECK_SIZE = 24;

/**
 * Number of cards dealt to each player
 */
export const CARDS_PER_PLAYER = 5;

/**
 * Number of cards in the blind/kitty
 */
export const BLIND_SIZE = 4;

/**
 * Number of players in the game
 */
export const PLAYER_COUNT = 4;

/**
 * Number of tricks per round
 */
export const TRICKS_PER_ROUND = 5;

/**
 * Rank values for trump suit (highest to lowest)
 * Used for card comparison logic
 */
export const TRUMP_RANK_VALUES: Record<Rank, number> = {
  'JACK': 7,   // Right Bower (Jack of trump suit)
  // Note: Left Bower (Jack of same color) also gets value 6 (handled in game logic)
  'ACE': 5,
  'KING': 4,
  'QUEEN': 3,
  '10': 2,
  '9': 1
};

/**
 * Rank values for non-trump suits (highest to lowest)
 * Used for card comparison logic
 */
export const NON_TRUMP_RANK_VALUES: Record<Rank, number> = {
  'ACE': 6,
  'KING': 5,
  'QUEEN': 4,
  'JACK': 3,  // Regular Jack (not Left Bower)
  '10': 2,
  '9': 1
};

/**
 * Card color groupings (for Left Bower logic)
 */
export const BLACK_SUITS: readonly Suit[] = ['SPADES', 'CLUBS'] as const;
export const RED_SUITS: readonly Suit[] = ['HEARTS', 'DIAMONDS'] as const;

/**
 * Same-color suit pairs (for Left Bower identification)
 */
export const SAME_COLOR_SUITS: Record<Suit, Suit> = {
  'SPADES': 'CLUBS',
  'CLUBS': 'SPADES',
  'HEARTS': 'DIAMONDS',
  'DIAMONDS': 'HEARTS'
};
