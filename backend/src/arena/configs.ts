/**
 * Predefined AI configurations for the arena
 *
 * These configs define the AI contestants that will battle each other.
 * Each config specifies:
 * - provider: Which AI implementation to use
 * - difficulty: The difficulty level
 * - params: Custom parameters for fine-tuning behavior
 *
 * All configs start with an ELO rating of 1500 (standard chess rating).
 */

import type { AIDifficulty } from '../ai/types';

export interface PredefinedArenaConfig {
  id: string;
  name: string;
  provider: string;
  difficulty: AIDifficulty;
  params?: Record<string, any>;
}

/**
 * Arena AI configurations
 */
export const ARENA_CONFIGS: PredefinedArenaConfig[] = [
  // Rule-based AI
  {
    id: 'rule-easy',
    name: 'Rule-Based (Easy)',
    provider: 'rule-based',
    difficulty: 'easy',
  },
  {
    id: 'rule-medium',
    name: 'Rule-Based (Medium)',
    provider: 'rule-based',
    difficulty: 'medium',
  },

  // ISMCTS AI - Various difficulties
  {
    id: 'ismcts-easy',
    name: 'ISMCTS (Easy)',
    provider: 'ismcts',
    difficulty: 'easy',
  },
  {
    id: 'ismcts-medium',
    name: 'ISMCTS (Medium)',
    provider: 'ismcts',
    difficulty: 'medium',
  },
  {
    id: 'ismcts-hard',
    name: 'ISMCTS (Hard)',
    provider: 'ismcts',
    difficulty: 'hard',
  },
  {
    id: 'ismcts-expert',
    name: 'ISMCTS (Expert)',
    provider: 'ismcts',
    difficulty: 'expert',
  },

  // ISMCTS with custom exploration (more aggressive)
  {
    id: 'ismcts-hard-aggressive',
    name: 'ISMCTS Hard (Aggressive)',
    provider: 'ismcts',
    difficulty: 'hard',
    params: {
      explorationConstant: 2.0, // Default is usually around 1.41
    },
  },

  // ISMCTS with custom exploration (more conservative)
  {
    id: 'ismcts-hard-conservative',
    name: 'ISMCTS Hard (Conservative)',
    provider: 'ismcts',
    difficulty: 'hard',
    params: {
      explorationConstant: 0.7,
    },
  },

  // ISMCTS expert with different exploration values
  {
    id: 'ismcts-expert-aggressive',
    name: 'ISMCTS Expert (Aggressive)',
    provider: 'ismcts',
    difficulty: 'expert',
    params: {
      explorationConstant: 2.0,
    },
  },
  {
    id: 'ismcts-expert-conservative',
    name: 'ISMCTS Expert (Conservative)',
    provider: 'ismcts',
    difficulty: 'expert',
    params: {
      explorationConstant: 0.7,
    },
  },
];

/**
 * Default ELO rating for new configs
 */
export const DEFAULT_ELO_RATING = 1500;

/**
 * Get config by ID
 */
export function getArenaConfigById(id: string): PredefinedArenaConfig | undefined {
  return ARENA_CONFIGS.find((config) => config.id === id);
}

/**
 * Get all config IDs
 */
export function getAllConfigIds(): string[] {
  return ARENA_CONFIGS.map((config) => config.id);
}
