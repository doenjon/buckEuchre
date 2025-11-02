# Statistics System Debug Changes

## Changes Made

### 1. Reverted Incorrect Fix
**File**: `backend/src/sockets/game.ts`
- Reverted `pointsEarned` calculation from `Math.max(0, -scoreChange)` back to `-scoreChange`
- **Reason**: In Buck Euchre, we need to track both positive and negative outcomes for accurate statistics
  - When score decreases (good): scoreChange is negative, so `-scoreChange` is positive (points earned)
  - When score increases (got euchred): scoreChange is positive, so `-scoreChange` is negative (points lost)
  - This accurately reflects the player's performance including failures

### 2. Added Comprehensive Logging

#### In `backend/src/sockets/game.ts`:

**`buildRoundCompletionPayload()` function:**
- Logs when called with phase information
- Logs when returning null (not in ROUND_OVER or GAME_OVER phase)
- Logs when returning null (no round updates)
- Logs the built payload with round updates
- Logs when game updates are added
- Logs when returning the final payload

**`persistRoundCompletionStats()` function:**
- Logs when called with payload info (count of round/game updates)
- Logs when no tasks to execute
- Logs before executing tasks
- Logs each failed task with error
- Logs completion summary (succeeded vs failed)

#### In `backend/src/services/stats.service.ts`:

**`updateRoundStats()` function:**
- Logs when called with all round stats data
- Logs current stats before update
- Logs the updates being applied
- Logs successful completion
- Now throws error instead of silently catching (so we see failures in parent function)

**`updateGameStats()` function:**
- Logs when called with game stats data
- Logs current stats before update
- Logs the updates being applied
- Logs successful completion
- Now throws error instead of silently catching (so we see failures in parent function)

### 3. Field Name Mapping (Already Present)
**File**: `backend/src/api/auth.routes.ts`
- Maps `tricksWon` database field to `totalTricksTaken` for frontend compatibility
- This was already done in a previous commit

## How to Debug

### 1. Start Backend with Logging
```bash
cd backend
npm run dev
```

### 2. Play a Complete Game
- Join or create a game
- Play through at least one complete round
- Watch the backend logs

### 3. Interpret the Logs

**Expected Log Flow for a Successful Round Completion:**

```
[FOLD_DECISION] or [PLAY_CARD] event triggers round end
  ↓
[STATS BUILD] Called with phases: { prePhase: 'PLAYING', postPhase: 'ROUND_OVER', gameOver: false }
  ↓
[STATS BUILD] Built payload with 4 round updates: [...]
  ↓
[STATS BUILD] Returning payload
  ↓
[FOLD_DECISION] or [PLAY_CARD] Persisting stats for round completion
  ↓
[STATS PERSIST] Called with: { roundUpdates: 4, gameUpdates: 0 }
  ↓
[STATS PERSIST] Executing 4 tasks
  ↓
[updateRoundStats] Called for user xxx with stats: {...}
[updateRoundStats] Current stats for user xxx: {...}
[updateRoundStats] Applying updates for user xxx: {...}
[updateRoundStats] Successfully updated stats for user xxx
(repeated for each of 4 players)
  ↓
[STATS PERSIST] Complete: 4 succeeded, 0 failed
```

**Expected Log Flow for Game Completion:**

Same as above, but also includes:
```
[STATS BUILD] Added game updates: [...]
[STATS PERSIST] Called with: { roundUpdates: 4, gameUpdates: 4 }
[STATS PERSIST] Executing 8 tasks
(updateRoundStats for each player)
(updateGameStats for each player)
[STATS PERSIST] Complete: 8 succeeded, 0 failed
```

### 4. Identify Issues

**If you see `[STATS BUILD] Returning null - not in ROUND_OVER or GAME_OVER phase`:**
- The round is not transitioning to ROUND_OVER/GAME_OVER properly
- Check the game state machine logic in `finishRound()` or `applyFoldDecision()`

**If you see `[STATS BUILD] Returning null - no round updates`:**
- Players don't have user IDs (maybe AI players)
- Or roundUpdates array is being filtered to empty

**If you don't see `[STATS BUILD]` logs at all:**
- `buildRoundCompletionPayload()` is not being called
- Check that the round is ending properly

**If you see `[STATS PERSIST] Failed to persist`:**
- Database connection issue
- User stats not found in database
- Check the error details in the log

**If stats appear but are wrong values:**
- Check the values in `[updateRoundStats] Applying updates`
- Verify the calculation logic in `buildRoundCompletionPayload()`

## Known Issues to Watch For

### 1. User IDs
- AI players might not have user IDs, so they won't get stats
- Guest users should have stats tracked

### 2. Database State
- Verify UserStats records exist for all players:
  ```sql
  SELECT u.username, us.* 
  FROM "User" u 
  LEFT JOIN "UserStats" us ON u.id = us."userId";
  ```

### 3. Async Void
- Stats persistence uses `void persistRoundCompletionStats()`
- Errors won't block gameplay but will be logged
- Check logs for errors even if game continues

## Testing Checklist

- [ ] Start backend with logging enabled
- [ ] Play a complete round (4 players)
- [ ] Verify `[STATS BUILD]` logs appear
- [ ] Verify `[STATS PERSIST]` logs show success
- [ ] Verify `[updateRoundStats]` called 4 times
- [ ] Check profile page shows updated stats
- [ ] Play to game completion
- [ ] Verify `[updateGameStats]` called for game end
- [ ] Verify win/loss recorded correctly
- [ ] Check total points, tricks taken, bid rate

## Next Steps

Once logging reveals the issue:
1. If stats ARE being persisted but values are wrong → Fix calculation logic
2. If stats are NOT being persisted → Fix the database/service issue
3. If buildRoundCompletionPayload returns null → Fix game state transitions
4. If persistRoundCompletionStats isn't called → Fix the event handlers
