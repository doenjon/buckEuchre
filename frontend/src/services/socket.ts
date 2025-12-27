/**
 * @module services/socket
 * @description WebSocket client for real-time game updates
 */

import { io, Socket } from 'socket.io-client';
import type { 
  JoinGamePayload,
  PlaceBidPayload,
  DeclareTrumpPayload,
  FoldDecisionPayload,
  PlayCardPayload,
  StartNextRoundPayload
} from '@buck-euchre/shared';

// WebSocket URL - defaults to same origin as the page
// For local dev outside Docker, set VITE_WS_URL=http://localhost:3000
// For production, this will use the same origin (empty string = relative URL)
const WS_URL = import.meta.env.VITE_WS_URL || '';

/**
 * Create a new socket connection with authentication
 */
export function createSocketConnection(token: string): Socket {
  console.log('[Socket] Creating connection:', {
    url: WS_URL,
    hasToken: !!token,
    tokenLength: token?.length || 0,
  });

  const socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Log connection attempts
  socket.io.on('error', (error) => {
    console.error('[Socket.io] Engine error:', error);
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log(`[Socket.io] Reconnection attempt ${attempt}`);
  });

  socket.io.on('reconnect_failed', () => {
    console.error('[Socket.io] Reconnection failed after all attempts');
  });

  return socket;
}

/**
 * Emit JOIN_GAME event
 */
export function emitJoinGame(socket: Socket, payload: JoinGamePayload): void {
  socket.emit('JOIN_GAME', payload);
}

/**
 * Emit LEAVE_GAME event
 */
export function emitLeaveGame(socket: Socket, gameId: string): void {
  socket.emit('LEAVE_GAME', { gameId });
}

/**
 * Emit PLACE_BID event
 */
export function emitPlaceBid(socket: Socket, payload: PlaceBidPayload): void {
  socket.emit('PLACE_BID', payload);
}

/**
 * Emit DECLARE_TRUMP event
 */
export function emitDeclareTrump(socket: Socket, payload: DeclareTrumpPayload): void {
  socket.emit('DECLARE_TRUMP', payload);
}

/**
 * Emit FOLD_DECISION event
 */
export function emitFoldDecision(socket: Socket, payload: FoldDecisionPayload): void {
  socket.emit('FOLD_DECISION', payload);
}

/**
 * Emit PLAY_CARD event
 */
export function emitPlayCard(socket: Socket, payload: PlayCardPayload): void {
  socket.emit('PLAY_CARD', payload);
}

/**
 * Emit START_NEXT_ROUND event
 */
export function emitStartNextRound(socket: Socket, payload: StartNextRoundPayload): void {
  socket.emit('START_NEXT_ROUND', payload);
}

/**
 * Request fresh game state (used when version mismatch detected)
 */
export function emitRequestState(socket: Socket, gameId: string): void {
  socket.emit('REQUEST_STATE', { gameId });
}

/**
 * Setup common socket event listeners
 */
export function setupSocketListeners(
  socket: Socket,
  handlers: {
    onConnect?: () => void;
    onDisconnect?: (reason: string) => void;
    onError?: (error: any) => void;
    onConnectError?: (error: any) => void;
    onGameStateUpdate?: (data: any) => void;
    onGameWaiting?: (data: any) => void;
    onReconnected?: (data: any) => void;
    onPlayerConnected?: (data: any) => void;
    onPlayerDisconnected?: (data: any) => void;
    onPlayerReconnected?: (data: any) => void;
    onTrickComplete?: (data: any) => void;
    onRoundComplete?: (data: any) => void;
    onAllPlayersPassed?: (data: any) => void;
    onAIAnalysisUpdate?: (data: any) => void;
  }
): void {
  if (handlers.onConnect) {
    socket.on('connect', handlers.onConnect);
  }

  if (handlers.onDisconnect) {
    socket.on('disconnect', handlers.onDisconnect);
  }

  if (handlers.onError) {
    socket.on('ERROR', handlers.onError);
  }

  if (handlers.onConnectError) {
    socket.on('connect_error', handlers.onConnectError);
  }
  
  if (handlers.onGameStateUpdate) {
    socket.on('GAME_STATE_UPDATE', handlers.onGameStateUpdate);
  }

  if (handlers.onGameWaiting) {
    socket.on('GAME_WAITING', handlers.onGameWaiting);
  }
  
  if (handlers.onReconnected) {
    socket.on('RECONNECTED', handlers.onReconnected);
  }
  
  if (handlers.onPlayerConnected) {
    socket.on('PLAYER_CONNECTED', handlers.onPlayerConnected);
  }
  
  if (handlers.onPlayerDisconnected) {
    socket.on('PLAYER_DISCONNECTED', handlers.onPlayerDisconnected);
  }
  
  if (handlers.onPlayerReconnected) {
    socket.on('PLAYER_RECONNECTED', handlers.onPlayerReconnected);
  }
  
  if (handlers.onTrickComplete) {
    socket.on('TRICK_COMPLETE', handlers.onTrickComplete);
  }
  
  if (handlers.onRoundComplete) {
    socket.on('ROUND_COMPLETE', handlers.onRoundComplete);
  }
  
  if (handlers.onAllPlayersPassed) {
    socket.on('ALL_PLAYERS_PASSED', handlers.onAllPlayersPassed);
  }

  if (handlers.onAIAnalysisUpdate) {
    socket.on('AI_ANALYSIS_UPDATE', handlers.onAIAnalysisUpdate);
  }
}

/**
 * Cleanup socket listeners
 */
export function cleanupSocketListeners(socket: Socket): void {
  socket.off('connect');
  socket.off('disconnect');
  socket.off('ERROR');
  socket.off('connect_error');
  socket.off('GAME_STATE_UPDATE');
  socket.off('GAME_WAITING');
  socket.off('RECONNECTED');
  socket.off('PLAYER_CONNECTED');
  socket.off('PLAYER_DISCONNECTED');
  socket.off('PLAYER_RECONNECTED');
  socket.off('TRICK_COMPLETE');
  socket.off('ROUND_COMPLETE');
  socket.off('ALL_PLAYERS_PASSED');
  socket.off('AI_ANALYSIS_UPDATE');
}
