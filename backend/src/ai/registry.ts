/**
 * @module ai/registry
 * @description Registry for AI providers
 *
 * Provides a central place to register and retrieve AI implementations.
 * Makes it easy to swap between different AI strategies for testing,
 * difficulty levels, or experimentation.
 */

import {
  AIProvider,
  AIProviderFactory,
  AIProviderMetadata,
  AIConfig,
  AIDifficulty,
} from './types.js';

/**
 * Global registry of AI providers
 */
class AIRegistry {
  private providers: Map<string, AIProviderMetadata> = new Map();
  private defaultProviderId: string | null = null;

  /**
   * Register an AI provider
   *
   * @param metadata - Provider metadata
   * @throws Error if provider ID already exists
   */
  register(metadata: AIProviderMetadata): void {
    if (this.providers.has(metadata.id)) {
      throw new Error(`AI provider with id '${metadata.id}' already registered`);
    }

    console.log(`[AI Registry] Registered provider: ${metadata.id} (${metadata.name} v${metadata.version})`);
    this.providers.set(metadata.id, metadata);

    // Set first registered as default
    if (this.defaultProviderId === null) {
      this.defaultProviderId = metadata.id;
    }
  }

  /**
   * Unregister an AI provider
   *
   * @param id - Provider ID
   * @returns True if unregistered, false if not found
   */
  unregister(id: string): boolean {
    const deleted = this.providers.delete(id);

    if (deleted && this.defaultProviderId === id) {
      // Reset default to first available
      const firstId = Array.from(this.providers.keys())[0];
      this.defaultProviderId = firstId || null;
    }

    return deleted;
  }

  /**
   * Get metadata for a provider
   *
   * @param id - Provider ID
   * @returns Provider metadata or undefined
   */
  getMetadata(id: string): AIProviderMetadata | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   *
   * @returns Array of provider metadata
   */
  getAllProviders(): AIProviderMetadata[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that support a specific difficulty
   *
   * @param difficulty - Difficulty level
   * @returns Array of provider metadata
   */
  getProvidersForDifficulty(difficulty: AIDifficulty): AIProviderMetadata[] {
    return this.getAllProviders().filter(p =>
      p.supportedDifficulties.includes(difficulty)
    );
  }

  /**
   * Set the default provider
   *
   * @param id - Provider ID
   * @throws Error if provider not found
   */
  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`AI provider '${id}' not found`);
    }

    this.defaultProviderId = id;
    console.log(`[AI Registry] Set default provider: ${id}`);
  }

  /**
   * Get the default provider ID
   *
   * @returns Default provider ID or null if none registered
   */
  getDefaultId(): string | null {
    return this.defaultProviderId;
  }

  /**
   * Create an AI provider instance
   *
   * @param id - Provider ID (uses default if not specified)
   * @param config - AI configuration
   * @returns AI provider instance
   * @throws Error if provider not found
   */
  async create(id: string | null, config: AIConfig): Promise<AIProvider> {
    const providerId = id || this.defaultProviderId;

    if (!providerId) {
      throw new Error('No AI provider specified and no default set');
    }

    const metadata = this.providers.get(providerId);
    if (!metadata) {
      throw new Error(`AI provider '${providerId}' not found`);
    }

    console.log(
      `[AI Registry] Creating provider: ${providerId} (difficulty: ${config.difficulty})`
    );

    const provider = await metadata.factory(config);

    // Initialize if needed
    if (provider.initialize) {
      await provider.initialize(config);
    }

    return provider;
  }

  /**
   * Create a provider for a specific difficulty level
   *
   * Uses the first registered provider that supports the difficulty.
   * You can override by specifying a provider ID.
   *
   * @param difficulty - Difficulty level
   * @param providerId - Optional specific provider ID
   * @param params - Optional additional parameters
   * @returns AI provider instance
   * @throws Error if no provider supports the difficulty
   */
  async createForDifficulty(
    difficulty: AIDifficulty,
    providerId?: string,
    params?: Record<string, any>
  ): Promise<AIProvider> {
    let id = providerId;

    if (!id) {
      // Find first provider that supports this difficulty
      const compatible = this.getProvidersForDifficulty(difficulty);
      if (compatible.length === 0) {
        throw new Error(`No AI provider supports difficulty '${difficulty}'`);
      }
      id = compatible[0].id;
    }

    return this.create(id, { difficulty, params });
  }

  /**
   * Check if a provider exists
   *
   * @param id - Provider ID
   * @returns True if registered
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Clear all providers (mainly for testing)
   */
  clear(): void {
    this.providers.clear();
    this.defaultProviderId = null;
  }

  /**
   * Get registry statistics
   *
   * @returns Stats about registered providers
   */
  getStats(): {
    totalProviders: number;
    defaultProvider: string | null;
    providersByDifficulty: Record<AIDifficulty, number>;
  } {
    const providersByDifficulty: Record<AIDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    };

    for (const provider of this.providers.values()) {
      for (const difficulty of provider.supportedDifficulties) {
        providersByDifficulty[difficulty]++;
      }
    }

    return {
      totalProviders: this.providers.size,
      defaultProvider: this.defaultProviderId,
      providersByDifficulty,
    };
  }
}

/**
 * Singleton instance of the AI registry
 */
export const aiRegistry = new AIRegistry();

/**
 * Convenience function to register an AI provider
 */
export function registerAIProvider(metadata: AIProviderMetadata): void {
  aiRegistry.register(metadata);
}

/**
 * Convenience function to create an AI provider
 */
export async function createAI(
  difficulty: AIDifficulty,
  providerId?: string,
  params?: Record<string, any>
): Promise<AIProvider> {
  return aiRegistry.createForDifficulty(difficulty, providerId, params);
}
