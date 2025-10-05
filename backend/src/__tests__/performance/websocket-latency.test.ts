/**
 * WebSocket Latency Test
 * 
 * Measures WebSocket message round-trip latency
 */

import { io as ioClient, Socket } from 'socket.io-client';
import { GameState } from '@buck-euchre/shared';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const NUM_MEASUREMENTS = 100;
const TARGET_LATENCY_MS = 100;

interface TestPlayer {
  socket: Socket;
  playerId: string;
  token: string;
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

  const { playerId, token } = await response.json() as { playerId: string; token: string };

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

  const { gameId } = await response.json() as { gameId: string };
  return gameId;
}

/**
 * Measure latency of a specific event
 */
async function measureEventLatency(
  player: TestPlayer,
  gameId: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const timeout = setTimeout(() => {
      reject(new Error('Latency measurement timeout'));
    }, 5000);

    player.socket.once('GAME_STATE_UPDATE', () => {
      clearTimeout(timeout);
      const latency = Date.now() - startTime;
      resolve(latency);
    });

    player.socket.once('ERROR', () => {
      clearTimeout(timeout);
      resolve(0); // Ignore errors for this measurement
    });

    player.socket.emit('JOIN_GAME', { gameId });
  });
}

/**
 * Calculate statistics
 */
function calculateStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(avgSquareDiff);

  return {
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    stdDev,
  };
}

describe('WebSocket Latency Test', () => {
  it('should measure round-trip latency for JOIN_GAME event', async () => {
    console.log('\n⚡ WebSocket Latency Test\n');

    // Create test players
    console.log(`Creating ${NUM_MEASUREMENTS} test players...`);
    const players = await Promise.all(
      Array.from({ length: NUM_MEASUREMENTS }, (_, i) =>
        createPlayer(`LatencyTest${i}`)
      )
    );

    // Create games for measurements
    console.log(`Creating ${NUM_MEASUREMENTS} test games...`);
    const gameIds = await Promise.all(
      players.map(p => createGame(p.token))
    );

    console.log(`Measuring latency for ${NUM_MEASUREMENTS} events...`);
    const latencies: number[] = [];

    for (let i = 0; i < NUM_MEASUREMENTS; i++) {
      try {
        const latency = await measureEventLatency(players[i], gameIds[i]);
        if (latency > 0) {
          latencies.push(latency);
        }
      } catch (error) {
        console.error(`Measurement ${i} failed:`, error);
      }

      // Small delay between measurements to avoid overwhelming the server
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const stats = calculateStats(latencies);

    console.log(`\n📊 Latency Statistics (${latencies.length} measurements):`);
    console.log(`   Mean:     ${stats.mean.toFixed(2)}ms`);
    console.log(`   Median:   ${stats.median.toFixed(2)}ms`);
    console.log(`   Min:      ${stats.min.toFixed(2)}ms`);
    console.log(`   Max:      ${stats.max.toFixed(2)}ms`);
    console.log(`   P95:      ${stats.p95.toFixed(2)}ms`);
    console.log(`   P99:      ${stats.p99.toFixed(2)}ms`);
    console.log(`   Std Dev:  ${stats.stdDev.toFixed(2)}ms`);

    // Check against target
    const withinTarget = latencies.filter(l => l <= TARGET_LATENCY_MS).length;
    const percentage = (withinTarget / latencies.length) * 100;

    console.log(`\n✓ ${percentage.toFixed(1)}% of requests under ${TARGET_LATENCY_MS}ms`);

    // Assertions
    expect(stats.mean).toBeLessThan(TARGET_LATENCY_MS);
    expect(stats.p95).toBeLessThan(TARGET_LATENCY_MS * 1.5); // Allow some margin for P95
    expect(percentage).toBeGreaterThan(80); // At least 80% under target

    // Cleanup
    players.forEach(p => {
      if (p.socket?.connected) {
        p.socket.disconnect();
      }
    });
  }, 120000);

  it('should measure latency under concurrent load', async () => {
    console.log('\n⚡ Concurrent Load Latency Test\n');

    const numConcurrent = 50;

    // Create concurrent players
    console.log(`Creating ${numConcurrent} concurrent players...`);
    const players = await Promise.all(
      Array.from({ length: numConcurrent }, (_, i) =>
        createPlayer(`ConcurrentLatency${i}`)
      )
    );

    // Create games
    const gameIds = await Promise.all(
      players.map(p => createGame(p.token))
    );

    // Measure latency for all concurrent requests
    console.log(`Measuring concurrent latency...`);
    const startTime = Date.now();

    const latencyPromises = players.map((player, i) =>
      measureEventLatency(player, gameIds[i]).catch(() => 0)
    );

    const latencies = await Promise.all(latencyPromises);
    const validLatencies = latencies.filter(l => l > 0);

    const totalTime = Date.now() - startTime;
    const stats = calculateStats(validLatencies);

    console.log(`\n📊 Concurrent Latency Statistics (${validLatencies.length}/${numConcurrent} successful):`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Mean:       ${stats.mean.toFixed(2)}ms`);
    console.log(`   Median:     ${stats.median.toFixed(2)}ms`);
    console.log(`   P95:        ${stats.p95.toFixed(2)}ms`);
    console.log(`   Max:        ${stats.max.toFixed(2)}ms`);

    // Under load, latency should still be reasonable
    expect(stats.median).toBeLessThan(TARGET_LATENCY_MS * 2); // Allow 2x under load
    expect(validLatencies.length).toBeGreaterThan(numConcurrent * 0.9); // 90% success rate

    // Cleanup
    players.forEach(p => {
      if (p.socket?.connected) {
        p.socket.disconnect();
      }
    });
  }, 120000);

  it('should measure connection establishment time', async () => {
    console.log('\n⚡ Connection Establishment Test\n');

    const numConnections = 50;
    const connectionTimes: number[] = [];

    console.log(`Measuring connection time for ${numConnections} connections...`);

    for (let i = 0; i < numConnections; i++) {
      const startTime = Date.now();
      const player = await createPlayer(`ConnectionTest${i}`);
      const connectionTime = Date.now() - startTime;

      connectionTimes.push(connectionTime);
      player.socket.disconnect();

      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const stats = calculateStats(connectionTimes);

    console.log(`\n📊 Connection Time Statistics:`);
    console.log(`   Mean:     ${stats.mean.toFixed(2)}ms`);
    console.log(`   Median:   ${stats.median.toFixed(2)}ms`);
    console.log(`   Min:      ${stats.min.toFixed(2)}ms`);
    console.log(`   Max:      ${stats.max.toFixed(2)}ms`);
    console.log(`   P95:      ${stats.p95.toFixed(2)}ms`);

    // Connection should be fast
    expect(stats.mean).toBeLessThan(1000); // Under 1 second average
    expect(stats.p95).toBeLessThan(2000); // P95 under 2 seconds
  }, 120000);
});
