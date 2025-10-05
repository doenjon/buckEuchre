/**
 * Integration Tests for WebSocket Events
 * 
 * Tests all WebSocket event handlers and real-time communication
 */

import { io as ioClient, Socket } from 'socket.io-client';
import { GameState, GamePhase } from '@buck-euchre/shared';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TIMEOUT = 10000;

interface TestPlayer {
  socket: Socket;
  name: string;
  playerId: string;
  token: string;
  gameState: GameState | null;
  lastError: any;
}

/**
 * Helper to create and authenticate a player
 */
async function createPlayer(name: string): Promise<TestPlayer> {
  // Step 1: Create player via REST API
  const response = await fetch(`${BACKEND_URL}/api/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName: name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create player: ${response.statusText}`);
  }

  const { playerId, playerName, token } = await response.json();

  // Step 2: Connect WebSocket
  return new Promise((resolve, reject) => {
    const socket = ioClient(BACKEND_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: false,
    });

    const player: TestPlayer = {
      socket,
      name: playerName,
      playerId,
      token,
      gameState: null,
      lastError: null,
    };

    socket.on('connect', () => resolve(player));
    socket.on('connect_error', (error: Error) => reject(error));
    socket.on('ERROR', (error: any) => {
      player.lastError = error;
    });
    socket.on('GAME_STATE_UPDATE', (data: { gameState: GameState }) => {
      player.gameState = data.gameState;
    });

    socket.connect();

    setTimeout(() => reject(new Error(`Timeout connecting ${name}`)), 5000);
  });
}

/**
 * Helper to create a game via REST API
 */
