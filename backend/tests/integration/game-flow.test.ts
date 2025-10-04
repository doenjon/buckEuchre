/**
 * Integration tests for Buck Euchre game flow via WebSocket
 * 
 * These tests simulate real players connecting and playing through
 * the entire game without needing a browser.
 */

import { io as ioClient, Socket } from 'socket.io-client';
import { GameState, GamePhase } from '@buck-euchre/shared';

const BACKEND_URL = 'http://localhost:3000';

interface Player {
  socket: Socket;
  name: string;
  playerId: string | null;
  gameState: GameState | null;
}

/**
 * Helper to create and authenticate a player
 */
async function createPlayer(name: string): Promise<Player> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(BACKEND_URL, {
      transports: ['websocket'],
      autoConnect: false,
    });

    const player: Player = {
      socket,
      name,
      playerId: null,
      gameState: null,
    };

    socket.on('connect', () => {
      // Authenticate
      socket.emit('AUTHENTICATE', { playerName: name });
    });

    socket.on('AUTHENTICATED', (data: { playerId: string; playerName: string }) => {
      player.playerId = data.playerId;
      resolve(player);
    });

    socket.on('ERROR', (error: any) => {
      reject(new Error(`Failed to create player ${name}: ${error.message}`));
    });

    socket.on('GAME_STATE_UPDATE', (data: { gameState: GameState }) => {
      player.gameState = data.gameState;
    });

    socket.connect();

    // Timeout after 5 seconds
    setTimeout(() => reject(new Error(`Timeout creating player ${name}`)), 5000);
  });
}

/**
 * Helper to create a game
 */
async function createGame(player: Player): Promise<string> {
  return new Promise((resolve, reject) => {
    player.socket.emit('CREATE_GAME', {});

    const handleGameCreated = (data: { gameId: string }) => {
      player.socket.off('GAME_CREATED', handleGameCreated);
      resolve(data.gameId);
    };

    player.socket.on('GAME_CREATED', handleGameCreated);

    player.socket.on('ERROR', (error: any) => {
      reject(new Error(`Failed to create game: ${error.message}`));
    });

    setTimeout(() => reject(new Error('Timeout creating game')), 5000);
  });
}

/**
 * Helper to join a game
 */
async function joinGame(player: Player, gameId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    player.socket.emit('JOIN_GAME', { gameId });

    const handleStateUpdate = (data: { gameState: GameState; event: string }) => {
      player.gameState = data.gameState;
      if (data.event === 'GAME_STARTED') {
        player.socket.off('GAME_STATE_UPDATE', handleStateUpdate);
        resolve();
      }
    };

    const handleWaiting = () => {
      // Still waiting for more players, that's OK
      resolve();
    };

    player.socket.on('GAME_STATE_UPDATE', handleStateUpdate);
    player.socket.on('GAME_WAITING', handleWaiting);

    player.socket.on('ERROR', (error: any) => {
      reject(new Error(`Failed to join game: ${error.message}`));
    });

    setTimeout(() => resolve(), 5000); // Resolve anyway after 5s
  });
}

/**
 * Cleanup: disconnect all players
 */
function cleanup(players: Player[]) {
  players.forEach(p => {
    if (p.socket.connected) {
      p.socket.disconnect();
    }
  });
}

/**
 * Wait for a condition to be true
 */
async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  checkInterval = 100
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
}

