/**
 * Concurrent Games Load Test
 * 
 * Tests the system's ability to handle multiple concurrent games
 */

import { io as ioClient, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const NUM_GAMES = 20;
const PLAYERS_PER_GAME = 4;
const TIMEOUT = 120000; // 2 minutes

interface TestPlayer {
  socket: Socket;
  playerId: string;
  token: string;
  gameId?: string;
}

/**
 * Create a player
 */
async function createPlayer(name: string): Promise<TestPlayer> {
  const response = await fetch(`${BACKEND_URL}/api/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName: name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create player: ${response.statusText}`);
  }

  const { playerId, token } = await response.json();

  return new Promise((resolve, reject) => {
    const socket = ioClient(BACKEND_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: false,
    });

    const player: TestPlayer = {
      socket,
      playerId,
      token,
    };

    socket.on('connect', () => resolve(player));
    socket.on('connect_error', (error: Error) => reject(error));

    socket.connect();

    setTimeout(() => reject(new Error(`Timeout connecting ${name}`)), 5000);
  });
}

/**
 * Create a game
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
 * Cleanup helper
 */
function cleanup(players: TestPlayer[]) {
  players.forEach(p => {
    if (p.socket?.connected) {
      p.socket.disconnect();
    }
  });
}

describe('Concurrent Games Load Test', () => {
  let allPlayers: TestPlayer[] = [];

  afterAll(() => {
    cleanup(allPlayers);
  });

  it(`should handle ${NUM_GAMES} concurrent games with ${PLAYERS_PER_GAME} players each`, async () => {
    console.log(`\n🎮 Load Test: ${NUM_GAMES} concurrent games\n`);

    const startTime = Date.now();

    // Create all players (NUM_GAMES * PLAYERS_PER_GAME)
    console.log(`Creating ${NUM_GAMES * PLAYERS_PER_GAME} players...`);
    const playerPromises: Promise<TestPlayer>[] = [];

    for (let gameNum = 0; gameNum < NUM_GAMES; gameNum++) {
      for (let playerNum = 0; playerNum < PLAYERS_PER_GAME; playerNum++) {
        playerPromises.push(
          createPlayer(`Game${gameNum}_Player${playerNum}`)
        );
      }
    }

    allPlayers = await Promise.all(playerPromises);
    console.log(`✓ Created ${allPlayers.length} players in ${Date.now() - startTime}ms`);

    // Create games
    console.log(`\nCreating ${NUM_GAMES} games...`);
    const gameCreationStart = Date.now();
    const gameIds: string[] = [];

    for (let gameNum = 0; gameNum < NUM_GAMES; gameNum++) {
      const firstPlayerIndex = gameNum * PLAYERS_PER_GAME;
      const gameId = await createGame(allPlayers[firstPlayerIndex].token);
      gameIds.push(gameId);
    }

    console.log(`✓ Created ${NUM_GAMES} games in ${Date.now() - gameCreationStart}ms`);

    // Have players join their respective games
    console.log(`\nJoining players to games...`);
    const joinStart = Date.now();
    const joinPromises: Promise<void>[] = [];

    for (let gameNum = 0; gameNum < NUM_GAMES; gameNum++) {
      const gameId = gameIds[gameNum];
      const gamePlayerStart = gameNum * PLAYERS_PER_GAME;

      for (let playerOffset = 0; playerOffset < PLAYERS_PER_GAME; playerOffset++) {
        const player = allPlayers[gamePlayerStart + playerOffset];
        player.gameId = gameId;

        joinPromises.push(
          new Promise<void>((resolve) => {
            player.socket.on('GAME_STATE_UPDATE', () => resolve());
            player.socket.on('GAME_WAITING', () => resolve());
            player.socket.emit('JOIN_GAME', { gameId });
            setTimeout(() => resolve(), 5000);
          })
        );
      }
    }

    await Promise.all(joinPromises);
    console.log(`✓ All players joined games in ${Date.now() - joinStart}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Load test complete in ${totalTime}ms`);
    console.log(`📊 Stats:`);
    console.log(`   - Total players: ${allPlayers.length}`);
    console.log(`   - Total games: ${NUM_GAMES}`);
    console.log(`   - Average time per player: ${(totalTime / allPlayers.length).toFixed(2)}ms`);
    console.log(`   - Average time per game: ${(totalTime / NUM_GAMES).toFixed(2)}ms`);

    // Verify all players are still connected
    const connectedCount = allPlayers.filter(p => p.socket.connected).length;
    console.log(`   - Connected players: ${connectedCount}/${allPlayers.length}`);

    expect(connectedCount).toBe(allPlayers.length);
    expect(totalTime).toBeLessThan(60000); // Should complete within 60 seconds
  }, TIMEOUT);

  it('should handle rapid game creation', async () => {
    console.log('\n🎮 Rapid Game Creation Test\n');

    // Create 10 players
    const players = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createPlayer(`RapidPlayer${i}`))
    );

    allPlayers.push(...players);

    // Create 10 games simultaneously
    const startTime = Date.now();
    const gamePromises = players.map(p => createGame(p.token));
    const gameIds = await Promise.all(gamePromises);
    const duration = Date.now() - startTime;

    console.log(`✓ Created 10 games simultaneously in ${duration}ms`);
    console.log(`   Average: ${(duration / 10).toFixed(2)}ms per game`);

    expect(gameIds).toHaveLength(10);
    expect(new Set(gameIds).size).toBe(10); // All unique
    expect(duration).toBeLessThan(5000); // Should be fast

    // Cleanup
    players.forEach(p => p.socket.disconnect());
  }, 30000);

  it('should maintain performance under sustained load', async () => {
    console.log('\n🎮 Sustained Load Test\n');

    const sustainedPlayers: TestPlayer[] = [];
    const rounds = 3;
    const playersPerRound = 20;
    const timings: number[] = [];

    for (let round = 0; round < rounds; round++) {
      console.log(`Round ${round + 1}/${rounds}`);
      const startTime = Date.now();

      // Create players
      const players = await Promise.all(
        Array.from({ length: playersPerRound }, (_, i) =>
          createPlayer(`Sustained_R${round}_P${i}`)
        )
      );

      sustainedPlayers.push(...players);

      const duration = Date.now() - startTime;
      timings.push(duration);
      console.log(`  Created ${playersPerRound} players in ${duration}ms`);

      // Small delay between rounds
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✓ Sustained load test complete`);
    console.log(`📊 Timings:`);
    timings.forEach((time, index) => {
      console.log(`   Round ${index + 1}: ${time}ms`);
    });

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);

    // Performance should not degrade significantly
    const maxTime = Math.max(...timings);
    const minTime = Math.min(...timings);
    const degradation = ((maxTime - minTime) / minTime) * 100;

    console.log(`   Performance degradation: ${degradation.toFixed(2)}%`);

    expect(degradation).toBeLessThan(50); // Less than 50% degradation

    // Cleanup
    sustainedPlayers.forEach(p => {
      if (p.socket?.connected) {
        p.socket.disconnect();
      }
    });
  }, TIMEOUT);
});
