# Database Connection Analysis

## Connection Pool Configuration
- **Max Connections**: 500 (`connection_limit=500`)
- **Pool Timeout**: 60 seconds (`pool_timeout=60`)
- **Prisma Client**: Singleton instance (shared connection pool)

## When a Round Completes (Single Game)

### Step-by-Step Connection Usage:

1. **5th trick card is played**
   - `executeGameAction()` is called once
   - Inside: `applyCardPlay()` → `finishRound()`
   - **1 database operation scheduled** (debounced, 500ms delay)

2. **After 500ms debounce**
   - `saveGameState()` executes
   - **1 Prisma connection used**: `prisma.gameState.upsert()`
   - Connection is released immediately after operation

**Total for single round completion: 1 connection**

## Multiple Games Completing Simultaneously

If N games complete rounds at the same time:
- Each game: 1 debounced save (after 500ms)
- **Total concurrent connections: N** (one per game)
- All happen ~500ms after their respective round completions

**Example**: 10 games complete rounds → 10 concurrent connections (well under 500 limit)

## During Graceful Shutdown

`persistAllActiveGames()` is called:
- Loops through all active games **sequentially** (not concurrent)
- Each game: 1 `saveGameState()` = 1 connection
- **Total**: N connections, but **sequential** (one at a time)

**Example**: 10 active games → 10 connections, but executed one after another

## Other Database Operations

### On Server Startup:
- `loadActiveGamesFromDatabase()`: 
  - 1 query: `prisma.game.findMany()` (with include)
  - Then N queries: `prisma.gameState.findUnique()` (one per game)
  - **Total**: 1 + N connections (sequential)

### Stats Operations (Currently Disabled):
- Stats code is commented out, so **0 connections** from stats

## Maximum Concurrent Connections Scenario

**Worst case**: Many games completing rounds simultaneously
- 50 games complete rounds at once
- Each schedules a debounced save (500ms delay)
- After 500ms: 50 concurrent `upsert` operations
- **50 connections** (still only 10% of 500 limit)

## Why the Debounce Fix Works

**Before debounce**:
- Each `executeGameAction` immediately scheduled a save
- Rapid state changes (e.g., round completion → next round start) could trigger multiple saves
- If a round completes and immediately starts next round:
  - Round completion: 1 save
  - Next round start: 1 save
  - **Total: 2 connections** for rapid transitions

**After debounce (500ms)**:
- Multiple rapid state changes cancel previous timers
- Only the **latest** state is saved after 500ms of no changes
- **Total: 1 connection** per game, regardless of how many state changes happen

## Connection Pool Exhaustion Risk

**Current risk**: Very low
- Max concurrent: ~50-100 games completing simultaneously (unlikely)
- Pool size: 500 connections
- Safety margin: 5-10x

**Previous risk (before debounce)**:
- Rapid state changes could trigger 2-3 saves per game
- 100 games × 3 saves = 300 connections (still under 500, but closer to limit)
- **But**: If saves were happening synchronously during `executeGameAction`, they could block and cause timeouts

## Summary

- **Per round completion**: 1 connection (after 500ms debounce)
- **Concurrent games**: N connections (one per game)
- **Pool limit**: 500 connections
- **Safety margin**: 5-10x under normal load
- **Debounce prevents**: Multiple saves from rapid state transitions



