/**
 * Test script to reproduce the bot addition crash bug
 * 
 * This script simulates:
 * 1. Creating a game
 * 2. Adding 3 bots sequentially
 * 3. Monitoring for crashes/errors
 */

// Node 20+ has built-in fetch, otherwise use node-fetch
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  console.error('Error: fetch not available. Install node-fetch: npm install node-fetch');
  process.exit(1);
}

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to make authenticated requests
async function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { error: error.message };
  }
}

// Step 1: Create a guest user
async function createGuestUser() {
  console.log('[TEST] Step 1: Creating guest user...');
  const result = await makeRequest('/api/auth/guest', 'POST');
  
  if (result.error || result.status !== 201) {
    console.error('[TEST] Failed to create guest user:', result);
    process.exit(1);
  }
  
  console.log('[TEST] ✓ Guest user created:', result.data.userId);
  return result.data.token;
}

// Step 2: Create a game
async function createGame(token) {
  console.log('[TEST] Step 2: Creating game...');
  const result = await makeRequest('/api/games', 'POST', {}, token);
  
  if (result.error || result.status !== 201) {
    console.error('[TEST] Failed to create game:', result);
    process.exit(1);
  }
  
  console.log('[TEST] ✓ Game created:', result.data.gameId);
  return result.data.gameId;
}

// Step 3: Add bots sequentially
async function addBots(gameId, token, count = 3) {
  console.log(`[TEST] Step 3: Adding ${count} bots...`);
  
  for (let i = 1; i <= count; i++) {
    console.log(`[TEST] Adding bot ${i}/${count}...`);
    const result = await makeRequest(
      `/api/games/${gameId}/ai`,
      'POST',
      { difficulty: 'medium' },
      token
    );
    
    if (result.error) {
      console.error(`[TEST] ✗ Failed to add bot ${i}:`, result.error);
      return false;
    }
    
    if (result.status !== 201) {
      console.error(`[TEST] ✗ Bot ${i} addition returned status ${result.status}:`, result.data);
      return false;
    }
    
    console.log(`[TEST] ✓ Bot ${i} added:`, {
      gameStarted: result.data.gameStarted,
      playerCount: result.data.playerCount,
      phase: result.data.gameState?.phase,
    });
    
    // Small delay between bot additions
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return true;
}

// Step 4: Monitor game state
async function monitorGame(gameId, token, duration = 10000) {
  console.log(`[TEST] Step 4: Monitoring game for ${duration/1000}s...`);
  
  const startTime = Date.now();
  let lastState = null;
  let errorCount = 0;
  
  while (Date.now() - startTime < duration) {
    const result = await makeRequest(`/api/games/${gameId}`, 'GET', null, token);
    
    if (result.error) {
      errorCount++;
      console.error(`[TEST] ✗ Error fetching game state (${errorCount}):`, result.error);
      if (errorCount > 5) {
        console.error('[TEST] ✗ Too many errors - backend may have crashed!');
        return false;
      }
    } else if (result.status === 200) {
      const state = result.data;
      if (!lastState || state.version !== lastState.version) {
        console.log(`[TEST] State update:`, {
          phase: state.phase,
          version: state.version,
          round: state.round,
          currentPlayer: state.currentPlayerPosition,
        });
        lastState = state;
      }
    } else {
      console.warn(`[TEST] Unexpected status ${result.status}:`, result.data);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('[TEST] ✓ Monitoring complete');
  return true;
}

// Main test
async function runTest() {
  console.log('='.repeat(60));
  console.log('BUG REPRODUCTION TEST');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log('');
  
  try {
    const token = await createGuestUser();
    const gameId = await createGame(token);
    
    const botsAdded = await addBots(gameId, token, 3);
    if (!botsAdded) {
      console.error('[TEST] ✗ Failed to add all bots');
      process.exit(1);
    }
    
    // Monitor for crashes
    const monitoringOk = await monitorGame(gameId, token, 15000);
    if (!monitoringOk) {
      console.error('[TEST] ✗ Monitoring detected issues');
      process.exit(1);
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('[TEST] ✓ Test completed successfully');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('[TEST] ✗ Test failed with exception:', error);
    process.exit(1);
  }
}

// Run the test
runTest();

