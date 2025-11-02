# Multi-Game Support - Implementation Analysis

## Current State: Single Game Per Player

The system is **intentionally designed** for one active game per player. This is enforced at multiple levels.

---

## Required Changes

### 🔴 Backend Changes (Major)

#### 1. **Database & Schema** (Low effort - 1-2 hours)
**Status:** ✅ Already supports it!

The schema has NO unique constraints preventing multiple games:
- `GamePlayer` table allows multiple rows per `userId`
- Only unique constraint is `[gameId, position]` (each position in a game must be unique)

**Changes needed:** None! Just remove the validation checks.

#### 2. **Game Service Validation** (Medium effort - 2-3 hours)

**Files to modify:**
- `backend/src/services/game.service.ts`

**Changes:**
```typescript
// REMOVE these checks (lines 48-62, 119-133):
const existingGame = await prisma.gamePlayer.findFirst({
  where: {
    userId: creatorId,
    game: {
      status: { in: [GameStatus.WAITING, GameStatus.IN_PROGRESS] }
    }
  }
});

if (existingGame) {
  throw new Error('User is already in an active game'); // DELETE THIS
}
```

**Add instead:**
- Check player isn't already in THIS specific game (prevent double-joining)
- Limit max concurrent games (e.g., 5 games) to prevent abuse

#### 3. **Connection Service** (High effort - 4-6 hours)

**Files to modify:**
- `backend/src/services/connection.service.ts`

**Current issue:**
```typescript
interface PlayerConnection {
  playerId: string;
  socketId: string;
  gameId: string | null;  // ❌ Single game only!
  connectedAt: Date;
  lastSeenAt: Date;
}
```

**Needed changes:**
```typescript
interface PlayerConnection {
  playerId: string;
  socketId: string;
  gameIds: Set<string>;  // ✅ Multiple games!
  connectedAt: Date;
  lastSeenAt: Date;
}

// Update all methods:
- updateConnectionGame(playerId, gameId) → addGameToConnection(playerId, gameId)
- Add: removeGameFromConnection(playerId, gameId)
- getPlayerGameId(playerId) → getPlayerGameIds(playerId): string[]
```

**Impact:** ~15 function calls throughout codebase need updating

#### 4. **Socket Room Management** (Low effort - 1 hour)

**Files to modify:**
- `backend/src/sockets/game.ts`

**Current:** Player joins one room at a time
**Needed:** Player can be in multiple socket rooms simultaneously

**Change:**
```typescript
// JOIN_GAME - already works! Socket.io supports multiple rooms
socket.join(`game:${gameId}`);  // Can be called multiple times

// LEAVE_GAME - already works!
socket.leave(`game:${gameId}`);
```

**No changes needed!** Socket.io already supports this.

---

### 🟡 Frontend Changes (Moderate)

#### 5. **Store Architecture** (High effort - 6-8 hours)

**Files to modify:**
- `frontend/src/stores/gameStore.ts`

**Current issue:** Single global game state

```typescript
export interface GameStoreState {
  gameState: GameState | null;  // ❌ One game only!
  myPosition: number | null;
  // ...
}
```

**Solution A - Multiple Store Instances (Simpler):**
```typescript
// Keep existing store for "active" game
export const useGameStore = create<GameStore>()(...);

// Create store factory for managing multiple games
export interface GameRegistry {
  games: Map<string, GameState>;
  activeGameId: string | null;
  myPositions: Map<string, number>;
}

export const useGameRegistry = create<GameRegistry>()(...);
```

**Solution B - Redesign Store (More complex but cleaner):**
```typescript
export interface MultiGameStore {
  games: Map<string, {
    state: GameState;
    myPosition: number | null;
    lastUpdate: number;
  }>;
  activeGameId: string | null;
  
  setGameState: (gameId: string, state: GameState) => void;
  switchToGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
}
```

**Recommendation:** Solution A (backward compatible)

#### 6. **Socket Event Handling** (Medium effort - 3-4 hours)

**Files to modify:**
- `frontend/src/hooks/useSocket.ts`

**Current issue:** Single game's events are handled globally

