import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { validateSession } from '../services/user.service';

/**
 * Socket.io middleware for authentication
 * Validates JWT token and attaches user data to socket
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

    // Validate session
    const result = await validateSession(token);
    if (!result) {
      return next(new Error('Invalid or expired session'));
    }

    // Attach user data to socket
    socket.data.userId = result.user.id;
    socket.data.playerId = result.user.id; // For backwards compatibility with connection handler
    socket.data.username = result.user.username;
    socket.data.displayName = result.user.displayName;
    socket.data.playerName = result.user.displayName; // For backwards compatibility
    socket.data.isGuest = result.user.isGuest;

    console.log('[Socket Auth] ✓ Authenticated:', {
      playerId: result.user.id,
      username: result.user.username,
      displayName: result.user.displayName,
    });

    next();
  } catch (error) {
    console.error('[Socket Auth] ✗ Authentication failed:', error);
    next(new Error('Authentication failed'));
  }
}
