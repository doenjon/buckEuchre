"use strict";
/**
 * @module constants/cards
 * @description Card-related constants for Buck Euchre
 *
 * Defines the 24-card deck, suits, ranks, and card rankings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAME_COLOR_SUITS = exports.RED_SUITS = exports.BLACK_SUITS = exports.NON_TRUMP_RANK_VALUES = exports.TRUMP_RANK_VALUES = exports.TRICKS_PER_ROUND = exports.PLAYER_COUNT = exports.BLIND_SIZE = exports.CARDS_PER_PLAYER = exports.DECK_SIZE = exports.FULL_DECK = exports.RANKS = exports.SUITS = void 0;
/**
 * All suits in the game
 */
exports.SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
/**
 * All ranks in the game (24-card deck uses 9-A)
 */
exports.RANKS = ['9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'];
/**
 * Full 24-card deck
 */
exports.FULL_DECK = exports.SUITS.flatMap(suit => exports.RANKS.map(rank => ({
    suit,
    rank,
    id: `${suit}_${rank}`
})));
/**
 * Number of cards in the deck
 */
exports.DECK_SIZE = 24;
/**
 * Number of cards dealt to each player
 */
exports.CARDS_PER_PLAYER = 5;
/**
 * Number of cards in the blind/kitty
 */
exports.BLIND_SIZE = 4;
/**
 * Number of players in the game
 */
exports.PLAYER_COUNT = 4;
/**
 * Number of tricks per round
 */
exports.TRICKS_PER_ROUND = 5;
/**
 * Rank values for trump suit (highest to lowest)
 * Used for card comparison logic
 */
exports.TRUMP_RANK_VALUES = {
    'JACK': 7, // Right Bower (Jack of trump suit)
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
exports.NON_TRUMP_RANK_VALUES = {
    'ACE': 6,
    'KING': 5,
    'QUEEN': 4,
    'JACK': 3, // Regular Jack (not Left Bower)
    '10': 2,
    '9': 1
};
/**
 * Card color groupings (for Left Bower logic)
 */
exports.BLACK_SUITS = ['SPADES', 'CLUBS'];
exports.RED_SUITS = ['HEARTS', 'DIAMONDS'];
/**
 * Same-color suit pairs (for Left Bower identification)
 */
exports.SAME_COLOR_SUITS = {
    'SPADES': 'CLUBS',
    'CLUBS': 'SPADES',
    'HEARTS': 'DIAMONDS',
    'DIAMONDS': 'HEARTS'
};
//# sourceMappingURL=cards.js.map