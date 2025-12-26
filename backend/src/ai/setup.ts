/**
 * @module ai/setup
 * @description Setup and register all AI providers
 *
 * This module should be called once during server initialization
 * to register all available AI providers.
 */

import { aiRegistry } from './registry.js';
import { RuleBasedAIMetadata } from './providers/rule-based.js';
import { ISMCTSAIMetadata } from './providers/ismcts.js';

/**
 * Register all available AI providers
 *
 * Call this once during server startup.
 */
export function setupAIProviders(): void {
  console.log('[AI] Setting up AI providers...');

  // Register rule-based AI (baseline, easy-medium difficulty)
  aiRegistry.register(RuleBasedAIMetadata);

  // Register ISMCTS AI (medium-expert difficulty)
  aiRegistry.register(ISMCTSAIMetadata);

  // TODO: Register additional providers as they're implemented
  // aiRegistry.register(PIMCAIMetadata);
  // aiRegistry.register(NeuralAIMetadata);

  // Set default provider to ISMCTS (stronger AI)
  aiRegistry.setDefault('ismcts');

  // Log stats
  const stats = aiRegistry.getStats();
  console.log('[AI] Setup complete:');
  console.log(`  - Total providers: ${stats.totalProviders}`);
  console.log(`  - Default provider: ${stats.defaultProvider}`);
  console.log(`  - Providers by difficulty:`, stats.providersByDifficulty);
}

/**
 * Get the appropriate provider ID for a difficulty level
 *
 * This function maps difficulty levels to specific AI providers.
 * Can be customized to use different AIs for different difficulties.
 *
 * @param difficulty - Difficulty level
 * @returns Provider ID to use
 */
export function getProviderForDifficulty(difficulty: string): string | undefined {
  switch (difficulty) {
    case 'easy':
      return 'rule-based'; // Fast, simple heuristics
    case 'medium':
      return 'ismcts'; // 500 simulations
    case 'hard':
      return 'ismcts'; // 2000 simulations
    case 'expert':
      return 'ismcts'; // 5000 simulations
    default:
      return 'ismcts'; // Default to ISMCTS
  }
}
