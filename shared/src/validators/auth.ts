/**
 * @module validators/auth
 * @description Zod validation schemas for authentication
 * 
 * Validates authentication-related requests
 */

import { z } from 'zod';
import { PLAYER_NAME_MIN_LENGTH, PLAYER_NAME_MAX_LENGTH } from '../constants/rules';

/**
 * Validate JoinSessionRequest
 */
export const JoinSessionSchema = z.object({
  playerName: z
    .string()
    .min(PLAYER_NAME_MIN_LENGTH, `Player name must be at least ${PLAYER_NAME_MIN_LENGTH} characters`)
    .max(PLAYER_NAME_MAX_LENGTH, `Player name must be at most ${PLAYER_NAME_MAX_LENGTH} characters`)
    .trim()
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Player name can only contain letters, numbers, spaces, hyphens, and underscores')
});

/**
 * Export schema type for TypeScript inference
 */
export type JoinSessionInput = z.infer<typeof JoinSessionSchema>;
