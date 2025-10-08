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

## Known Shortcuts & Technical Debt

This section documents intentional compromises made for MVP speed. These are **not mistakes** - they are deliberate trade-offs.

### 1. Fire-and-Forget Database Writes

**What we're doing:**
```typescript
saveGameState(gameId, newState).catch(err => console.error(err));
// Don't await - game continues
```

**Why it's not optimal:**
- If database save fails, state could be lost on server crash
- No guarantee of data persistence
- Silent failures (only logged)

**Why we're doing it anyway:**
- Real-time performance is critical
- Waiting for DB writes adds 10-50ms latency per action
- For MVP, losing a game on crash is acceptable
- Single server makes this reliable enough

**When to fix:**
- Production: Add write-ahead log (WAL)
- Or: Use Redis with AOF persistence
- Or: Batch writes every 5 seconds

---

### 2. No Transaction Log / Event Sourcing

**What we're doing:**
- Storing full game state snapshots
- No history of individual actions

**Why it's not optimal:**
- Can't replay game to debug issues
- Can't recover from partial corruption
- No audit trail for disputes

**Why we're doing it anyway:**
- Event sourcing adds complexity
- MVP doesn't need replay/audit features
- Simpler to implement and reason about

**When to fix:**
- Phase 8: Add optional event logging to Round table
- Post-MVP: Full event sourcing if needed

---

### 3. Simple Error Messages (MVP)

**What we're doing (Phase 1-5):**
```typescript
socket.emit('ERROR', { message: 'Invalid move' });
```

**Why it's not optimal:**
- No error codes for client to parse
- Can't internationalize
- Hard to handle programmatically

**Why we're doing it anyway:**
- Faster to implement
- Good enough for MVP testing
- Structured errors added in Phase 6

**When fixed:** Phase 6, Task 6.2

---

### 4. No Client-Side Validation (MVP)

**What we're doing (Phase 1-5):**
- Client sends action
- Server validates
- Server rejects if invalid
- Round trip for every validation error

**Why it's not optimal:**
- Slower UX (network round trip)
- Unnecessary server load
- Players see cards "bounce back"

**Why we're doing it anyway:**
- Server must validate anyway (security)
- Duplicate validation logic is error-prone
- MVP focuses on working game, not polish

**When fixed:** Phase 6, Task 6.6

---

### 5. No Grace Period for Disconnection (MVP)

**What we're doing (Phase 1-5):**
- Player disconnects → immediately marked offline
- Game continues (if possible)

**Why it's not optimal:**
- Brief network hiccup ruins game
- No buffer for mobile switching between WiFi/cellular
- Poor UX

**Why we're doing it anyway:**
- Grace period logic is complex
- Need to handle "what if they don't come back?"
- MVP proves core gameplay first

**When fixed:** Phase 6, Task 6.3 (30-second grace period)

---

### 6. Manual Testing Only (MVP)

**What we're doing (Phase 1-5):**
- Open 4 browser tabs
- Manually play through game
- No automated tests

**Why it's not optimal:**
- Regressions won't be caught
- No CI/CD pipeline
- Time-consuming to test

**Why we're doing it anyway:**
- Writing tests takes time
- Game logic tests come in Phase 2 (Task 2.7)
- Integration tests in Phase 8
- Manual testing validates UX better for MVP

**When fixed:** Phase 2 (unit tests), Phase 8 (integration tests)

---

### 7. No State Versioning (MVP)

**What we're doing (Phase 1-5):**
```typescript
io.to(game).emit('GAME_STATE_UPDATE', { gameState });
// No version number
```

**Why it's not optimal:**
- Out-of-order WebSocket messages could cause issues
- Clients might apply stale updates
- Race conditions on client side

**Why we're doing it anyway:**
- WebSocket guarantees order (usually)
- Extra complexity for MVP
- In practice, rarely a problem

**When fixed:** Phase 6, Task 6.4

---

### 8. Join Game By URL Only (MVP)

**What we're doing (Phase 1-5):**
- Creator shares game URL manually
- No in-app lobby/game list

**Why it's not optimal:**
- Poor discoverability
- Can't browse available games
- Requires out-of-band communication

**Why we're doing it anyway:**
- Lobby adds UI complexity
- MVP is for playing with friends (they have the link)
- Simpler MVP flow

**When fixed:** Phase 7, Task 7.1

---

### 9. No Docker for Development (MVP)

**What we're doing (Phase 1-5):**
- Local Node.js installation
- PostgreSQL in Docker (or local)
- Manual setup

**Why it's not optimal:**
- "Works on my machine" problems
- Inconsistent environments
- Harder for new contributors

**Why we're doing it anyway:**
- Faster development (no container overhead)
- Most developers have Node.js
- Docker adds layer of complexity

**When fixed:** Phase 9, Task 9.1

---

### 10. Single Server / No Horizontal Scaling

**What we're doing:**
- In-memory Map on single server
- No Redis or distributed state

**Why it's not optimal:**
- Can't scale beyond one server
- Server restart loses active games
- No load balancing

**Why we're doing it anyway:**
- MVP targets 10-20 concurrent users
- Single server handles this easily
- Distributed systems add massive complexity
- Action queue pattern works perfectly for single server

**When to fix:**
- Only if you exceed ~100 concurrent games
- Then: Add Redis, Socket.io Redis adapter, load balancer

---

### 11. Console.log Instead of Proper Logging

**What we're doing:**
```typescript
console.log('Player joined:', playerId);
console.error('Failed to save state:', err);
```

