# Automated Testing Guide

## Overview

This project has a comprehensive WebSocket-based integration test framework that can test the entire game without manual browser interaction.

## How It Works

The tests simulate real players by:
1. Creating players via REST API (`POST /api/auth/join`) → get JWT tokens
2. Connecting via WebSocket with JWT authentication
3. Creating/joining games via REST API
4. Sending game actions via WebSocket events
5. Verifying game state updates

**No clicking required!** AI can run tests, see failures, fix bugs, and verify fixes automatically.

---

## Test Files

### Location: `backend/tests/integration/`

1. **`game-flow.test.ts`** - Basic game setup tests
   - ✅ 5/5 tests passing
   - Tests: 4 players join, game starts, state sync, error handling

2. **`full-game.test.ts`** - Complete game flow tests
   - 🚧 Framework ready, needs game logic fixes
   - Tests: Full game from dealing → bidding → trump → folding → playing → scoring

---

## Running Tests

### Prerequisites

**Terminal 1:** Backend must be running
```bash
cd ~/dev/BuchEuchre/backend
npm run dev
```

**Terminal 2:** Run tests
```bash
cd ~/dev/BuchEuchre/backend/tests/integration
npm test
```

### Run Specific Test File
```bash
cd ~/dev/BuchEuchre/backend/tests/integration
npm test game-flow.test.ts       # Basic tests
npm test full-game.test.ts       # Full game tests
```

---

## Current Status

### ✅ What Works
- Player creation & authentication
- Game creation
- 4 players joining
- Game initialization
- WebSocket connection & communication
- State synchronization across players

### 🐛 Bugs Found & Fixed by Tests
1. **Game state not stored in memory** - Fixed ✅
2. **Position race condition** when joining - Fixed ✅
3. **`const` assignment error** - Fixed ✅
4. **First round not dealt automatically** - Fixed ✅

### 🚧 What's Next
The full game flow test is ready but will reveal more bugs as game logic gets exercised. Run `full-game.test.ts` to find the next issues to fix.

---

## AI Testing Workflow

### 1. Run Tests
```bash
cd backend/tests/integration
npm test full-game.test.ts
```

### 2. Read Output
Tests will show:
- ✅ What passed
- ❌ What failed with error messages
- 📊 Detailed console logs showing game state

### 3. Fix Bugs
- Read the error message
- Check backend logs: `tail -50 /tmp/backend.log`
- Fix the code
- Restart backend if needed

### 4. Verify Fix
```bash
npm test full-game.test.ts
```

### 5. Repeat
Continue until all tests pass!

---

## Adding New Tests

### Test Structure
```typescript
test('description of what you're testing', async () => {
  // 1. Create 4 players
  const players = [
    await createPlayer('Alice'),
    await createPlayer('Bob'),
    await createPlayer('Charlie'),
    await createPlayer('Diana'),
  ];
  
  // 2. Create and join game
  const gameId = await createGame(players[0]);
  await Promise.all(players.map(p => joinGame(p, gameId)));
  
  // 3. Wait for game to start
  await waitForPhase(players, 'BIDDING');
  
  // 4. Perform actions
  players[0].socket.emit('PLACE_BID', { bid: 3 });
  
  // 5. Wait for state changes
  await waitForGameState(players, state => 
    state.currentBidder === 1
  );
  
  // 6. Verify results
  expect(players[0].gameState.highestBid).toBe(3);
  
  // 7. Clean up
  cleanup(players);
}, 30000); // 30 second timeout
```

### Helper Functions Available

- `createPlayer(name)` - Create & authenticate a player
- `createGame(player)` - Create a game via REST API
- `joinGame(player, gameId)` - Join game via WebSocket
- `waitForPhase(players, phase)` - Wait for specific game phase
- `waitForGameState(players, condition)` - Wait for custom condition
- `getPlayerHand(gameState, playerId)` - Get player's cards
- `findValidCard(hand, gameState)` - Find legal card to play
- `cleanup(players)` - Disconnect all players

---

## Benefits

### 🚀 Fast Development
- No manual clicking through 4 browser windows
- Test full games in seconds, not minutes
- Iterate rapidly: code → test → fix → repeat

### 🐛 Bug Detection
- Catches bugs immediately
- Tests edge cases automatically
- Regression prevention

### 📝 Living Documentation
- Tests show how the game actually works
- Examples of valid game flows
- Edge case handling documented in code

---

## Example: Latest Bug Found

**Test Output:**
```
✅ All players created
✅ Game created
📋 Phase: DEALING
  Player 0: 0 cards  ← BUG!
  Player 1: 0 cards
```

**Diagnosis:** `initializeGame()` didn't actually deal cards

**Fix:** Call `dealNewRound()` after `initializeGame()`

**Result:** Test now passes, game starts correctly

---

## Tips for AI Agents

1. **Run tests first** - See what's broken before fixing
2. **Read the full output** - Console logs show game state
3. **Check backend logs** - `/tmp/backend.log` has server errors
4. **One bug at a time** - Fix, test, verify, repeat
5. **Trust the tests** - If tests pass, the feature works

---

## Next Steps

1. Run `full-game.test.ts` to find next bugs
2. Fix bugs revealed by tests
3. Add more test scenarios as needed
4. Achieve 100% test coverage of game logic

**The framework is ready. Let the tests guide your debugging!**

