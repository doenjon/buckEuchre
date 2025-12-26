import { Server, Socket } from 'socket.io';
import { authenticateSocket } from './middleware.js';
import { registerGameHandlers } from './game.js';
import { 
  registerConnection, 
  handleDisconnect, 
  handleReconnect,
  isPlayerConnected 
} from '../services/connection.service.js';

/**
 * Initialize WebSocket connection handling
 * Sets up authentication middleware and connection/disconnection handlers
 */
export function handleConnection(io: Server): void {
  // Apply authentication middleware
  io.use(authenticateSocket);

  // Handle middleware errors (authentication failures)
  io.engine.on('connection_error', (err) => {
    console.error('[Socket] Connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  // Handle new connections
  io.on('connection', (socket: Socket) => {
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;

    console.log(`[Socket] ✓ Player connected: ${playerName} (${playerId})`);

    // Check if this is a reconnection
    const wasConnected = isPlayerConnected(playerId);

    // Register this connection
    registerConnection(socket, playerId);

    if (wasConnected) {
      // Handle reconnection
      console.log(`[Socket] Player ${playerName} is reconnecting`);
      handleReconnect(socket, playerId, io);
    }

    // Register game event handlers
    registerGameHandlers(io, socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Player disconnected: ${playerName} (${playerId}) - Reason: ${reason}`);

      // Handle disconnect with grace period
      handleDisconnect(playerId, io);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`[Socket] Error for player ${playerName}:`, error);
    });
  });

  console.log('[Socket] WebSocket server initialized');
}
