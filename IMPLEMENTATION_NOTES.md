# Implementation Notes

**Last Updated:** 2025-10-04

## Critical Design Decisions

### 1. Source of Truth: In-Memory

**Decision:** In-memory Map is the source of truth for active game state.

**Rationale:**
- Real-time game requires fast reads/writes
- WebSocket broadcasts need instant access to state
- Database is too slow for real-time gameplay

**Implementation:**
- `activeGames` Map holds current state (source of truth)
- Database saves are async fire-and-forget (backup only)
- On server restart: load from database into memory
- During gameplay: never read from database

**Where This Matters:**
- Task 3.4: State Service implementation
- Task 4.3: WebSocket handlers (read from memory)
- Task 6.3: Reconnection (send in-memory state)

---

### 2. Blind Cards and Turn-Up Card

**Decision:** Blind contains 4 cards, turnUpCard is blind[0] (a reference, not separate).

**Clarification:**
- After dealing 5 cards to each player (20 cards), 4 remain
- These 4 cards go into the `blind` array
- `turnUpCard = blind[0]` (the top card is revealed)
- All 4 blind cards (including the turned-up one) are never played
- They remain set aside for the entire round
- The turned-up card is visible only for information (Clubs rule)

**Implementation:**
```typescript
// In dealNewRound():
const { hands, blind } = dealCards(shuffledDeck);
// blind is array of 4 cards

gameState.blind = blind;
gameState.turnUpCard = blind[0];  // Reference to top card
gameState.isClubsTurnUp = blind[0].suit === 'CLUBS';
```

---

### 3. All Players Pass Scenario

**Decision:** If all players pass during bidding:
1. Rotate dealer: `dealerPosition = (dealerPosition + 1) % 4`
2. No scoring changes (no one gains or loses points)
3. Transition back to DEALING phase
4. Deal new round

**Implementation:**
```typescript
export function handleAllPlayersPass(state: GameState): GameState {
  return {
    ...state,
    dealerPosition: (state.dealerPosition + 1) % 4,
    phase: 'DEALING',
    bids: [],
    currentBidder: null,
    highestBid: null,
    winningBidderPosition: null,
    trumpSuit: null,
    // Trigger new deal on next state update
  };
}
```

---

### 4. Memory Cleanup

**Decision:** Add cleanup function to prevent memory leaks.

**Implementation:**
```typescript
// In state.service.ts
export function cleanupGameState(gameId: string): void {
  activeGames.delete(gameId);
  gameActionQueues.delete(gameId);
}

// Call when:
// - Game ends (winner reaches 0)
// - Game abandoned (all players leave)
// - After 24 hours of inactivity
```

---

### 5. Race Condition Prevention

**Pattern:** Action queue per game (Promise chaining).

**Why:**
- Simple and correct
- No locks needed
- Per-game isolation (games don't block each other)
- Sequential processing ensures consistent state

**See:** STATE_MANAGEMENT.md for full details

---

## Common Pitfalls to Avoid

### ❌ Don't read from database during gameplay
**Wrong:**
```typescript
const state = await prisma.gameState.findUnique({ where: { gameId } });
```

**Right:**
```typescript
const state = getActiveGameState(gameId);  // From memory
```

### ❌ Don't mutate state directly
**Wrong:**
```typescript
gameState.currentTrick.cards.push(card);
```

**Right:**
```typescript
return {
  ...gameState,
  currentTrick: {
    ...gameState.currentTrick,
    cards: [...gameState.currentTrick.cards, card]
  }
};
```

### ❌ Don't await database saves in game flow
**Wrong:**
```typescript
await saveGameState(gameId, newState);  // Blocks gameplay
```

**Right:**
```typescript
saveGameState(gameId, newState).catch(err => console.error(err));
```

---

## Questions & Answers

### Q: What if database save fails?
**A:** Log the error. Game continues in memory. State may be lost if server crashes before next successful save. This is acceptable for MVP.

### Q: What if two players act at the exact same millisecond?
**A:** Action queue serializes them. Second action sees first action's result. Validation will catch invalid moves.

### Q: Do we need Redis?
**A:** Not for MVP (single server). Consider for production if scaling to multiple servers.

### Q: What about player scores in database?
**A:** GameState.players[].score is source of truth. Optionally sync to GamePlayer.score after each round for statistics.

---

## Document Update Log

- **2025-10-04:** Initial creation
  - Clarified in-memory as source of truth
  - Clarified blind/turnUpCard relationship
  - Added all-players-pass handling
  - Added memory cleanup requirement


