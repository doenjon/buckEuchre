ome file# State Management Architecture

## Overview

This document explains how Buck Euchre handles concurrent state mutations safely without race conditions.

## The Problem

In a real-time multiplayer game, multiple players can act simultaneously:
- Player A plays a card
- Player B plays a card 
- Both WebSocket events arrive at nearly the same time

Without proper handling, this causes **race conditions**:
```
Time 0: State = { currentTrick: [card1] }
Time 1: Handler A reads state → currentTrick: [card1]
Time 2: Handler B reads state → currentTrick: [card1]
Time 3: Handler A writes state → currentTrick: [card1, cardA]
Time 4: Handler B writes state → currentTrick: [card1, cardB]  ❌ cardA lost!
```

## The Solution: Action Queue per Game

### Architecture

```typescript
// In-memory stores
const activeGames = new Map<string, GameState>();
const gameActionQueues = new Map<string, Promise<void>>();

// Core function: serialize all actions for a game
export async function executeGameAction<T>(
  gameId: string,
  action: (currentState: GameState) => Promise<GameState>
): Promise<GameState> {
  // Get existing queue or start new one
  const currentQueue = gameActionQueues.get(gameId) || Promise.resolve();
  
  // Chain this action to the queue
  const newQueue = currentQueue
    .then(async () => {
      // Get current state
      const state = activeGames.get(gameId);
      if (!state) throw new Error('Game not found');
      
      // Execute action (pure function)
      const newState = await action(state);
      
      // Update in-memory state
      activeGames.set(gameId, newState);
      
      // Persist to database (fire-and-forget for performance)
      saveGameState(gameId, newState).catch(err => 
        console.error('Failed to persist game state:', err)
      );
      
      return newState;
    });
  
  // Update queue
  gameActionQueues.set(gameId, newQueue);
  
  // Return when this action completes
  return newQueue;
}
```

### How It Works

1. **Each game has its own Promise chain** (the queue)
2. **New actions append to the chain** using `.then()`
3. **Actions execute sequentially** for that game
4. **Different games process in parallel** (separate queues)

### Example: Two Simultaneous Card Plays

```
Time 0: State = { currentTrick: [card1] }
Time 1: Player A action arrives → added to queue → Position 1
Time 2: Player B action arrives → added to queue → Position 2
Time 3: Action A executes:
        - Reads: currentTrick: [card1]
        - Returns: currentTrick: [card1, cardA]
        - Writes: currentTrick: [card1, cardA]
Time 4: Action B executes:
        - Reads: currentTrick: [card1, cardA]  ✓ sees A's card
        - Validation: "Not your turn!" ✓ correct behavior
        - Throws error
```

## Usage Pattern

### In WebSocket Handlers

```typescript
socket.on('PLAY_CARD', async (payload) => {
  try {
    const validated = playCardSchema.parse(payload);
    
    // Execute through queue
    const newState = await executeGameAction(
      validated.gameId,
      async (currentState) => {
        // Validate against current state
        const validation = canPlayCard(currentState, validated);
        if (!validation.valid) {
          throw new ValidationError(validation.reason);
        }
        
        // Apply pure function
        return applyCardPlay(currentState, validated);
      }
    );
    
    // Broadcast result
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'CARD_PLAYED'
    });
    
  } catch (error) {
    socket.emit('ERROR', { 
      code: 'PLAY_CARD_FAILED', 
      message: error.message 
    });
  }
});
```

### Key Rules

1. **All state mutations** must go through `executeGameAction()`
2. **Action functions must be pure** (no side effects)
3. **Validation happens inside the action** (sees current state)
4. **Never mutate state directly** - always return new state

## Benefits

### ✅ Race Condition Prevention
- Actions are serialized per game
- Each action sees consistent state
- No lost updates

### ✅ Simplicity
- No locks, mutexes, or transactions needed
- Uses native JavaScript Promise chaining
- Easy to reason about

### ✅ Performance
- Different games process in parallel
- No global lock (only per-game)
- Database writes are async (don't block)

### ✅ Correctness
- Validation always sees latest state
- Turn-based logic works correctly
- No subtle timing bugs

## Database Persistence

### Strategy

```typescript
// Inside executeGameAction:
const newState = await action(state);
activeGames.set(gameId, newState);  // ← SOURCE OF TRUTH (in-memory)

// Fire-and-forget (don't await) - database is backup only
saveGameState(gameId, newState).catch(err => 
  console.error('Failed to persist:', err)
);
```

### Rationale

- **In-memory Map is SOURCE OF TRUTH** (fast, real-time reads/writes)
- **Database is BACKUP ONLY** (for recovery after server restart)
- **Async writes** (don't slow down gameplay)
- **Error logging** (monitor persistence failures)
- **No database reads during gameplay** (all reads from memory)

### Recovery After Server Restart

If server crashes/restarts:
1. On startup: Load active games from database into memory
2. Restore in-memory Map (activeGames) from database
3. Players reconnect via WebSocket
4. Game continues from last persisted state

Note: There may be a small gap between last action and crash (fire-and-forget writes),
      but this is acceptable for MVP. Add transaction log for production if needed.

## Testing Race Conditions

### Test Case

```typescript
describe('Race Condition Prevention', () => {
  it('should handle simultaneous card plays', async () => {
    // Setup: Two players ready to play
    const gameId = 'test-game';
    const state = createTestGameState({ 
      phase: 'PLAYING',
      currentPlayerPosition: 0 
    });
    setActiveGameState(gameId, state);
    
    // Act: Both players try to play at the same time
    const promises = [
      executeGameAction(gameId, (s) => applyCardPlay(s, { playerPosition: 0, cardId: 'A' })),
      executeGameAction(gameId, (s) => applyCardPlay(s, { playerPosition: 1, cardId: 'B' }))
    ];
    
    const results = await Promise.allSettled(promises);
    
    // Assert: One succeeds, one fails with "not your turn"
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[1].reason.message).toContain('not your turn');
    
    // Assert: State is consistent
    const finalState = getActiveGameState(gameId);
    expect(finalState.currentTrick.cards.length).toBe(1);
  });
});
```

## Alternatives Considered

### ❌ Redis with Atomic Operations
- **Pro:** Works across multiple servers
- **Con:** Adds complexity and infrastructure
- **Verdict:** Overkill for single-server MVP

### ❌ Database Transactions
- **Pro:** ACID guarantees
- **Con:** Slow (network latency)
- **Con:** Doesn't prevent application-level races
- **Verdict:** Wrong tool for this problem

### ❌ Explicit Locks
- **Pro:** Traditional approach
- **Con:** Deadlock risk
- **Con:** More complex than Promise chaining
- **Verdict:** Unnecessary complexity

### ✅ Action Queue (Chosen)
- **Pro:** Simple and correct
- **Pro:** No new dependencies
- **Pro:** Leverages Node.js strengths
- **Con:** Single server only (acceptable for MVP)

## Future Scaling

If moving to multiple servers:
1. Add Redis for shared state
2. Use Redis pub/sub for events
3. Keep action queue pattern (per server)
4. Use Redis locks for cross-server coordination

But for MVP with single server: **current approach is optimal**.

## Summary

- **Problem:** Race conditions on concurrent actions
- **Solution:** Action queue per game
- **Implementation:** Promise chaining in `executeGameAction()`
- **Result:** Safe, fast, simple state management

All game state mutations flow through a single, ordered pipeline per game. This guarantees correctness without sacrificing performance.

