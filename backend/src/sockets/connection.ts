import { Server, Socket } from 'socket.io';
import { authenticateSocket } from './middleware';
import { registerGameHandlers } from './game';

/**
 * Initialize WebSocket connection handling
 * Sets up authentication middleware and connection/disconnection handlers
 */
export function handleConnection(io: Server): void {
  // Apply authentication middleware
  io.use(authenticateSocket);

  // Handle new connections
  io.on('connection', (socket: Socket) => {
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;

    console.log(`Player connected: ${playerName} (${playerId})`);

    // Register game event handlers
    registerGameHandlers(io, socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Player disconnected: ${playerName} (${playerId}) - Reason: ${reason}`);
      
      // MVP: Basic disconnect handling
      // Phase 6 will add grace period and reconnection logic
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for player ${playerName}:`, error);
    });
  });

  console.log('WebSocket server initialized');
}
