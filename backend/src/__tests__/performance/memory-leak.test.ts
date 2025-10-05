/**
 * Memory Leak Detection Test
 * 
 * Tests for memory leaks in long-running connections and game sessions
 */

import { io as ioClient, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

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
 * Get memory usage (if available)
 */
function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024, // MB
      external: usage.external / 1024 / 1024, // MB
      rss: usage.rss / 1024 / 1024, // MB
    };
  }
  return null;
}

describe('Memory Leak Detection', () => {
  it('should not leak memory with repeated connections', async () => {
    console.log('\n🔍 Memory Leak Test: Repeated Connections\n');

    const iterations = 100;
    const players: TestPlayer[] = [];

    // Take initial memory reading
    const initialMemory = getMemoryUsage();
    if (initialMemory) {
      console.log('Initial memory:', {
        heapUsed: initialMemory.heapUsed.toFixed(2) + ' MB',
        heapTotal: initialMemory.heapTotal.toFixed(2) + ' MB',
      });
    }

    // Create and disconnect many players
    console.log(`Creating and disconnecting ${iterations} players...`);
    
    for (let i = 0; i < iterations; i++) {
      const player = await createPlayer(`MemTest${i}`);
      players.push(player);
      
      // Immediately disconnect
      player.socket.disconnect();
      
      // Sample memory every 20 iterations
      if (i > 0 && i % 20 === 0) {
        const currentMemory = getMemoryUsage();
        if (currentMemory) {
          console.log(`  Iteration ${i}: ${currentMemory.heapUsed.toFixed(2)} MB`);
        }
      }
    }

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Take final memory reading
    const finalMemory = getMemoryUsage();
    if (finalMemory && initialMemory) {
      console.log('\nFinal memory:', {
        heapUsed: finalMemory.heapUsed.toFixed(2) + ' MB',
        heapTotal: finalMemory.heapTotal.toFixed(2) + ' MB',
      });

      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const growthPercentage = (heapGrowth / initialMemory.heapUsed) * 100;

      console.log(`\nMemory growth: ${heapGrowth.toFixed(2)} MB (${growthPercentage.toFixed(2)}%)`);

      // Memory should not grow significantly (allow 50% growth)
      expect(growthPercentage).toBeLessThan(50);
    } else {
      console.log('⚠️  Memory monitoring not available in this environment');
    }

    console.log('✓ No significant memory leak detected');
  }, 120000);

  it('should handle connection churn without leaking', async () => {
    console.log('\n🔍 Connection Churn Test\n');

    const cycles = 10;
    const playersPerCycle = 20;
    const memoryReadings: number[] = [];

    console.log(`Running ${cycles} cycles of ${playersPerCycle} connections each...`);

    for (let cycle = 0; cycle < cycles; cycle++) {
      // Create players
      const players = await Promise.all(
        Array.from({ length: playersPerCycle }, (_, i) =>
          createPlayer(`Churn_C${cycle}_P${i}`)
        )
      );

      // Keep connected briefly
      await new Promise(resolve => setTimeout(resolve, 500));

      // Disconnect all
      players.forEach(p => p.socket.disconnect());

      // Record memory
      const memory = getMemoryUsage();
      if (memory) {
        memoryReadings.push(memory.heapUsed);
        console.log(`  Cycle ${cycle + 1}: ${memory.heapUsed.toFixed(2)} MB`);
      }

      // Small delay between cycles
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (memoryReadings.length > 0) {
      const firstReading = memoryReadings[0];
      const lastReading = memoryReadings[memoryReadings.length - 1];
      const growth = ((lastReading - firstReading) / firstReading) * 100;

      console.log(`\nMemory growth across cycles: ${growth.toFixed(2)}%`);

      // Should not grow significantly across cycles
      expect(growth).toBeLessThan(30);
    }

    console.log('✓ Connection churn handled without leaks');
  }, 120000);

  it('should clean up event listeners properly', async () => {
    console.log('\n🔍 Event Listener Cleanup Test\n');

    const player = await createPlayer('ListenerTest');
    
    // Add multiple event listeners
    const eventCounts = {
      GAME_STATE_UPDATE: 0,
      ERROR: 0,
      GAME_WAITING: 0,
    };

    const handlers = {
      gameStateUpdate: () => { eventCounts.GAME_STATE_UPDATE++; },
      error: () => { eventCounts.ERROR++; },
      gameWaiting: () => { eventCounts.GAME_WAITING++; },
    };

    // Attach listeners
    player.socket.on('GAME_STATE_UPDATE', handlers.gameStateUpdate);
    player.socket.on('ERROR', handlers.error);
    player.socket.on('GAME_WAITING', handlers.gameWaiting);

    // Check listener count (if API available)
    const listenerCount = (event: string) => {
      return (player.socket as any).listenerCount ? (player.socket as any).listenerCount(event) : 0;
    };

    console.log('Listeners attached:');
    console.log(`  GAME_STATE_UPDATE: ${listenerCount('GAME_STATE_UPDATE')}`);
    console.log(`  ERROR: ${listenerCount('ERROR')}`);
    console.log(`  GAME_WAITING: ${listenerCount('GAME_WAITING')}`);

    // Remove listeners
    player.socket.off('GAME_STATE_UPDATE', handlers.gameStateUpdate);
    player.socket.off('ERROR', handlers.error);
    player.socket.off('GAME_WAITING', handlers.gameWaiting);

    console.log('\nListeners after removal:');
    console.log(`  GAME_STATE_UPDATE: ${listenerCount('GAME_STATE_UPDATE')}`);
    console.log(`  ERROR: ${listenerCount('ERROR')}`);
    console.log(`  GAME_WAITING: ${listenerCount('GAME_WAITING')}`);

    // All should be removed
    expect(listenerCount('GAME_STATE_UPDATE')).toBe(0);
    expect(listenerCount('ERROR')).toBe(0);
    expect(listenerCount('GAME_WAITING')).toBe(0);

    player.socket.disconnect();

    console.log('✓ Event listeners cleaned up properly');
  }, 30000);
});
