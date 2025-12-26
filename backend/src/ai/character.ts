/**
 * @module ai/character
 * @description AI character presets for varied play styles
 *
 * Characters affect how AI players make decisions:
 * - Bidding aggressiveness
 * - Risk-taking in card play
 * - Fold thresholds
 */

import type { AICharacter } from './ismcts/ismcts-engine.js';

/**
 * Character preset definitions
 */
export const AI_CHARACTERS = {
  /** Balanced, standard play style */
  balanced: {
    biddingAggressiveness: 1.0,
    riskTaking: 1.0,
    foldThreshold: 1.0,
  } as AICharacter,

  /** Aggressive bidding, takes risks */
  aggressive: {
    biddingAggressiveness: 1.5,
    riskTaking: 1.3,
    foldThreshold: 1.2, // Folds less (stays more)
  } as AICharacter,

  /** Conservative, safe play */
  conservative: {
    biddingAggressiveness: 0.7,
    riskTaking: 0.7,
    foldThreshold: 0.8, // Folds more (stays less)
  } as AICharacter,

  /** Very aggressive, high risk */
  risky: {
    biddingAggressiveness: 1.8,
    riskTaking: 1.6,
    foldThreshold: 1.4,
  } as AICharacter,

  /** Very conservative, very safe */
  cautious: {
    biddingAggressiveness: 0.5,
    riskTaking: 0.5,
    foldThreshold: 0.6,
  } as AICharacter,
} as const;

/**
 * Get a character preset by name
 *
 * @param name - Character preset name
 * @returns Character configuration, or balanced if not found
 */
export function getCharacterPreset(name: string): AICharacter {
  const preset = AI_CHARACTERS[name as keyof typeof AI_CHARACTERS];
  return preset || AI_CHARACTERS.balanced;
}

/**
 * Get a random character preset
 *
 * @returns Random character configuration
 */
export function getRandomCharacter(): AICharacter {
  const names = Object.keys(AI_CHARACTERS);
  const randomName = names[Math.floor(Math.random() * names.length)];
  return AI_CHARACTERS[randomName as keyof typeof AI_CHARACTERS];
}

/**
 * Character preset names
 */
export type CharacterPresetName = keyof typeof AI_CHARACTERS;