describe('Buck Euchre Game Flow', () => {
  let players: Player[] = [];

  afterEach(() => {
    cleanup(players);
    players = [];
  });

  describe('Game Creation and Joining', () => {
    it('should allow 4 players to join and start a game', async () => {
      console.log('\n🎮 Test: 4 players join and start game\n');

      // Create 4 players
      console.log('Creating 4 players...');
      const player1 = await createPlayer('Alice');
      const player2 = await createPlayer('Bob');
      const player3 = await createPlayer('Charlie');
      const player4 = await createPlayer('Diana');
      players = [player1, player2, player3, player4];

      console.log('✅ All players created');

      // Player 1 creates game
      console.log('Player 1 creating game...');
      const gameId = await createGame(player1);
      console.log(`✅ Game created: ${gameId}`);

      // All players join
      console.log('Players joining game...');
      await Promise.all([
        joinGame(player1, gameId),
        joinGame(player2, gameId),
        joinGame(player3, gameId),
        joinGame(player4, gameId),
      ]);
      console.log('✅ All players joined');

      // Wait for game to start
      await waitFor(() => {
        return players.some(p => p.gameState !== null);
      }, 10000);

      console.log('✅ Game state received');

      // Verify game started
      const gameState = players.find(p => p.gameState)?.gameState;
      expect(gameState).toBeTruthy();
      expect(gameState!.gameId).toBe(gameId);
      expect(gameState!.players).toHaveLength(4);
      expect(gameState!.phase).toBe('DEALING');

      console.log(`✅ Game started in phase: ${gameState!.phase}`);
      console.log(`✅ Dealer: Player ${gameState!.dealerPosition}`);
      console.log(`✅ Round: ${gameState!.round}`);
    }, 30000); // 30 second timeout

    it('should not allow more than 4 players', async () => {
      console.log('\n🎮 Test: Prevent 5th player from joining\n');

      // Create 5 players
      const player1 = await createPlayer('Alice');
      const player2 = await createPlayer('Bob');
      const player3 = await createPlayer('Charlie');
      const player4 = await createPlayer('Diana');
      const player5 = await createPlayer('Eve');
      players = [player1, player2, player3, player4, player5];

      // Create game and add 4 players
      const gameId = await createGame(player1);
      await joinGame(player1, gameId);
      await joinGame(player2, gameId);
      await joinGame(player3, gameId);
      await joinGame(player4, gameId);

      // Try to add 5th player - should fail
      let errorOccurred = false;
      player5.socket.on('ERROR', () => {
        errorOccurred = true;
      });

      await joinGame(player5, gameId).catch(() => {
        errorOccurred = true;
      });

      // Give it time to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(errorOccurred).toBe(true);
      console.log('✅ 5th player correctly rejected');
    }, 30000);
  });

  describe('Game State Synchronization', () => {
    it('should broadcast game state to all players', async () => {
      console.log('\n🎮 Test: Game state broadcast\n');

      // Setup 4 players in a game
      const player1 = await createPlayer('Alice');
      const player2 = await createPlayer('Bob');
      const player3 = await createPlayer('Charlie');
      const player4 = await createPlayer('Diana');
      players = [player1, player2, player3, player4];

      const gameId = await createGame(player1);
      await Promise.all([
        joinGame(player1, gameId),
        joinGame(player2, gameId),
        joinGame(player3, gameId),
        joinGame(player4, gameId),
      ]);

      // Wait for all players to receive game state
      await waitFor(() => {
        return players.every(p => p.gameState !== null);
      }, 10000);

      // Verify all players have the same gameId and round
      const gameIds = players.map(p => p.gameState?.gameId);
      const rounds = players.map(p => p.gameState?.round);

      expect(new Set(gameIds).size).toBe(1); // All same gameId
      expect(new Set(rounds).size).toBe(1); // All same round
      expect(gameIds[0]).toBe(gameId);

      console.log('✅ All players have synchronized game state');
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid game ID gracefully', async () => {
      console.log('\n🎮 Test: Invalid game ID\n');

      const player1 = await createPlayer('Alice');
      players = [player1];

      let errorReceived = false;
      player1.socket.on('ERROR', (error: any) => {
        console.log(`Received error: ${error.message}`);
        errorReceived = true;
      });

      player1.socket.emit('JOIN_GAME', { gameId: 'invalid-game-id' });

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(errorReceived).toBe(true);
      console.log('✅ Error correctly handled for invalid game ID');
    }, 15000);
  });
});

describe('Backend Health', () => {
  it('should be able to connect to backend', async () => {
    console.log('\n🏥 Test: Backend connection\n');

    const player = await createPlayer('HealthCheck');
    expect(player.playerId).toBeTruthy();
    expect(player.socket.connected).toBe(true);

    console.log('✅ Backend is healthy and accepting connections');

    player.socket.disconnect();
  }, 10000);
});