**Why it's not optimal:**
- No log levels in production
- Can't filter or search logs easily
- No structured logging
- No log aggregation

**Why we're doing it anyway:**
- Simple and works
- Every environment has console
- Good enough for MVP debugging

**When to fix:**
- Phase 9: Add winston or pino
- Production: Add log aggregation (CloudWatch, etc.)

---

### 12. No Rate Limiting

**What we're doing:**
- Accept all requests
- No throttling

**Why it's not optimal:**
- Vulnerable to spam/DoS
- Player could spam actions
- No protection

**Why we're doing it anyway:**
- MVP is for trusted friends
- Not public-facing yet
- Adds complexity

**When to fix:**
- Phase 6 or 9 (production hardening)
- Use express-rate-limit

---

### 13. JWT Secrets in .env File

**What we're doing:**
```env
JWT_SECRET="some_random_string"
```

**Why it's not optimal:**
- Should use secrets manager (AWS Secrets Manager, etc.)
- Secrets committed to git if not careful
- No rotation

**Why we're doing it anyway:**
- Simple for MVP
- Adequate for small-scale deployment
- .env is gitignored

**When to fix:**
- Production deployment to AWS/GCP: Use secrets manager
- For now: Ensure .env is never committed

---

### 14. No Database Connection Pooling Configuration

**What we're doing:**
- Using Prisma defaults

**Why it's not optimal:**
- Not tuned for workload
- Might hit connection limits under load

**Why we're doing it anyway:**
- Prisma defaults are sensible
- MVP won't hit limits
- Premature optimization

**When to fix:**
- If you see connection errors
- Phase 9: Configure pool size

---

### 15. No Metrics / Monitoring

**What we're doing:**
- No dashboards
- No alerts
- No performance tracking

**Why it's not optimal:**
- Can't detect issues proactively
- No visibility into performance
- Hard to debug production issues

**Why we're doing it anyway:**
- Monitoring adds overhead
- MVP doesn't need this
- Can check logs manually

**When to fix:**
- Phase 9: Add basic healthchecks
- Post-MVP: Add Prometheus/Grafana or CloudWatch

---

## Summary: We Know It's Not Perfect

**These shortcuts are intentional.** The goal is:
1. **Get MVP working in 4 weeks**
2. **Prove the game is fun**
3. **Then add polish**

If an AI agent sees something that seems "wrong" or "not best practice," check this list first. It might be a deliberate trade-off for speed.

**Rule of thumb:** If it's in this list, implement it as documented (even if suboptimal). If it's NOT in this list and seems wrong, it might be a real bug - flag it.

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

## Feature Feasibility Notes (2025-01-14)

### Automatically seat invitees as guests

- **Current behavior:** The share link generated in `WaitingForPlayers` simply deep-links to `/game/:gameId` and expects the visitor to already have an auth token.【F:frontend/src/components/game/WaitingForPlayers.tsx†L34-L70】 When an unauthenticated visitor hits that route, `GamePage` immediately redirects them back to the landing page because `checkAuth()` fails before any socket join occurs.【F:frontend/src/pages/GamePage.tsx†L18-L42】
- **Effort:** _Low-to-moderate (≈1 day)._ The frontend already exposes `loginAsGuest()` which provisions a 24-hour token via `POST /api/auth/guest`; we could trigger that flow automatically when a visitor lands on a game route without credentials.【F:frontend/src/hooks/useAuth.ts†L28-L56】【F:backend/src/api/auth.routes.ts†L41-L74】 The main work is UX polish (loading screen, error state if the table is full) and making sure we do not create orphan guest records on every refresh.
- **Gotchas:** We need to guard against auto-joining full tables (`joinGame` will throw) and ensure the socket only attempts to join after the guest token has been stored (otherwise the middleware rejects the connection). A simple approach is to gate `GamePage` rendering until `loginAsGuest` resolves and then let the existing `joinGame(gameId)` effect run.【F:frontend/src/hooks/useGame.ts†L13-L42】【F:backend/src/services/game.service.ts†L94-L186】

### Let a guest claim their seat with an existing account

- **Current behavior:** A “real” player session is just another JWT issued by `createPlayer`; there is no passworded account concept today. Once a guest joins a table, every place the game state tracks identity (Prisma `gamePlayer` rows, the in-memory `GameState.players` array, and active socket rooms) uses the guest’s generated `playerId`.【F:backend/src/services/player.service.ts†L15-L86】【F:backend/src/services/game.service.ts†L94-L174】【F:shared/src/types/game.ts†L60-L104】
- **Effort:** _Moderate (≈2-3 days)._ Allowing a guest to “log in” mid-session requires a server-side mutation that swaps the seat over to a newly created authenticated player (or reuses an existing ID) without breaking the running game. That implies: issuing a fresh token, updating the `gamePlayer` record, patching the in-memory `GameState` player entry, and notifying connected clients so their local stores replace the guest metadata.
- **Gotchas:** We must rebind the socket connection because the namespace auth middleware keyes sessions by token. The swap also needs to propagate to action queues and AI helpers that cache player IDs, so the update function should be part of `game.service` to touch every layer safely. Frontend UX would likely surface a “Claim seat” dialog that calls the new endpoint, handles token replacement, and reloads socket listeners without kicking the player from the table.

## Document Update Log

- **2025-10-04:** Initial creation
  - Clarified in-memory as source of truth
  - Clarified blind/turnUpCard relationship
  - Added all-players-pass handling
  - Added memory cleanup requirement


