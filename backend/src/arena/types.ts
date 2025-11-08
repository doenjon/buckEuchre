/**
 * AI Arena System Types
 *
 * Defines types for running automated AI vs AI battles
 * with ELO rating tracking.
 */

import type { AIDifficulty } from '../ai/types';

/**
 * Arena AI configuration
 */
export interface ArenaConfig {
  id: string; // e.g., 'rule-easy', 'ismcts-medium'
  name: string; // Display name
  provider: string; // 'rule-based', 'ismcts'
  difficulty: AIDifficulty;
  params?: Record<string, any>; // Custom parameters
  eloRating: number;
  gamesPlayed: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Arena match status
 */
export type ArenaMatchStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ERROR';

/**
 * Arena match record
 */
export interface ArenaMatch {
  id: string;
  status: ArenaMatchStatus;
  createdAt: Date;
  completedAt?: Date;
  participants: ArenaParticipant[];
}

/**
 * Participant in an arena match
 */
export interface ArenaParticipant {
  id: string;
  matchId: string;
  configId: string;
  position: number; // 0-3
  finalScore: number;
  eloRatingBefore: number;
  eloRatingAfter: number;
  eloChange: number;
}

/**
 * Match result for ELO calculation
 */
export interface MatchResult {
  configId: string;
  position: number;
  finalScore: number;
}

/**
 * ELO rating update
 */
export interface EloUpdate {
  configId: string;
  oldRating: number;
  newRating: number;
  change: number;
}

/**
 * Arena statistics
 */
export interface ArenaStats {
  configId: string;
  name: string;
  eloRating: number;
  gamesPlayed: number;
  avgScore: number;
  winRate: number; // Percentage of games won (finished 1st)
}

/**
 * Request to run arena matches
 */
export interface RunMatchesRequest {
  configIds: string[]; // Exactly 4 config IDs
  numGames: number; // Number of games to run
}

/**
 * Match launcher options
 */
export interface MatchLauncherOptions {
  numGames: number; // How many games to run
  mode: 'manual' | 'elo'; // Manual selection or ELO-based pairing
  configIds?: string[]; // For manual mode (4 configs)
}
