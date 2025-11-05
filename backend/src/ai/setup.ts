/**
 * @module ai/setup
 * @description Setup and register all AI providers
 *
 * This module should be called once during server initialization
 * to register all available AI providers.
 */

import { aiRegistry } from './registry';
import { RuleBasedAIMetadata } from './providers/rule-based';

/**
 * Register all available AI providers
 *
 * Call this once during server startup.
 */
export function setupAIProviders(): void {
  console.log('[AI] Setting up AI providers...');

  // Register rule-based AI (baseline)
  aiRegistry.register(RuleBasedAIMetadata);

  // TODO: Register additional providers as they're implemented
  // aiRegistry.register(PIMCAIMetadata);
  // aiRegistry.register(ISMCTSAIMetadata);
  // aiRegistry.register(NeuralAIMetadata);

  // Set default provider
  aiRegistry.setDefault('rule-based');

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
  // For now, use rule-based for all difficulties
  // Later, you can customize this:
  //
  // switch (difficulty) {
  //   case 'easy':
  //     return 'rule-based';
  //   case 'medium':
  //     return 'pimc';
  //   case 'hard':
  //     return 'ismcts';
  //   case 'expert':
  //     return 'neural';
  //   default:
  //     return undefined;
  // }

  return 'rule-based';
}