**Changes needed:**
```typescript
// Events now include gameId, route to correct store
onGameStateUpdate: (data) => {
  const { gameId, gameState } = data;
  
  // Update correct game in registry
  gameRegistry.updateGame(gameId, gameState);
  
  // If this is the active game, also update main store
  if (gameId === gameRegistry.activeGameId) {
    setGameState(gameState);
  }
}
```

#### 7. **Routing & Navigation** (Medium effort - 3-4 hours)

**Files to modify:**
- `frontend/src/pages/GamePage.tsx`
- Add: `frontend/src/components/GameSwitcher.tsx` (new component)

**Current:** URL is `/game/:gameId`, always shows that game

**Add:** 
- Game switcher UI (dropdown/tabs) to switch between active games
- Notification badges when it's your turn in inactive games
- Update URL when switching: `/game/:gameId`

#### 8. **Lobby & Game List** (Low effort - 2 hours)

**Files to modify:**
- `frontend/src/components/lobby/ActiveGames.tsx`
- `frontend/src/services/api.ts`

**Changes:**
- API: `getUserGames()` already returns all games → no change needed!
- UI: Show "PLAYING" badge for games you're in
- Allow joining new games while already in others

---

## Effort Estimation

| Component | Effort | Complexity | Risk |
|-----------|--------|------------|------|
| Backend validation removal | 2-3 hours | Low | Low |
| Connection service refactor | 4-6 hours | High | Medium |
| Socket room management | 1 hour | Low | Low |
| **Backend Subtotal** | **7-10 hours** | | |
| | | | |
| Frontend store redesign | 6-8 hours | High | High |
| Socket event routing | 3-4 hours | Medium | Medium |
| UI/Routing updates | 5-6 hours | Medium | Low |
| Testing & debugging | 4-6 hours | High | Medium |
| **Frontend Subtotal** | **18-24 hours** | | |
| | | | |
| **Total Estimate** | **25-34 hours** | | |

**Equivalent:** ~3-4 full work days (8 hours/day)

---

## Complexity Breakdown

### Easy ✅
- Remove validation checks
- Socket room handling (already works)
- Database schema (already supports it)

### Moderate 🟡
- Routing and navigation
- Lobby UI updates
- Socket event routing

### Hard 🔴
- Connection service refactor (lots of call sites)
- Frontend state management (architectural change)
- Testing across multiple games
- Edge cases (notifications, turn indicators, etc.)

---

## Additional Considerations

### UX Challenges
1. **Turn notifications** - How to notify users it's their turn in Game B while playing Game A?
2. **Game switcher UI** - Where to place it? Drawer? Tabs? Dropdown?
3. **Performance** - Multiple WebSocket event streams
4. **Confusion** - Players might mix up which game they're in

### Technical Risks
1. **State synchronization** - Multiple game states updating simultaneously
2. **Memory usage** - Keeping multiple game states in memory
3. **WebSocket load** - Player receives updates from all games
4. **Race conditions** - Switching games during updates

### Testing Complexity
- Need to test:
  - Joining multiple games
  - Switching between games
  - Turn taking in Game A, then Game B
  - Leaving one game while in others
  - Disconnecting/reconnecting with multiple games

---

## Recommendation

### Should You Do It?

**Pros:**
- Players can have multiple games going (like correspondence chess)
- Better for async play style
- Increases engagement

**Cons:**
- Significant development time (3-4 days)
- Increased complexity and bugs
- UX challenges
- May not match the real-time game flow

### Alternative: "One Game at a Time" UX Improvement

Instead of full multi-game support, make single-game experience better:

**Effort:** 2-3 hours
1. Better "leave game" flow with confirmation
2. Show all your games in lobby with clear "IN PROGRESS" badges  
3. Add "Rejoin Game" button that auto-leaves current game
4. Cleaner error message: "You must leave your current game first"

This gives 80% of the benefit with 10% of the effort.

---

## Conclusion

**Full multi-game support: 25-34 hours (3-4 days)**

Most complexity is in frontend state management and UX design. Backend is relatively straightforward since database already supports it.

**Recommendation:** Start with UX improvements to single-game flow. Only add multi-game if users specifically request it after launch.
