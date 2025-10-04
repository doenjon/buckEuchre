"use strict";
/**
 * @module constants/rules
 * @description Game rules constants for Buck Euchre
 *
 * Defines scoring rules, bid limits, and win conditions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECONNECTION_SETTINGS = exports.GAME_TIMEOUTS = exports.PLAYER_NAME_MAX_LENGTH = exports.PLAYER_NAME_MIN_LENGTH = exports.TOKEN_EXPIRATION_MS = exports.FOLD_SCORE_CHANGE = exports.NO_TRICKS_PENALTY = exports.EUCHRE_PENALTY = exports.ALL_BID_VALUES = exports.VALID_BID_AMOUNTS = exports.MAX_BID = exports.MIN_BID = exports.WINNING_SCORE = exports.STARTING_SCORE = void 0;
/**
 * Starting score for all players (countdown to 0)
 */
exports.STARTING_SCORE = 15;
/**
 * Winning score (first player to reach this or below wins)
 */
exports.WINNING_SCORE = 0;
/**
 * Minimum bid amount
 */
exports.MIN_BID = 2;
/**
 * Maximum bid amount
 */
exports.MAX_BID = 5;
/**
 * Valid bid amounts (excluding PASS)
 */
exports.VALID_BID_AMOUNTS = [2, 3, 4, 5];
/**
 * All possible bid values (including PASS)
 */
exports.ALL_BID_VALUES = ['PASS', 2, 3, 4, 5];
/**
 * Penalty for failing contract (euchred)
 */
exports.EUCHRE_PENALTY = 5;
/**
 * Penalty for taking no tricks (got set)
 */
exports.NO_TRICKS_PENALTY = 5;
/**
 * Score change for folded players
 */
exports.FOLD_SCORE_CHANGE = 0;
/**
 * Token expiration time (24 hours in milliseconds)
 */
exports.TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;
/**
 * Player name constraints
 */
exports.PLAYER_NAME_MIN_LENGTH = 2;
exports.PLAYER_NAME_MAX_LENGTH = 20;
/**
 * Game timeouts (in milliseconds)
 */
exports.GAME_TIMEOUTS = {
    /** Time to wait for disconnected player before showing warning */
    DISCONNECT_GRACE_PERIOD: 30 * 1000, // 30 seconds
    /** Time before abandoning game with insufficient players */
    ABANDON_GAME_TIMEOUT: 5 * 60 * 1000, // 5 minutes
    /** Time to display round results before next round */
    ROUND_OVER_DISPLAY_TIME: 5 * 1000, // 5 seconds
    /** Time to display final game results */
    GAME_OVER_DISPLAY_TIME: 10 * 1000 // 10 seconds
};
/**
 * WebSocket reconnection settings
 */
exports.RECONNECTION_SETTINGS = {
    /** Maximum number of reconnection attempts */
    MAX_RECONNECT_ATTEMPTS: 5,
    /** Initial reconnection delay */
    RECONNECT_DELAY_MS: 1000,
    /** Maximum reconnection delay */
    MAX_RECONNECT_DELAY_MS: 5000
};
//# sourceMappingURL=rules.js.map