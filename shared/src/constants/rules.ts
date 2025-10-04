/**
 * @module constants/rules
 * @description Game rules constants for Buck Euchre
 * 
 * Defines scoring rules, bid limits, and win conditions
 */

import { BidAmount } from '../types/game';

/**
 * Starting score for all players (countdown to 0)
 */
export const STARTING_SCORE = 15;

/**
 * Winning score (first player to reach this or below wins)
 */
export const WINNING_SCORE = 0;

/**
 * Minimum bid amount
 */
export const MIN_BID = 2;

/**
 * Maximum bid amount
 */
export const MAX_BID = 5;

/**
 * Valid bid amounts (excluding PASS)
 */
export const VALID_BID_AMOUNTS: readonly number[] = [2, 3, 4, 5] as const;

/**
 * All possible bid values (including PASS)
 */
export const ALL_BID_VALUES: readonly BidAmount[] = ['PASS', 2, 3, 4, 5] as const;

/**
 * Penalty for failing contract (euchred)
 */
export const EUCHRE_PENALTY = 5;

/**
 * Penalty for taking no tricks (got set)
 */
export const NO_TRICKS_PENALTY = 5;

/**
 * Score change for folded players
 */
export const FOLD_SCORE_CHANGE = 0;

/**
 * Token expiration time (24 hours in milliseconds)
 */
export const TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Player name constraints
 */
export const PLAYER_NAME_MIN_LENGTH = 2;
export const PLAYER_NAME_MAX_LENGTH = 20;

/**
 * Game timeouts (in milliseconds)
 */
export const GAME_TIMEOUTS = {
  /** Time to wait for disconnected player before showing warning */
  DISCONNECT_GRACE_PERIOD: 30 * 1000,  // 30 seconds
  
  /** Time before abandoning game with insufficient players */
  ABANDON_GAME_TIMEOUT: 5 * 60 * 1000,  // 5 minutes
  
  /** Time to display round results before next round */
  ROUND_OVER_DISPLAY_TIME: 5 * 1000,  // 5 seconds
  
  /** Time to display final game results */
  GAME_OVER_DISPLAY_TIME: 10 * 1000  // 10 seconds
} as const;

/**
 * WebSocket reconnection settings
 */
export const RECONNECTION_SETTINGS = {
  /** Maximum number of reconnection attempts */
  MAX_RECONNECT_ATTEMPTS: 5,
  
  /** Initial reconnection delay */
  RECONNECT_DELAY_MS: 1000,
  
  /** Maximum reconnection delay */
  MAX_RECONNECT_DELAY_MS: 5000
} as const;
