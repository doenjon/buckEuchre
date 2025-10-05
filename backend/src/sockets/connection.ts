import { Server, Socket } from 'socket.io';
import { authenticateSocket } from './middleware';
import { registerGameHandlers } from './game';
import { 
  registerConnection, 
  handleDisconnect, 
  handleReconnect,
  isPlayerConnected 
} from '../services/connection.service';

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

    // Check if this is a reconnection
    const wasConnected = isPlayerConnected(playerId);
    
    // Register this connection
    registerConnection(socket, playerId);

    if (wasConnected) {
      // Handle reconnection
      handleReconnect(socket, playerId, io);
    }

    // Register game event handlers
    registerGameHandlers(io, socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Player disconnected: ${playerName} (${playerId}) - Reason: ${reason}`);
      
      // Handle disconnect with grace period
      handleDisconnect(playerId, io);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for player ${playerName}:`, error);
    });
  });

  console.log('WebSocket server initialized');
}
