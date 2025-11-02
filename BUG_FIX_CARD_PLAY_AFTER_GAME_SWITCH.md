# Bug Fix: Card Play Prevented After Switching Games

## Issue Description

**Reported Bug**: After quitting a game (using lobby delete button) and joining a new game, winning the bidding prevented playing the first card.

## Root Cause

A **race condition** in the frontend state management when switching between games:

1. User leaves Game A → `clearGame()` resets `myPosition` to `null` and `gameState` to `null`
2. User joins Game B → Socket emits `JOIN_GAME`
3. New game state for Game B arrives → `setGameState()` updates `gameState`
4. **Problem**: `myPosition` is set in a separate `useEffect` that runs AFTER the state update
5. When user tries to play a card, `isMyTurn()` checks `currentPlayerPosition === myPosition`
6. Since `myPosition` hasn't been set yet (or contains stale data), the check fails
7. Result: Cards are disabled even though it's the player's turn

## The Fix

Modified `frontend/src/stores/gameStore.ts` to detect game ID changes and automatically reset `myPosition`:

```typescript
setGameState: (gameState) => {
  const currentState = get().gameState;
  const currentPosition = get().myPosition;
  
  // If switching to a different game, reset myPosition to prevent stale data
  if (currentState && currentState.gameId !== gameState.gameId) {
    console.log('[GameStore] Switching games, resetting myPosition', {
      oldGameId: currentState.gameId,
      newGameId: gameState.gameId,
      oldPosition: currentPosition
    });
    set({ gameState, myPosition: null, error: null, waitingInfo: null });
  } else {
    set({ gameState, error: null, waitingInfo: null });
  }
}
```

## How It Works

1. When a new game state arrives, compare its `gameId` with the current game's `gameId`
2. If they differ (switching games), reset `myPosition` to `null` along with the new state
3. This triggers the `GamePage` useEffect to find and set the correct position
4. The new position is set atomically with the game state, preventing stale data

## Benefits

- ✅ Prevents stale position data from previous games
- ✅ Ensures `myPosition` is always correct for the current game
- ✅ Maintains proper turn detection when switching games
- ✅ Preserves `myPosition` during normal game state updates (same game)

## Testing

Added comprehensive tests in `frontend/src/stores/__tests__/gameStore.test.ts`:

1. **Test: Resets myPosition when switching to different game**
   - Verifies `myPosition` becomes `null` when `gameId` changes
   
2. **Test: Preserves myPosition when updating same game**
   - Verifies `myPosition` stays unchanged during normal updates

## Files Changed

- `frontend/src/stores/gameStore.ts` - Added game ID comparison logic
- `frontend/src/stores/__tests__/gameStore.test.ts` - Added tests

## Resolution

This fix ensures that after quitting one game and joining another, the player's turn detection works correctly and they can play cards when it's their turn.
