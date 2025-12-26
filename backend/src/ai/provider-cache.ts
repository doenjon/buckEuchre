/**
 * @module ai/provider-cache
 * @description Cache AI providers for players
 *
 * Avoids recreating AI provider instances on every decision.
 * Maps player IDs to their AI providers.
 */

import { AIProvider, AIConfig, AIDifficulty } from './types.js';
import { aiRegistry } from './registry.js';

/**
 * Cache of AI providers by player ID
 */
class AIProviderCache {
  private cache: Map<string, AIProvider> = new Map();
  private configs: Map<string, AIConfig> = new Map();

  /**
   * Get or create an AI provider for a player
   *
   * @param playerId - Player ID
   * @param difficulty - Difficulty level (defaults to 'medium')
   * @param providerId - Specific provider ID (optional)
   * @returns AI provider instance
   */
  async getProvider(
    playerId: string,
    difficulty: AIDifficulty = 'medium',
    providerId?: string
  ): Promise<AIProvider> {
    // Check if we already have a provider for this player
    let provider = this.cache.get(playerId);

    if (provider) {
      // Check if config changed
      const oldConfig = this.configs.get(playerId);
      if (oldConfig && oldConfig.difficulty === difficulty) {
        return provider; // Config unchanged, return cached
      }

      // Config changed, cleanup old provider
      await this.removeProvider(playerId);
    }

    // Create new provider
    const config: AIConfig = { difficulty };
    provider = await aiRegistry.createForDifficulty(difficulty, providerId);

    // Cache it
    this.cache.set(playerId, provider);
    this.configs.set(playerId, config);

    console.log(`[AI Cache] Created provider for player ${playerId} (difficulty: ${difficulty})`);

    return provider;
  }

  /**
   * Remove a provider from the cache
   *
   * @param playerId - Player ID
   */
  async removeProvider(playerId: string): Promise<void> {
    const provider = this.cache.get(playerId);

    if (provider) {
      // Cleanup if supported
      if (provider.cleanup) {
        await provider.cleanup();
      }

      this.cache.delete(playerId);
      this.configs.delete(playerId);

      console.log(`[AI Cache] Removed provider for player ${playerId}`);
    }
  }

  /**
   * Clear all cached providers
   */
  async clearAll(): Promise<void> {
    const playerIds = Array.from(this.cache.keys());

    for (const playerId of playerIds) {
      await this.removeProvider(playerId);
    }

    console.log(`[AI Cache] Cleared all providers`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cachedPlayers: number;
    playerIds: string[];
  } {
    return {
      cachedPlayers: this.cache.size,
      playerIds: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Singleton instance of the provider cache
 */
export const aiProviderCache = new AIProviderCache();