async function createGame(token: string): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create game: ${response.statusText}`);
  }

  const { gameId } = await response.json();
  return gameId;
}

/**
 * Wait for a condition to be true
 */
async function waitFor(
  condition: () => boolean,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Cleanup helper
 */
function cleanup(players: TestPlayer[]) {
  players.forEach(p => {
    if (p.socket?.connected) {
      p.socket.disconnect();
    }
  });
}

describe('WebSocket Integration Tests', () => {
  let players: TestPlayer[] = [];

  afterEach(() => {
    cleanup(players);
    players = [];
  });

  describe('Connection and Authentication', () => {
    it('should successfully connect with valid JWT token', async () => {
      const player = await createPlayer('ConnectTest');
      players.push(player);

      expect(player.socket.connected).toBe(true);
      expect(player.playerId).toBeTruthy();
    }, TIMEOUT);

    it('should reject connection with invalid token', async () => {
      const socket = ioClient(BACKEND_URL, {
        transports: ['websocket'],
        auth: { token: 'invalid-token' },
        autoConnect: false,
      });

      const connectPromise = new Promise((resolve, reject) => {
        socket.on('connect', () => resolve('connected'));
        socket.on('connect_error', (error: Error) => reject(error));
        socket.connect();
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      await expect(connectPromise).rejects.toThrow();

      socket.disconnect();
    }, TIMEOUT);

    it('should reject connection without token', async () => {
      const socket = ioClient(BACKEND_URL, {
        transports: ['websocket'],
        auth: {},
        autoConnect: false,
      });

      const connectPromise = new Promise((resolve, reject) => {
        socket.on('connect', () => resolve('connected'));
        socket.on('connect_error', (error: Error) => reject(error));
        socket.connect();
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      await expect(connectPromise).rejects.toThrow();

      socket.disconnect();
    }, TIMEOUT);

    it('should handle multiple concurrent connections', async () => {
      const connectionPromises = Array.from({ length: 5 }, (_, i) =>
        createPlayer(`ConcurrentPlayer${i}`)
      );

      const connectedPlayers = await Promise.all(connectionPromises);
      players.push(...connectedPlayers);

      connectedPlayers.forEach(player => {
        expect(player.socket.connected).toBe(true);
      });
    }, TIMEOUT);

    it('should maintain connection state', async () => {
      const player = await createPlayer('StateTest');
      players.push(player);

      expect(player.socket.connected).toBe(true);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should still be connected
      expect(player.socket.connected).toBe(true);
    }, TIMEOUT);
  });

  describe('JOIN_GAME Event', () => {
    it('should successfully join a game', async () => {
      const player = await createPlayer('JoinTest');
      players.push(player);

      const gameId = await createGame(player.token);

      const joinPromise = new Promise<void>((resolve, reject) => {
        player.socket.once('GAME_WAITING', () => resolve());
        player.socket.once('GAME_STATE_UPDATE', () => resolve());
        player.socket.once('ERROR', reject);
        player.socket.emit('JOIN_GAME', { gameId });
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      await expect(joinPromise).resolves.not.toThrow();
    }, TIMEOUT);

    it('should emit error for invalid game ID', async () => {
      const player = await createPlayer('InvalidGameTest');
      players.push(player);

      const errorPromise = new Promise((resolve, reject) => {
        player.socket.once('ERROR', (error: any) => {
          expect(error).toHaveProperty('message');
          resolve(error);
        });
        player.socket.emit('JOIN_GAME', { gameId: 'non-existent-game' });
        setTimeout(() => reject(new Error('No error received')), 5000);
      });

      await expect(errorPromise).resolves.toBeTruthy();
    }, TIMEOUT);

    it('should emit error when joining full game', async () => {
      // Create 4 players and fill a game
      const player1 = await createPlayer('Full1');
      const player2 = await createPlayer('Full2');
      const player3 = await createPlayer('Full3');
      const player4 = await createPlayer('Full4');
      const player5 = await createPlayer('Full5');
      players.push(player1, player2, player3, player4, player5);

      const gameId = await createGame(player1.token);

      // Join first 4 players
      await Promise.all([
        new Promise<void>(resolve => {
          player1.socket.emit('JOIN_GAME', { gameId });
          player1.socket.once('GAME_WAITING', () => resolve());
          player1.socket.once('GAME_STATE_UPDATE', () => resolve());
        }),
        new Promise<void>(resolve => {
          player2.socket.emit('JOIN_GAME', { gameId });
          player2.socket.once('GAME_WAITING', () => resolve());
          player2.socket.once('GAME_STATE_UPDATE', () => resolve());
        }),
        new Promise<void>(resolve => {
          player3.socket.emit('JOIN_GAME', { gameId });
          player3.socket.once('GAME_WAITING', () => resolve());
          player3.socket.once('GAME_STATE_UPDATE', () => resolve());
        }),
        new Promise<void>(resolve => {
          player4.socket.emit('JOIN_GAME', { gameId });
          player4.socket.once('GAME_STATE_UPDATE', () => resolve());
        }),
      ]);

      // 5th player should get error
      const errorPromise = new Promise((resolve, reject) => {
        player5.socket.once('ERROR', (error: any) => resolve(error));
        player5.socket.emit('JOIN_GAME', { gameId });
        setTimeout(() => reject(new Error('No error received')), 5000);
      });

      await expect(errorPromise).resolves.toBeTruthy();
    }, TIMEOUT * 2);

    it('should emit GAME_WAITING when waiting for more players', async () => {
      const player = await createPlayer('WaitingTest');
      players.push(player);

      const gameId = await createGame(player.token);

      const waitingPromise = new Promise<void>((resolve, reject) => {
        player.socket.once('GAME_WAITING', () => resolve());
        player.socket.emit('JOIN_GAME', { gameId });
        setTimeout(() => reject(new Error('No GAME_WAITING received')), 5000);
      });

      await expect(waitingPromise).resolves.not.toThrow();
    }, TIMEOUT);

    it('should emit GAME_STARTED when 4th player joins', async () => {
      const player1 = await createPlayer('Start1');
      const player2 = await createPlayer('Start2');
      const player3 = await createPlayer('Start3');
      const player4 = await createPlayer('Start4');
      players.push(player1, player2, player3, player4);

      const gameId = await createGame(player1.token);

      // Set up listeners before joining
      const startedPromises = players.map(player =>
        new Promise<void>((resolve, reject) => {
          player.socket.on('GAME_STATE_UPDATE', (data: { gameState: GameState }) => {
            if (data.gameState.phase !== 'WAITING_FOR_PLAYERS') {
              resolve();
            }
          });
          setTimeout(() => reject(new Error(`${player.name} timeout`)), 10000);
        })
      );

      // Join all players
      player1.socket.emit('JOIN_GAME', { gameId });
      await new Promise(resolve => setTimeout(resolve, 100));
      player2.socket.emit('JOIN_GAME', { gameId });
      await new Promise(resolve => setTimeout(resolve, 100));
      player3.socket.emit('JOIN_GAME', { gameId });
      await new Promise(resolve => setTimeout(resolve, 100));
      player4.socket.emit('JOIN_GAME', { gameId });

      // All should receive GAME_STARTED
      await expect(Promise.all(startedPromises)).resolves.not.toThrow();
    }, TIMEOUT * 2);
  });

  describe('GAME_STATE_UPDATE Event', () => {
    it('should broadcast state updates to all players', async () => {
      const player1 = await createPlayer('Sync1');
      const player2 = await createPlayer('Sync2');
      const player3 = await createPlayer('Sync3');
      const player4 = await createPlayer('Sync4');
      players.push(player1, player2, player3, player4);

      const gameId = await createGame(player1.token);

      // Join all players
      await Promise.all(players.map(player =>
        new Promise<void>(resolve => {
          player.socket.emit('JOIN_GAME', { gameId });
          player.socket.once('GAME_STATE_UPDATE', () => resolve());
          player.socket.once('GAME_WAITING', () => resolve());
        })
      ));

      // Wait for game to start
      await waitFor(() => players.every(p => p.gameState !== null), 5000);

      // All players should have the same game state
      const gameStates = players.map(p => p.gameState);
      const gameIds = gameStates.map(s => s?.gameId);
      expect(new Set(gameIds).size).toBe(1);

      const phases = gameStates.map(s => s?.phase);
      expect(new Set(phases).size).toBe(1);
    }, TIMEOUT * 2);

    it('should include complete game state in updates', async () => {
      const player1 = await createPlayer('CompleteState1');
      const player2 = await createPlayer('CompleteState2');
      const player3 = await createPlayer('CompleteState3');
      const player4 = await createPlayer('CompleteState4');
      players.push(player1, player2, player3, player4);

      const gameId = await createGame(player1.token);

      await Promise.all(players.map(player =>
        new Promise<void>(resolve => {
          player.socket.emit('JOIN_GAME', { gameId });
          player.socket.once('GAME_STATE_UPDATE', () => resolve());
          player.socket.once('GAME_WAITING', () => resolve());
        })
      ));

      await waitFor(() => player1.gameState !== null, 5000);

      const state = player1.gameState!;
      expect(state).toHaveProperty('gameId');
      expect(state).toHaveProperty('phase');
      expect(state).toHaveProperty('round');
      expect(state).toHaveProperty('players');
      expect(state).toHaveProperty('dealerPosition');
      expect(Array.isArray(state.players)).toBe(true);
      expect(state.players).toHaveLength(4);
    }, TIMEOUT * 2);
  });

  describe('Error Handling', () => {
    it('should emit ERROR for invalid event data', async () => {
      const player = await createPlayer('ErrorTest');
      players.push(player);

      const errorPromise = new Promise((resolve, reject) => {
        player.socket.once('ERROR', (error: any) => resolve(error));
        player.socket.emit('JOIN_GAME', { invalidField: 'bad data' });
        setTimeout(() => reject(new Error('No error received')), 5000);
      });

      await expect(errorPromise).resolves.toBeTruthy();
    }, TIMEOUT);

    it('should emit ERROR for actions in wrong game phase', async () => {
      const player = await createPlayer('WrongPhaseTest');
      players.push(player);

      const gameId = await createGame(player.token);
      player.socket.emit('JOIN_GAME', { gameId });

      // Wait for game to be in WAITING_FOR_PLAYERS
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to play a card (invalid in WAITING_FOR_PLAYERS)
      const errorPromise = new Promise((resolve, reject) => {
        player.socket.once('ERROR', (error: any) => resolve(error));
        player.socket.emit('PLAY_CARD', { 
          gameId, 
          cardId: 'some-card-id' 
        });
        setTimeout(() => reject(new Error('No error received')), 5000);
      });

      await expect(errorPromise).resolves.toBeTruthy();
    }, TIMEOUT);
  });

  describe('Disconnection Handling', () => {
    it('should handle player disconnection gracefully', async () => {
      const player = await createPlayer('DisconnectTest');
      players.push(player);

      expect(player.socket.connected).toBe(true);

      // Disconnect
      player.socket.disconnect();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(player.socket.connected).toBe(false);
    }, TIMEOUT);

    it('should allow reconnection after disconnect', async () => {
      const player = await createPlayer('ReconnectTest');

      // Disconnect
      player.socket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(player.socket.connected).toBe(false);

      // Reconnect
      const reconnectPromise = new Promise<void>((resolve, reject) => {
        player.socket.once('connect', () => resolve());
        player.socket.once('connect_error', reject);
        player.socket.connect();
        setTimeout(() => reject(new Error('Reconnect timeout')), 5000);
      });

      await expect(reconnectPromise).resolves.not.toThrow();
      expect(player.socket.connected).toBe(true);

      players.push(player);
    }, TIMEOUT);
  });

  describe('Event Validation', () => {
    it('should validate JOIN_GAME event data', async () => {
      const player = await createPlayer('ValidationTest');
      players.push(player);

      // Test missing gameId
      const errorPromise = new Promise((resolve, reject) => {
        player.socket.once('ERROR', (error: any) => resolve(error));
        player.socket.emit('JOIN_GAME', {});
        setTimeout(() => reject(new Error('No error received')), 5000);
      });

      await expect(errorPromise).resolves.toBeTruthy();
    }, TIMEOUT);

    it('should validate event payload types', async () => {
      const player = await createPlayer('TypeValidationTest');
      players.push(player);

      // Test invalid gameId type
      const errorPromise = new Promise((resolve, reject) => {
        player.socket.once('ERROR', (error: any) => resolve(error));
        player.socket.emit('JOIN_GAME', { gameId: 123 });
        setTimeout(() => reject(new Error('No error received')), 5000);
      });

      await expect(errorPromise).resolves.toBeTruthy();
    }, TIMEOUT);
  });
});
