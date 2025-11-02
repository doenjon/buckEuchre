# Bug Fix: Skipped Game Phases After All Players Fold

## Issue
When all players fold in a round, the next round would skip bidding and folding phases completely, causing the game to enter an incorrect state.

## Root Cause
The `startNextRound()` function was not clearing round-specific state when transitioning from ROUND_OVER to DEALING phase. It only updated two fields:
- `phase` → 'DEALING'
- `dealerPosition` → rotated to next player

This left stale data from the previous round:
- `trumpSuit` (e.g., 'HEARTS' from previous round)
- `winningBidderPosition` (position from previous round)
- `highestBid` (bid amount from previous round)
- `bids` array (all bids from previous round)
- Player states: `folded`, `foldDecision`, `tricksTaken`, `hand`

While `dealNewRound()` is supposed to overwrite these fields, any interruption between the two function calls (e.g., database save/load, server restart, error handling) could leave the game in an inconsistent state with stale data.

## Solution
Enhanced `startNextRound()` to properly clear ALL round-specific state when transitioning to DEALING phase:

```typescript
export function startNextRound(state: GameState): GameState {
  // ... validation ...
  
  const newDealerPosition = ((state.dealerPosition + 1) % 4) as PlayerPosition;
  
  // Reset player states for new round
  const players = state.players.map(p => ({
    ...p,
    hand: [],
    tricksTaken: 0,
    folded: false,
    foldDecision: 'UNDECIDED' as const,
  })) as [Player, Player, Player, Player];
  
  return withVersion(state, {
    phase: 'DEALING',
    dealerPosition: newDealerPosition,
    
    // Clear all round-specific state
    players,
    blind: [],
    turnUpCard: null,
    isClubsTurnUp: false,
    bids: [],
    currentBidder: null,
    highestBid: null,
    winningBidderPosition: null,
    trumpSuit: null,
    tricks: [],
    currentTrick: {
      number: 0,
      leadPlayerPosition: 0 as PlayerPosition,
      cards: [],
      winner: null,
    },
    currentPlayerPosition: null,
  });
}
```

## Changes Made
- **File**: `backend/src/game/state.ts`
- **Function**: `startNextRound()`
- **Impact**: Now properly resets ALL round-specific state to ensure clean transition between rounds

## Testing
Verified that:
1. Player fold states are cleared (`folded: false`, `foldDecision: 'UNDECIDED'`)
2. Bidding state is cleared (`trumpSuit: null`, `bids: []`, `winningBidderPosition: null`)
3. Multiple rounds can be played in succession without state contamination
4. Both manual and auto-start next round work correctly
5. JSON serialization/deserialization maintains correct state

## Benefits
1. **Robustness**: Eliminates potential for stale state between round transitions
2. **Data Integrity**: Ensures clean state even if errors occur between `startNextRound()` and `dealNewRound()`
3. **Database Safety**: State saved to database after `startNextRound()` is now fully clean
4. **Predictability**: DEALING phase always has consistent, expected state

## Related Code Paths
- Manual start: `handleStartNextRound()` in `backend/src/sockets/game.ts`
- Auto-start: `scheduleAutoStartNextRound()` in `backend/src/services/round.service.ts`
- Both code paths now benefit from the cleaner state transition
