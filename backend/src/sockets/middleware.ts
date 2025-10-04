import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { verifyToken } from '../auth/jwt';
import { validatePlayer } from '../services/player.service';

/**
 * Socket.io middleware for authentication
 * Validates JWT token and attaches player data to socket
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: ExtendedError) => void
) {
  try {
    // Extract token from auth handshake
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }

    // Validate player exists and is not expired
    const player = await validatePlayer(payload.playerId);
    if (!player) {
      return next(new Error('Player not found or session expired'));
    }

    // Attach player data to socket
    socket.data.playerId = player.id;
    socket.data.playerName = player.name;

    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
}
