/**
 * @module services/connection
 * @description Track player connections and handle disconnections/reconnections
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { executeGameAction, getActiveGameState } from './state.service';
import { applyFoldDecision } from '@buck-euchre/shared/game/state';
import type { PlayerPosition } from '@buck-euchre/shared/types/game';

/**
 * Player connection information
 */
interface PlayerConnection {
  playerId: string;
  socketId: string;
  gameId: string | null;
  connectedAt: Date;
  lastSeenAt: Date;
}

/**
 * Disconnection timer tracking
 */
interface DisconnectionTimer {
  playerId: string;
  gameId: string;
  timer: NodeJS.Timeout;
}

// In-memory connection tracking
const activeConnections = new Map<string, PlayerConnection>();
const disconnectionTimers = new Map<string, DisconnectionTimer>();

// Grace period before marking player as disconnected (30 seconds)
const DISCONNECT_GRACE_PERIOD_MS = 30000;

/**
 * Register a new player connection
 */
export function registerConnection(
  socket: Socket,
  playerId: string,
  gameId: string | null = null
): void {
  const connection: PlayerConnection = {
    playerId,
    socketId: socket.id,
    gameId,
    connectedAt: new Date(),
    lastSeenAt: new Date(),
  };

  activeConnections.set(playerId, connection);
  console.log(`Player ${playerId} connected (socket: ${socket.id})`);

  // If player was disconnecting, cancel the timer
  if (disconnectionTimers.has(playerId)) {
    const timer = disconnectionTimers.get(playerId)!;
    clearTimeout(timer.timer);
    disconnectionTimers.delete(playerId);
    console.log(`Cancelled disconnect timer for player ${playerId}`);
  }
}

/**
 * Update player's game association
 */
export function updateConnectionGame(playerId: string, gameId: string | null): void {
  const connection = activeConnections.get(playerId);
  if (connection) {
    connection.gameId = gameId;
    connection.lastSeenAt = new Date();
  }
}

/**
 * Get player connection
 */
export function getConnection(playerId: string): PlayerConnection | undefined {
  return activeConnections.get(playerId);
}

/**
 * Check if player is connected
 */
export function isPlayerConnected(playerId: string): boolean {
  return activeConnections.has(playerId);
}

/**
 * Get player's current game ID
 */
export function getPlayerGameId(playerId: string): string | null {
  const connection = activeConnections.get(playerId);
  return connection?.gameId || null;
}

/**
 * Get all connected player IDs for a given game
 */
export function getConnectedPlayersInGame(gameId: string): string[] {
  const players: string[] = [];
  for (const connection of activeConnections.values()) {
    if (connection.gameId === gameId) {
      players.push(connection.playerId);
    }
  }
  return players;
}

/**
 * Handle player disconnect with grace period
 */
export function handleDisconnect(
  playerId: string,
  io: SocketIOServer
): void {
  const connection = activeConnections.get(playerId);
  
  if (!connection) {
    console.log(`Player ${playerId} disconnect - no connection found`);
    return;
  }

  console.log(`Player ${playerId} disconnected - starting ${DISCONNECT_GRACE_PERIOD_MS}ms grace period`);

  // Remove from active connections immediately
  activeConnections.delete(playerId);

  // If player is in a game, start grace period
  if (connection.gameId) {
    const timer = setTimeout(() => {
      handleGracePeriodExpired(playerId, connection.gameId!, io);
    }, DISCONNECT_GRACE_PERIOD_MS);

    disconnectionTimers.set(playerId, {
      playerId,
      gameId: connection.gameId,
      timer,
    });
  }
}

/**
 * Handle grace period expiration
 */
