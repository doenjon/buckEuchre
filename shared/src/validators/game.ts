/**
 * @module validators/game
 * @description Zod validation schemas for game actions
 * 
 * Validates WebSocket event payloads for game actions
 */

import { z } from 'zod';

/**
 * UUID format validation
 */
const uuidSchema = z.string().uuid('Invalid game ID format');

/**
 * Card ID format validation (e.g., "HEARTS_ACE")
 */
const cardIdSchema = z.string().regex(
  /^(SPADES|HEARTS|DIAMONDS|CLUBS)_(9|10|JACK|QUEEN|KING|ACE)$/,
  'Invalid card ID format'
);

/**
 * Suit validation
 */
const suitSchema = z.enum(['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS']);

/**
 * Bid amount validation
 */
const bidAmountSchema = z.union([
  z.literal('PASS'),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);

/**
 * Validate JoinGamePayload
 */
export const JoinGameSchema = z.object({
  gameId: uuidSchema
});

/**
 * Validate LeaveGamePayload
 */
export const LeaveGameSchema = z.object({
  gameId: uuidSchema
});

/**
 * Validate PlaceBidPayload
 */
export const PlaceBidSchema = z.object({
  gameId: uuidSchema,
  amount: bidAmountSchema
});

/**
 * Validate DeclareTrumpPayload
 */
export const DeclareTrumpSchema = z.object({
  gameId: uuidSchema,
  trumpSuit: suitSchema
});

/**
 * Validate FoldDecisionPayload
 */
export const FoldDecisionSchema = z.object({
  gameId: uuidSchema,
  folded: z.boolean()
});

/**
 * Validate PlayCardPayload
 */
export const PlayCardSchema = z.object({
  gameId: uuidSchema,
  cardId: cardIdSchema
});

/**
 * Validate StartNextRoundPayload
 */
export const StartNextRoundSchema = z.object({
  gameId: uuidSchema
});

/**
 * Validate RequestStatePayload
 */
export const RequestStateSchema = z.object({
  gameId: uuidSchema
});

/**
 * Export schema types for TypeScript inference
 */
export type JoinGameInput = z.infer<typeof JoinGameSchema>;
export type LeaveGameInput = z.infer<typeof LeaveGameSchema>;
export type PlaceBidInput = z.infer<typeof PlaceBidSchema>;
export type DeclareTrumpInput = z.infer<typeof DeclareTrumpSchema>;
export type FoldDecisionInput = z.infer<typeof FoldDecisionSchema>;
export type PlayCardInput = z.infer<typeof PlayCardSchema>;
export type StartNextRoundInput = z.infer<typeof StartNextRoundSchema>;
export type RequestStateInput = z.infer<typeof RequestStateSchema>;
