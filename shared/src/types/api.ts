/**
 * @module types/api
 * @description API request/response type definitions
 * 
 * Defines types for:
 * - REST API endpoints
 * - WebSocket event payloads
 * - Request/response structures
 */

import { ClientGameState, GameSummary, BidAmount, Suit, PlayerPosition, GameState } from './game';

// ============================================================================
// Authentication API Types
// ============================================================================

/**
 * Request to join a session (create player)
 */
export interface JoinSessionRequest {
  playerName: string;  // 2-20 characters
}

/**
 * Response after joining session
 */
export interface JoinSessionResponse {
  userId: string;
  username: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  token: string;  // JWT token for authentication
  expiresAt: number;  // Unix timestamp
  isGuest: boolean;  // Indicates if the session was created for a guest user
  // Legacy fields for backward compatibility
  playerId?: string;
  playerName?: string;
}

// ============================================================================
// Game API Types (REST)
// ============================================================================

/**
 * Request to create a new game
 */
export interface CreateGameRequest {
  // No parameters needed - uses authenticated player as creator
}

/**
 * Response after creating a game
 */
export interface CreateGameResponse {
  gameId: string;
  createdAt: number;
}

/**
 * Response for list games endpoint
 */
export interface ListGamesResponse {
  games: GameSummary[];
}

/**
 * Response for get game state endpoint
 */
export interface GetGameStateResponse {
  gameState: ClientGameState;
}

/**
 * Response after adding an AI player to a game
 */
export interface AddAIPlayerResponse {
  success: boolean;
  message: string;
  gameStarted: boolean;
  gameState?: GameState;
  playerCount?: number;
  playersNeeded?: number;
  waitingMessage?: string;
}

// ============================================================================
// WebSocket Event Payloads (Client → Server)
// ============================================================================

/**
 * Join a game
 */
export interface JoinGamePayload {
  gameId: string;
}

/**
 * Leave a game
 */
export interface LeaveGamePayload {
  gameId: string;
}

/**
 * Place a bid
 */
export interface PlaceBidPayload {
  gameId: string;
  amount: BidAmount;
}

/**
 * Declare trump suit (winning bidder only)
 */
export interface DeclareTrumpPayload {
  gameId: string;
  trumpSuit: Suit;
}

/**
 * Make fold decision (non-bidders only)
 */
export interface FoldDecisionPayload {
  gameId: string;
  folded: boolean;  // true to fold, false to stay in
}

/**
 * Play a card
 */
export interface PlayCardPayload {
  gameId: string;
  cardId: string;  // e.g., "HEARTS_ACE"
}

/**
 * Start next round (after scoring)
 */
export interface StartNextRoundPayload {
  gameId: string;
}

// ============================================================================
// WebSocket Event Payloads (Server → Client)
// ============================================================================

/**
 * Game state update event
 */
export interface GameStateUpdateEvent {
  gameState: ClientGameState;
  event: GameEventType;
}

/**
 * Types of game events
 */
export type GameEventType =
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'CARDS_DEALT'
  | 'TURN_UP_REVEALED'
  | 'BID_PLACED'
  | 'TRUMP_DECLARED'
  | 'FOLD_DECISION_MADE'
  | 'CARD_PLAYED'
  | 'TRICK_COMPLETE'
  | 'ROUND_COMPLETE'
  | 'GAME_OVER';

/**
 * Player connection status update
 */
export interface PlayerConnectionEvent {
  playerId: string;
  playerPosition: PlayerPosition;
  connected: boolean;
}

/**
 * Player disconnected event
 */
export interface PlayerDisconnectedEvent {
  playerId: string;
  playerPosition: PlayerPosition;
}

/**
 * Player reconnected event
 */
export interface PlayerReconnectedEvent {
  playerId: string;
  playerPosition: PlayerPosition;
}

/**
 * Reconnection response (sent to reconnecting player)
 */
export interface ReconnectedEvent {
  gameState: ClientGameState;
}

/**
 * AI analysis for a single card
 */
export interface CardAnalysis {
  cardId: string;
  winProbability: number;  // 0-1 probability of winning the game if this card is played
  expectedTricks: number;  // Expected number of tricks if this card is played
  confidence: number;  // 0-1 confidence in the analysis
  visits: number;  // Number of MCTS simulations that explored this card
  rank: number;  // Rank among all cards (1 = best)
}

/**
 * AI analysis for a bid decision
 */
export interface BidAnalysis {
  bidAmount: BidAmount;
  winProbability: number;  // 0-1 probability of winning the game with this bid
  expectedScore: number;  // Expected score change if making this bid
  confidence: number;  // 0-1 confidence in the analysis
  visits: number;  // Number of MCTS simulations that explored this bid
  rank: number;  // Rank among all bid options (1 = best)
}

/**
 * AI analysis for a fold decision
 */
export interface FoldAnalysis {
  fold: boolean;  // true for fold, false for stay
  winProbability: number;  // 0-1 probability of winning the game with this choice
  expectedScore: number;  // Expected score change with this choice
  confidence: number;  // 0-1 confidence in the analysis
  visits: number;  // Number of MCTS simulations that explored this choice
  isBest: boolean;  // Whether this is the recommended action
}

/**
 * AI analysis update event (sent when it's a human player's turn)
 */
export interface AIAnalysisEvent {
  playerPosition: PlayerPosition;
  analysisType: 'card' | 'bid' | 'fold';
  cards?: CardAnalysis[];  // For card play decisions
  bids?: BidAnalysis[];  // For bidding decisions
  foldOptions?: FoldAnalysis[];  // For fold decisions (fold vs stay)
  totalSimulations: number;
  bestCardId?: string;  // For card play
  bestBid?: BidAmount;  // For bidding
  bestFoldDecision?: boolean;  // For fold decisions
}

/**
 * Error event
 */
export interface ErrorEvent {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// WebSocket Event Names (for type safety)
// ============================================================================

/**
 * Client → Server events
 */
export const CLIENT_EVENTS = {
  JOIN_GAME: 'JOIN_GAME',
  LEAVE_GAME: 'LEAVE_GAME',
  PLACE_BID: 'PLACE_BID',
  DECLARE_TRUMP: 'DECLARE_TRUMP',
  FOLD_DECISION: 'FOLD_DECISION',
  PLAY_CARD: 'PLAY_CARD',
  START_NEXT_ROUND: 'START_NEXT_ROUND',
  REQUEST_STATE: 'REQUEST_STATE'
} as const;

/**
 * Server → Client events
 */
export const SERVER_EVENTS = {
  GAME_STATE_UPDATE: 'GAME_STATE_UPDATE',
  PLAYER_DISCONNECTED: 'PLAYER_DISCONNECTED',
  PLAYER_RECONNECTED: 'PLAYER_RECONNECTED',
  RECONNECTED: 'RECONNECTED',
  AI_ANALYSIS_UPDATE: 'AI_ANALYSIS_UPDATE',
  ERROR: 'ERROR'
} as const;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Generic API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}
