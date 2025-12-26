/**
 * @module ai
 * @description AI system exports
 *
 * This module provides a plugin-based AI system that allows different
 * AI implementations to be easily swapped and tested.
 */

// Core types
export * from './types.js';

// Registry system
export * from './registry.js';
export * from './provider-cache.js';

// Setup and configuration
export * from './setup.js';

// Provider implementations
export * from './providers/index.js';

// Execution infrastructure (existing)
export * from './executor.js';
export * from './trigger.js';
