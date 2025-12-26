/**
 * @module shared
 * @description Shared types, constants, and validators for Buck Euchre
 * 
 * This module is imported by both frontend and backend.
 * All types must be serializable (no functions, DOM types, etc.)
 */

// Export all types
export * from './types';

// Export all constants
export * from './constants';

// Export all validators
export * from './validators';

// Export shared utilities
export * from './utils';

// Export shared pure game logic (used by both backend + frontend)
export * from './game';

// Export shared AI (ISMCTS + analysis helpers)
export * from './ai';