function handleGracePeriodExpired(
  playerId: string,
  gameId: string,
  io: SocketIOServer
): void {
  // Check if player reconnected during grace period
  if (isPlayerConnected(playerId)) {
    console.log(`Player ${playerId} reconnected before grace period expired`);
    disconnectionTimers.delete(playerId);
    return;
  }

  console.log(`Grace period expired for player ${playerId} in game ${gameId}`);

  // Get game state to find player position
  const gameState = getActiveGameState(gameId);
  if (!gameState) {
    disconnectionTimers.delete(playerId);
    return;
  }

  // Find player position
  const playerPosition = gameState.players.findIndex(p => p.id === playerId);
  if (playerPosition === -1) {
    disconnectionTimers.delete(playerId);
    return;
  }

  const player = gameState.players[playerPosition];

  // Auto-forfeit if player needs to make a decision
  let updatedState = gameState;
  let autoAction = false;

  if (gameState.phase === 'FOLDING_DECISION' && player.foldDecision === 'UNDECIDED') {
    // Automatically fold the disconnected player
    console.log(`Auto-folding disconnected player ${playerId} (position ${playerPosition})`);
    try {
      // Serialize through the per-game action queue to avoid races with gameplay events.
      // NOTE: This function isn't async; we fire-and-forget but log errors.
      void executeGameAction(gameId, (currentState) => {
        return applyFoldDecision(currentState, playerPosition as PlayerPosition, true);
      }).then((newState) => {
        updatedState = newState;
      autoAction = true;

      // Emit game state update to all players
      io.to(`game:${gameId}`).emit('GAME_STATE', updatedState);
      }).catch((error) => {
        console.error(`Error auto-folding disconnected player ${playerId}:`, error);
      });
    } catch (error) {
      console.error(`Error auto-folding disconnected player ${playerId}:`, error);
    }
  }

  // Notify other players that this player has disconnected
  io.to(`game:${gameId}`).emit('PLAYER_DISCONNECTED', {
    playerId,
    position: playerPosition,
    playerName: player.name,
    autoFolded: autoAction,
  });

  disconnectionTimers.delete(playerId);
}

/**
 * Handle player reconnection
 */
export function handleReconnect(
  socket: Socket,
  playerId: string,
  io: SocketIOServer
): void {
  console.log(`Player ${playerId} attempting reconnection (socket: ${socket.id})`);

  // Get previous connection info
  const oldGameId = getPlayerGameId(playerId);

  // Register new connection
  registerConnection(socket, playerId, oldGameId);

  // If player was in a game, rejoin and sync state
  if (oldGameId) {
    socket.join(`game:${oldGameId}`);

    const gameState = getActiveGameState(oldGameId);
    if (gameState) {
      console.log(`Player ${playerId} rejoined game ${oldGameId}`);
      
      // Send current game state to reconnected player
      socket.emit('RECONNECTED', { gameState });

      // Find player position
      const playerPosition = gameState.players.findIndex(p => p.id === playerId);
      
      // Notify other players that this player reconnected
      io.to(`game:${oldGameId}`).emit('PLAYER_RECONNECTED', {
        playerId,
        position: playerPosition,
        playerName: gameState.players[playerPosition]?.name || 'Unknown',
      });
    }
  } else {
    console.log(`Player ${playerId} reconnected but was not in a game`);
  }
}

/**
 * Get all connections for a game
 */
export function getGameConnections(gameId: string): PlayerConnection[] {
  const connections: PlayerConnection[] = [];
  
  for (const connection of activeConnections.values()) {
    if (connection.gameId === gameId) {
      connections.push(connection);
    }
  }
  
  return connections;
}

/**
 * Clear all connections (for testing)
 */
export function clearAllConnections(): void {
  // Clear all disconnection timers
  for (const timer of disconnectionTimers.values()) {
    clearTimeout(timer.timer);
  }
  
  disconnectionTimers.clear();
  activeConnections.clear();
}

/**
 * Get connection statistics
 */
export function getConnectionStats(): {
  totalConnections: number;
  pendingDisconnects: number;
  connectionsInGame: number;
} {
  let connectionsInGame = 0;
  
  for (const connection of activeConnections.values()) {
    if (connection.gameId) {
      connectionsInGame++;
    }
  }
  
  return {
    totalConnections: activeConnections.size,
    pendingDisconnects: disconnectionTimers.size,
    connectionsInGame,
  };
}
