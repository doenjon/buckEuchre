# AI Implementation Roadmap

## Document Purpose

Living document guiding Buck Euchre implementation. Update task status as you work.

## Status Legend

- ⬜ NOT_STARTED
- 🟨 IN_PROGRESS
- ✅ COMPLETE
- ⚠️ BLOCKED
- 🔄 NEEDS_REVISION

---

## Implementation Philosophy: MVP → Production

This roadmap is organized to deliver a **playable MVP in ~4 weeks** (Phases 1-5), then add production polish (Phases 6-8) and deployment infrastructure (Phase 9).

### Milestones
- **Weeks 1-4 (Phases 1-5)**: MVP - Playable game with basic UI
- **Weeks 5-6 (Phases 6-8)**: Production polish - Error handling, testing, UX improvements
- **Week 7 (Phase 9)**: Deployment - Docker, monitoring, production-ready

Total: **53 tasks, 6-7 weeks**

---

## Phase 1: Foundation (MVP)
**Goal**: Project scaffolding and core types  
**Tasks**: 5 | **Time**: 2-3 days

### Task 1.1: Project Structure Setup
**Status:** ⬜ NOT_STARTED  
**Dependencies:** None

**Objective:** Create directory structure and package.json files

**What to Create:**
```
buck-euchre/
├── shared/
│   ├── package.json, tsconfig.json
│   └── src/ (types/, validators/, constants/)
├── backend/
│   ├── package.json, tsconfig.json
│   ├── prisma/schema.prisma
│   └── src/ (game/, services/, api/, sockets/, db/)
└── frontend/
    ├── package.json, tsconfig.json, vite.config.ts
    └── src/ (components/, hooks/, stores/, services/)
```

**Testing:**
- [ ] All directories exist
- [ ] `npm install` works in each workspace
- [ ] TypeScript compiles
- [ ] Can import from `shared` in both backend and frontend

---

### Task 1.2: Shared Types Module
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.1

**Objective:** Implement all TypeScript interfaces in `shared/types/`

**What to Create:**
- `shared/types/game.ts` - GameState, Player, Card, Trick, Bid interfaces
- `shared/types/api.ts` - Request/response types for REST and WebSocket
- `shared/types/index.ts` - Export all types

**Reference:** GAME_STATE_SPEC.md

**Key Interfaces:**
1. Card - suit, rank, id
2. Player - id, name, position, score, connected, hand, tricksTaken, folded
3. Trick - number, leadPlayerPosition, cards, winner
4. Bid - playerPosition, amount
5. GameState - complete state (see spec)
6. GamePhase - enum of all phases

**Testing:**
- [ ] All types compile
- [ ] No `any` types
- [ ] All exports work
- [ ] Types match GAME_STATE_SPEC.md

---

### Task 1.3: Shared Constants Module
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.2

**Objective:** Define game constants

**What to Create:**
- `shared/constants/cards.ts` - Full deck definition, card rankings
- `shared/constants/rules.ts` - Starting score (15), win condition (≤0), bid range (2-5)
- `shared/constants/index.ts` - Exports

**Example:**
```typescript
export const SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const;
export const RANKS = ['9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'] as const;
export const STARTING_SCORE = 15;
export const WINNING_SCORE = 0;
export const MIN_BID = 2;
export const MAX_BID = 5;
```

**Testing:**
- [ ] FULL_DECK has exactly 24 cards
- [ ] Constants match BUCK_EUCHRE_RULES.md

---

### Task 1.4: Shared Validators Module
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.2

**Objective:** Create basic Zod schemas for validation (MVP: basic only)

**What to Create:**
- `shared/validators/game.ts` - PlayCardPayload, PlaceBidPayload schemas
- `shared/validators/auth.ts` - JoinRequest validator
- `shared/validators/index.ts` - Exports

**Example:**
```typescript
import { z } from 'zod';

export const JoinRequestSchema = z.object({
  playerName: z.string().min(2).max(20)
});

export const PlaceBidSchema = z.object({
  gameId: z.string().uuid(),
  amount: z.union([
    z.literal('PASS'),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5)
  ])
});
```

**Testing:**
- [ ] Valid inputs pass
- [ ] Invalid inputs fail
- [ ] Error messages are clear

---

### Task 1.5: Database Schema (Prisma)
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.1

**Objective:** Create Prisma schema and initial migration

**What to Do:**
- Copy schema from DATABASE_SCHEMA.md to `backend/prisma/schema.prisma`
- Run `npx prisma migrate dev --name init`

**Testing:**
- [ ] `npx prisma generate` succeeds
- [ ] Migration applies cleanly
- [ ] Can create/query records
- [ ] Prisma Studio works

---

## Phase 2: Game Logic (MVP)
**Goal**: Pure game functions (fully tested)  
**Tasks**: 7 | **Time**: 3-5 days

### Task 2.1: Deck & Card Utilities
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.2, Task 1.3

**Objective:** Implement pure functions for deck operations

**What to Create:** `backend/src/game/deck.ts`

**Functions:**
```typescript
export function createDeck(): Card[]
export function shuffleDeck(deck: Card[]): Card[]
export function dealCards(deck: Card[]): {
  hands: [Card[], Card[], Card[], Card[]],
  blind: Card[]
}
export function getEffectiveSuit(card: Card, trumpSuit: Card['suit']): Card['suit']
export function isSameColor(suit1: Card['suit'], suit2: Card['suit']): boolean
```

**Reference:** GAME_STATE_SPEC.md - "Algorithms"

**Testing:**
- [ ] createDeck() returns 24 unique cards
- [ ] shuffleDeck() randomizes order
- [ ] dealCards() gives 5 to each player, 4 to blind
- [ ] getEffectiveSuit() handles Left Bower
- [ ] Write unit tests in `__tests__/deck.test.ts`

---

### Task 2.2: Card Ranking & Comparison
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 2.1

**Objective:** Implement card comparison logic

**What to Create:** `backend/src/game/cards.ts`

**Functions:**
```typescript
export function getRankValue(
  card: Card,
  trumpSuit: Card['suit'],
  effectiveSuit: Card['suit']
): number

export function isHigherCard(
  card: Card,
  currentWinner: Card,
  trumpSuit: Card['suit'],
  ledSuit: Card['suit']
): boolean
```

**Testing:**
- [ ] Right Bower beats Left Bower
- [ ] Left Bower beats Ace of trump
- [ ] Trump beats non-trump
- [ ] Off-suit loses to led suit

---

### Task 2.3: Trick Evaluation
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 2.2

**Objective:** Determine trick winner

**What to Create:** `backend/src/game/trick.ts`

**Functions:**
```typescript
export function determineTrickWinner(
  trick: Trick,
  trumpSuit: Card['suit'],
  activePlayers: number[]
): number
```

**Testing:**
- [ ] Trump wins over non-trump
- [ ] Right Bower wins all
- [ ] Left Bower beats other trumps
- [ ] Led suit wins when no trump
- [ ] Folded players ignored

---

### Task 2.4: Scoring Logic
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.2

**Objective:** Calculate round scores

**What to Create:** `backend/src/game/scoring.ts`

**Functions:**
```typescript
export function calculateRoundScores(
  players: Player[],
  winningBidderPosition: number,
  bid: number
): Record<number, number>

export function checkWinCondition(players: Player[]): {
  winner: number | null;
  gameOver: boolean;
}
```

**Scoring Rules:**
- Bidder made contract: -tricksTaken
- Bidder failed: +5
- Non-bidder took 1+: -tricksTaken
- Non-bidder took 0: +5
- Folded: 0

**Testing:**
- [ ] All scoring scenarios correct
- [ ] Win condition detects score ≤ 0

---

### Task 2.5: Move Validation
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 2.1, Task 1.2

**Objective:** Validate player actions

**What to Create:** `backend/src/game/validation.ts`

**Functions:**
```typescript
export function canPlayCard(
  card: Card,
  hand: Card[],
  currentTrick: Trick,
  trumpSuit: Card['suit'],
  playerFolded: boolean
): { valid: boolean; reason?: string }

export function canPlaceBid(
  amount: number | 'PASS',
  currentHighestBid: number | null,
  playerHasPassed: boolean,
  allOthersPassed: boolean
): { valid: boolean; reason?: string }

export function canFold(
  isClubsTurnUp: boolean,
  isBidder: boolean
): { valid: boolean; reason?: string }
```

**Key Rules:**
- Must follow suit if able (including Left Bower as trump)
- Bids must be higher than current
- Cannot fold if Clubs turn-up or if bidder

**Testing:**
- [ ] Follow suit validation works
- [ ] Left Bower treated as trump
- [ ] Bid validation works
- [ ] Fold validation works

---

### Task 2.6: State Transitions
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 2.1, Task 2.3, Task 2.4, Task 2.5

**Objective:** Pure functions for state updates

**What to Create:** `backend/src/game/state.ts`

**Functions:**
```typescript
export function initializeGame(playerIds: string[]): GameState
export function dealNewRound(state: GameState): GameState
export function applyBid(state: GameState, playerPosition: number, bid: Bid['amount']): GameState
export function applyTrumpDeclaration(state: GameState, trumpSuit: Card['suit']): GameState
export function applyFoldDecision(state: GameState, playerPosition: number, folded: boolean): GameState
export function applyCardPlay(state: GameState, playerPosition: number, cardId: string): GameState
export function finishRound(state: GameState): GameState
```

**Key Principle:** PURE functions (no I/O, no mutation, no database calls)

**Testing:**
- [ ] Each function returns new state
- [ ] Phase transitions work
- [ ] No state mutation
- [ ] Full game flow end-to-end test

---

### Task 2.7: Unit Tests for Game Logic
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 2.1-2.6

**Objective:** Comprehensive unit tests

**What to Create:**
- `backend/src/game/__tests__/deck.test.ts`
- `backend/src/game/__tests__/cards.test.ts`
- `backend/src/game/__tests__/trick.test.ts`
- `backend/src/game/__tests__/scoring.test.ts`
- `backend/src/game/__tests__/validation.test.ts`
- `backend/src/game/__tests__/state.test.ts`

**Setup:** Install jest, ts-jest, configure jest.config.js

**Success Criteria:**
- [ ] 90%+ code coverage for game logic
- [ ] All tests pass
- [ ] Test "all players pass" scenario
- [ ] Test Left Bower edge cases

---

## Phase 3: Backend Services (MVP)
**Goal**: Minimal backend to support game  
**Tasks**: 5 | **Time**: 2-3 days

### Task 3.1: Database Client Setup
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.5

**Objective:** Set up Prisma client

**What to Create:** `backend/src/db/client.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']
});

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
```

**Testing:**
- [ ] Can connect to database
- [ ] Basic queries work
- [ ] Connection errors handled

---

### Task 3.2: Player Service
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 3.1

**Objective:** Player session management

**What to Create:** `backend/src/services/player.service.ts`

**Functions:**
```typescript
export async function createPlayer(name: string): Promise<{
  player: Player;
  token: string;
}>
export async function validatePlayer(playerId: string): Promise<Player | null>
export async function getPlayerFromToken(token: string): Promise<Player | null>
```

**Testing:**
- [ ] Creates player in database
- [ ] Generates valid JWT token
- [ ] Token validation works
- [ ] Token expiration works (24 hours)

---

### Task 3.3: Game Service
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 3.1, Task 2.6

**Objective:** Game lifecycle management

**What to Create:** `backend/src/services/game.service.ts`

**Functions:**
```typescript
export async function createGame(creatorId: string): Promise<Game>
export async function joinGame(gameId: string, playerId: string): Promise<GameState>
export async function leaveGame(gameId: string, playerId: string): Promise<void>
export async function listAvailableGames(): Promise<GameSummary[]>
export async function getGameState(gameId: string): Promise<GameState | null>
```

**Testing:**
- [ ] Creates game in database
- [ ] Adds players (positions 0-3)
- [ ] Prevents joining full games
- [ ] Lists games correctly

---

### Task 3.4: State Service
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 3.1, Task 2.6

**Objective:** In-memory state management + persistence with race condition prevention

**What to Create:** `backend/src/services/state.service.ts`

**Implementation:**
```typescript
// In-memory game state store
const activeGames = new Map<string, GameState>();

// Action queue per game to prevent race conditions
const gameActionQueues = new Map<string, Promise<void>>();

/**
 * Execute an action on a game state, ensuring sequential processing
 * This prevents race conditions when multiple players act simultaneously
 */
export async function executeGameAction<T>(
  gameId: string,
  action: (currentState: GameState) => Promise<GameState>
): Promise<GameState> {
  // Get or create queue for this game
  const currentQueue = gameActionQueues.get(gameId) || Promise.resolve();
  
  // Chain this action to the queue
  const newQueue = currentQueue.then(async () => {
    const state = activeGames.get(gameId);
    if (!state) {
      throw new Error('Game not found');
    }
    
    // Execute action (pure function from game/state.ts)
    const newState = await action(state);
    
    // Update in-memory state
    activeGames.set(gameId, newState);
    
    // Persist to database (don't await - fire and forget for performance)
    saveGameState(gameId, newState).catch(err => 
      console.error('Failed to persist game state:', err)
    );
    
    return newState;
  });
  
  // Update queue
  gameActionQueues.set(gameId, newQueue);
  
  // Return new state when this action completes
  return newQueue;
}

export function getActiveGameState(gameId: string): GameState | null
export function setActiveGameState(gameId: string, state: GameState): void
export async function saveGameState(gameId: string, state: GameState): Promise<void>
export async function loadGameState(gameId: string): Promise<GameState | null>
export function deleteGameState(gameId: string): void
```

**Note:** Action queue ensures all game actions are processed sequentially per game, preventing race conditions while allowing different games to process actions in parallel.

**Testing:**
- [ ] In-memory operations work
- [ ] Persists to database
- [ ] Loads from database
- [ ] JSON serialization works
- [ ] Concurrent actions are serialized (race condition test)
- [ ] Multiple games can process actions in parallel

---

### Task 3.5: Authentication Middleware
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 3.2

**Objective:** JWT validation middleware

**What to Create:**
- `backend/src/auth/jwt.ts` - JWT utilities
- `backend/src/auth/middleware.ts` - Express middleware

**Functions:**
```typescript
// jwt.ts
export function generateToken(playerId: string, playerName: string): string
export function verifyToken(token: string): { playerId: string; playerName: string } | null

// middleware.ts
export function authenticateToken(req, res, next)
```

**Testing:**
- [ ] Generates valid tokens
- [ ] Validates correct tokens
- [ ] Rejects invalid/expired tokens
- [ ] Middleware blocks unauthorized requests

---

## Phase 4: Backend API (MVP)
**Goal**: Minimal REST + WebSocket to play game  
**Tasks**: 4 | **Time**: 2-3 days

### Task 4.1: REST API Routes
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 3.5, Task 3.2, Task 3.3

**Objective:** Implement REST endpoints (MVP: simple errors only)

**What to Create:**
- `backend/src/api/health.routes.ts`
- `backend/src/api/auth.routes.ts`
- `backend/src/api/game.routes.ts`
- `backend/src/api/index.ts`

**Endpoints:**
```typescript
GET  /health
POST /api/auth/join
POST /api/games
GET  /api/games
GET  /api/games/:gameId
```

**Reference:** API_SPEC.md

**MVP Note:** Use simple error messages (strings). Error taxonomy added in Phase 6.

**Testing:**
- [ ] All endpoints respond
- [ ] Validation works
- [ ] Authentication works
- [ ] Errors handled

---

### Task 4.2: WebSocket Connection Handling
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 3.5

**Objective:** Socket.io setup and authentication (MVP: basic only)

**What to Create:**
- `backend/src/sockets/connection.ts`
- `backend/src/sockets/middleware.ts`

**Implementation:**
```typescript
// middleware.ts
export function authenticateSocket(socket, next)

// connection.ts
export function handleConnection(io: Server) {
  io.use(authenticateSocket);
  
  io.on('connection', (socket) => {
    console.log('Player connected:', socket.data.playerId);
    
    socket.on('disconnect', () => {
      // Basic disconnect handling
    });
    
    registerGameHandlers(io, socket);
  });
}
```

**MVP Note:** Basic reconnection (client auto-reconnects, server sends state). Grace periods added in Phase 6.

**Testing:**
- [ ] Connection requires valid token
- [ ] Invalid tokens rejected
- [ ] Disconnect handling works

---

### Task 4.3: WebSocket Game Event Handlers
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 4.2, Task 3.3, Task 3.4, Task 2.6

**Objective:** Implement game action handlers (MVP: basic errors only)

**What to Create:** `backend/src/sockets/game.ts`

**Events:**
```typescript
export function registerGameHandlers(io: Server, socket: Socket) {
  socket.on('JOIN_GAME', handleJoinGame);
  socket.on('LEAVE_GAME', handleLeaveGame);
  socket.on('PLACE_BID', handlePlaceBid);
  socket.on('DECLARE_TRUMP', handleDeclareTrump);
  socket.on('FOLD_DECISION', handleFoldDecision);
  socket.on('PLAY_CARD', handlePlayCard);
  socket.on('START_NEXT_ROUND', handleStartNextRound);
}
```

**Pattern for Each Handler (using action queue):**
```typescript
async function handlePlayCard(payload: PlayCardPayload) {
  try {
    // 1. Validate payload (Zod)
    const validated = playCardSchema.parse(payload);
    
    // 2. Execute action through queue (prevents race conditions)
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // 3. Validate action against current state
      const validation = canPlayCard(currentState, validated);
      if (!validation.valid) {
        throw new ValidationError(validation.reason);
      }
      
      // 4. Apply state transition (pure function from game/state.ts)
      return applyCardPlay(currentState, validated);
    });
    
    // 5. Broadcast update to room (state already persisted by executeGameAction)
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'CARD_PLAYED'
    });
    
  } catch (error) {
    socket.emit('ERROR', { code: 'PLAY_CARD_FAILED', message: error.message });
  }
}
```

**Key Pattern:** All state mutations go through `executeGameAction()` which ensures sequential processing per game.

**MVP Note:** No state versioning yet. Added in Phase 6.

**Testing:**
- [ ] All events work
- [ ] Validation rejects invalid actions
- [ ] State updates correctly
- [ ] Broadcasts work
- [ ] Race conditions prevented (concurrent card plays)

---

### Task 4.4: Express Server Setup
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 4.1, Task 4.2

**Objective:** Main server file

**What to Create:**
- `backend/src/server.ts`
- `backend/src/index.ts`

**Implementation:**
```typescript
// server.ts
export function createServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }
  });
  
  app.use(cors());
  app.use(express.json());
  app.use('/', apiRoutes);
  
  handleConnection(io);
  
  return { app, httpServer, io };
}

// index.ts
async function main() {
  await connectDatabase();
  const { httpServer } = createServer();
  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
```

**MVP Note:** Basic error handling. Full error middleware in Phase 6.

**Testing:**
- [ ] Server starts
- [ ] Environment variables load
- [ ] CORS works
- [ ] REST and WebSocket both work

---

## Phase 5: Frontend UI (MVP)
**Goal**: Complete game UI (playable)  
**Tasks**: 15 | **Time**: 5-7 days

### Task 5.1: Vite + React Setup
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.1

**Objective:** Frontend build setup

**What to Create:**
- `frontend/vite.config.ts`
- `frontend/tailwind.config.js`
- `frontend/tsconfig.json`
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`

**Configuration:**
- Vite with React + TypeScript
- Tailwind CSS with Shadcn/ui
- Path aliases (@/ for src/)

**Testing:**
- [ ] `npm run dev` starts
- [ ] Hot reload works
- [ ] TypeScript compiles
- [ ] Can import from shared package

---

### Task 5.2: API Client Service
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.1, Task 1.2

**Objective:** REST API client

**What to Create:** `frontend/src/services/api.ts`

**Functions:**
```typescript
export async function joinSession(playerName: string): Promise<AuthResponse>
export async function createGame(): Promise<CreateGameResponse>
export async function listGames(): Promise<ListGamesResponse>
export async function getGameState(gameId: string): Promise<GameState>
```

**Testing:**
- [ ] All requests work
- [ ] Auth token included
- [ ] Errors handled

---

### Task 5.3: Socket Client Service
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.1, Task 1.2

**Objective:** WebSocket client

**What to Create:** `frontend/src/services/socket.ts`

```typescript
import io from 'socket.io-client';

export function createSocketConnection(token: string) {
  const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
    auth: { token }
  });
  return socket;
}

export function emitJoinGame(socket: Socket, gameId: string) {
  socket.emit('JOIN_GAME', { gameId });
}
// ... other emit functions
```

**Testing:**
- [ ] Connects successfully
- [ ] Emits events correctly
- [ ] Receives events
- [ ] Handles disconnection

---

### Task 5.4: State Management (Zustand)
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.2, Task 5.3

**Objective:** Client-side state management

**What to Create:**
- `frontend/src/stores/authStore.ts`
- `frontend/src/stores/gameStore.ts`
- `frontend/src/stores/uiStore.ts`

**Stores:**
```typescript
// authStore.ts
interface AuthStore {
  playerId: string | null;
  playerName: string | null;
  token: string | null;
  login: (response: AuthResponse) => void;
  logout: () => void;
}

// gameStore.ts
interface GameStore {
  gameState: GameState | null;
  myPosition: number | null;
  setGameState: (state: GameState) => void;
}

// uiStore.ts
interface UIStore {
  error: string | null;
  setError: (error: string) => void;
  clearError: () => void;
}
```

**Note:** Compute derived state (isMyTurn, playableCards) using selectors, don't store.

**Testing:**
- [ ] Stores update correctly
- [ ] localStorage persistence works (auth)

---

### Task 5.5: Custom Hooks
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.4

**Objective:** Reusable React hooks

**What to Create:**
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/hooks/useSocket.ts`
- `frontend/src/hooks/useGame.ts`

**Testing:**
- [ ] Hooks work correctly
- [ ] Cleanup happens on unmount

---

### Task 5.6: React Router Setup
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.1, Task 5.4

**Objective:** Set up routing

**What to Create:**
- `frontend/src/routes.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/GamePage.tsx`
- Update `App.tsx`

**Routes:**
- `/` - Home (join session, simple lobby)
- `/game/:gameId` - Game view (requires auth)

**MVP Note:** Minimal lobby (paste game URL). Full lobby in Phase 7.

**Testing:**
- [ ] All routes render
- [ ] Protected routes redirect
- [ ] Navigation works

---

### Task 5.7: Shadcn/ui Setup
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.1

**Objective:** Install Shadcn/ui components

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input dialog badge separator
```

**Testing:**
- [ ] Components render
- [ ] Styling works

---

### Task 5.8: Layout Components
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7

**Objective:** App layout structure

**What to Create:**
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Layout.tsx`

**Testing:**
- [ ] Renders correctly
- [ ] Responsive design works

---

### Task 5.9: Authentication Components
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7, Task 5.5

**Objective:** Login/join flow

**What to Create:**
- `frontend/src/components/auth/JoinSession.tsx`

**Testing:**
- [ ] Form validation works
- [ ] Join succeeds
- [ ] Errors displayed

---

### Task 5.10: Card Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7

**Objective:** Visual card representation

**What to Create:** `frontend/src/components/game/Card.tsx`

```typescript
interface CardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  faceDown?: boolean;
  size?: 'small' | 'medium' | 'large';
}
```

**Testing:**
- [ ] Renders all cards
- [ ] Colors correct
- [ ] Click handler works
- [ ] Disabled state works
- [ ] Face down shows card back

---

### Task 5.11: Player Hand Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.10, Task 5.5

**Objective:** Display player's cards

**What to Create:** `frontend/src/components/game/PlayerHand.tsx`

**MVP Note:** Simple playable card detection (server validates, show all cards as playable for simplicity). Client validation added in Phase 7.

**Testing:**
- [ ] Shows correct cards
- [ ] Plays card on click

---

### Task 5.12: Current Trick Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.10

**Objective:** Display cards played in current trick

**What to Create:** `frontend/src/components/game/CurrentTrick.tsx`

**Testing:**
- [ ] Shows cards correctly
- [ ] Updates in real-time
- [ ] Shows player positions

---

### Task 5.13: Scoreboard Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7

**Objective:** Display player scores

**What to Create:** `frontend/src/components/game/Scoreboard.tsx`

**Testing:**
- [ ] Shows all players
- [ ] Scores update
- [ ] Winner highlighted

---

### Task 5.14: Bidding Panel Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7, Task 5.5

**Objective:** Bidding interface

**What to Create:** `frontend/src/components/game/BiddingPanel.tsx`

**Testing:**
- [ ] Shows when phase is BIDDING
- [ ] Only active for current bidder
- [ ] Disables invalid bids
- [ ] Sends bid correctly

---

### Task 5.15: Trump Selector Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7, Task 5.5

**Objective:** Trump declaration interface

**What to Create:** `frontend/src/components/game/TrumpSelector.tsx`

**Testing:**
- [ ] Shows only for winning bidder
- [ ] Shows in correct phase
- [ ] Sends selection correctly

---

### Task 5.16: Fold Decision Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7, Task 5.5

**Objective:** Fold/stay decision interface

**What to Create:** `frontend/src/components/game/FoldDecision.tsx`

**Testing:**
- [ ] Shows for non-bidders only
- [ ] Fold disabled if Clubs
- [ ] Sends decision correctly

---

### Task 5.17: Game Board Component
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.11-5.16

**Objective:** Main game view (MVP: basic turn indicator)

**What to Create:** `frontend/src/components/game/GameBoard.tsx`

**Components to Include:**
- Scoreboard
- Basic turn indicator ("Your turn!" vs "Waiting for {player}...")
- Current Trick
- Player Hand
- Conditional: BiddingPanel, TrumpSelector, FoldDecision

**MVP Note:** Simple text turn indicator. Fancy animated version in Phase 6.

**Testing:**
- [ ] All components render
- [ ] Updates in real-time
- [ ] Phase transitions work
- [ ] Turn indicator visible

---

### Task 5.18: MVP Testing & Bug Fixes
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.17

**Objective:** Verify MVP works end-to-end

**What to Test:**
1. **Happy Path:**
   - 4 players join (paste URL)
   - Cards dealt
   - Bidding completes
   - Trump declared
   - Fold decisions
   - 5 tricks played
   - Scores calculated
   - Next round starts
   - Game ends when player reaches 0

2. **Edge Cases:**
   - All players pass → hand ends
   - Clubs turn-up → no folding
   - All non-bidders fold
   - Follow suit violations caught
   - Left Bower treated as trump

3. **UI/UX:**
   - Cards are readable
   - Turn indicators clear
   - Scores update
   - Error messages show

**Testing Method:** Open 4 browser tabs, play complete game

**Success Criteria:**
- [ ] Complete game plays without errors
- [ ] All rules enforced
- [ ] UI is usable
- [ ] "All players pass" works
- [ ] Clubs turn-up prevents folding

**After Testing:** Fix any bugs found, basic styling improvements

---

## 🎉 MVP MILESTONE COMPLETE

**After Phase 5:** You have a fully playable Buck Euchre game!

**What works:**
- ✅ 4 players can join and play
- ✅ All game rules implemented
- ✅ Real-time updates
- ✅ Score tracking
- ✅ Basic UI

**What's missing (added in Phases 6-9):**
- ⏭️ Robust error handling
- ⏭️ Reconnection grace periods
- ⏭️ Client-side validation
- ⏭️ Fancy loading states
- ⏭️ Full lobby
- ⏭️ Comprehensive tests
- ⏭️ Docker deployment

---

## Phase 6: Error Handling & Reconnection (Production)
**Goal**: Production-grade reliability  
**Tasks**: 6 | **Time**: 3-4 days

### Task 6.1: Environment Variable Validation
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.1

**Objective:** Validate required environment variables on startup

**What to Create:**
- `backend/src/config/env.ts` - Environment validation

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  CORS_ORIGIN: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error.errors);
    process.exit(1);
  }
}
```

**Testing:**
- [ ] Server starts with valid env
- [ ] Server exits with clear error on invalid env

---

### Task 6.2: Error Handling Strategy & Taxonomy
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 4.1, Task 4.3

**Objective:** Standardize error handling

**What to Create:**
- `shared/types/errors.ts` - Error codes
- `backend/src/utils/errors.ts` - Error classes
- `backend/src/middleware/errorHandler.ts` - Express middleware

**Error Codes:**
```typescript
export enum ErrorCode {
  // Validation (4xx)
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_MOVE = 'INVALID_MOVE',
  OUT_OF_TURN = 'OUT_OF_TURN',
  GAME_FULL = 'GAME_FULL',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // Game State (4xx)
  WRONG_PHASE = 'WRONG_PHASE',
  ALREADY_FOLDED = 'ALREADY_FOLDED',
  CANNOT_FOLD = 'CANNOT_FOLD',
  INVALID_BID = 'INVALID_BID',
  
  // Server (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}
```

**Update Task 4.1 & 4.3:** Replace simple error messages with error codes

**Testing:**
- [ ] All error codes defined
- [ ] REST returns proper status codes
- [ ] WebSocket emits structured errors

---

### Task 6.3: WebSocket Reconnection Handling
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 4.2, Task 4.3

**Objective:** Handle disconnection/reconnection gracefully

**What to Create:**
- `backend/src/sockets/reconnection.ts`
- `backend/src/services/connection.service.ts`

**Implementation:**
```typescript
// connection.service.ts
interface PlayerConnection {
  playerId: string;
  socketId: string;
  gameId: string | null;
  connectedAt: Date;
  lastSeenAt: Date;
}

export function handleDisconnect(playerId: string, io: Server) {
  // 30-second grace period
  setTimeout(() => {
    const stillDisconnected = !activeConnections.has(playerId);
    if (stillDisconnected && conn.gameId) {
      io.to(`game:${conn.gameId}`).emit('PLAYER_DISCONNECTED', {
        playerId,
        position: getPlayerPosition(conn.gameId, playerId)
      });
    }
  }, 30000);
}

export function handleReconnect(playerId: string, socket: Socket, io: Server) {
  // Rejoin game room, send current state
  if (conn?.gameId) {
    socket.join(`game:${conn.gameId}`);
    const gameState = getActiveGameState(conn.gameId);
    socket.emit('RECONNECTED', { gameState });
    io.to(`game:${conn.gameId}`).emit('PLAYER_RECONNECTED', {
      playerId,
      position: getPlayerPosition(conn.gameId, playerId)
    });
  }
}
```

**Testing:**
- [ ] Player can disconnect and reconnect
- [ ] Game state syncs on reconnect
- [ ] Other players notified
- [ ] Grace period works

---

### Task 6.4: State Versioning for WebSocket
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 4.3

**Objective:** Add version numbers to prevent out-of-order updates

**What to Update:** Enhance Task 4.3 implementation

```typescript
interface GameState {
  version: number; // NEW: Increment on each state change
  // ... rest of fields
}

// In handler
const newState = {
  ...applyAction(gameState, action),
  version: gameState.version + 1
};

io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
  gameState: newState,
  event: 'CARD_PLAYED'
});
```

**Client checks version:**
```typescript
socket.on('GAME_STATE_UPDATE', (data) => {
  const currentVersion = gameStore.gameState?.version || 0;
  if (data.gameState.version > currentVersion) {
    setGameState(data.gameState);
  } else {
    socket.emit('REQUEST_STATE', { gameId });
  }
});
```

**Testing:**
- [ ] Version increments on each action
- [ ] Client ignores stale updates
- [ ] Client requests fresh state when needed

---

### Task 6.5: Loading States & Turn Indicators (Enhanced)
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7, Task 5.8

**Objective:** Polished loading and turn indicators

**What to Create:**
- `frontend/src/components/game/TurnIndicator.tsx` (enhanced)
- `frontend/src/components/game/LoadingGame.tsx`
- `frontend/src/components/game/PlayerStatusBadge.tsx`
- `frontend/src/components/game/WaitingForPlayers.tsx`

**Enhanced TurnIndicator:**
```typescript
export function TurnIndicator({ currentPlayer, isMyTurn, phase }) {
  return (
    <div className={cn(
      "turn-indicator p-4 rounded-lg transition-all",
      isMyTurn ? "bg-green-100 border-2 border-green-500 animate-pulse" : "bg-gray-100"
    )}>
      {isMyTurn ? (
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-green-600" />
          <span className="font-bold text-green-900">
            Your turn to {actionText[phase]}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <span>Waiting for {currentPlayer.name}...</span>
          {!currentPlayer.connected && <Badge variant="destructive">Disconnected</Badge>}
        </div>
      )}
    </div>
  );
}
```

**Update Task 5.17:** Replace basic turn indicator with enhanced version

**Testing:**
- [ ] Turn indicator shows correct player
- [ ] Highlights when user's turn
- [ ] Shows connection status
- [ ] Loading states render

---

### Task 6.6: Client-Side Validation Utilities
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.4, Task 1.4

**Objective:** Reuse server validation on client for instant feedback

**What to Create:**
- `frontend/src/utils/gameValidation.ts`
- `frontend/src/utils/cardHelpers.ts`

```typescript
export function getPlayableCards(
  gameState: GameState,
  playerPosition: number
): Card[] {
  // Check if player's turn
  // Check if folded
  // Apply follow-suit rules
  // Return playable cards
}

export function canPlaceBid(amount, gameState, playerPosition): {
  valid: boolean;
  reason?: string;
}

export function canFold(gameState, playerPosition): {
  valid: boolean;
  reason?: string;
}
```

**Update Task 5.11:** Use getPlayableCards to highlight valid cards

**Note:** Server still validates all actions (server is authority)

**Testing:**
- [ ] getPlayableCards returns correct cards
- [ ] Follow suit validation works
- [ ] Matches server validation behavior

---

## Phase 7: UI Polish & Full Lobby (Production)
**Goal**: Better UX and full feature set  
**Tasks**: 2 | **Time**: 2-3 days

### Task 7.1: Full Lobby Components
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.7, Task 5.5

**Objective:** Full game lobby with list

**What to Create:**
- `frontend/src/components/lobby/GameList.tsx`
- `frontend/src/components/lobby/CreateGame.tsx`
- `frontend/src/pages/LobbyPage.tsx`

**Update Task 5.6:** Add `/lobby` route

**Testing:**
- [ ] Lists games
- [ ] Create game works
- [ ] Join game works
- [ ] Auto-refresh game list

---

### Task 7.2: UI Polish Pass
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.17, Task 6.5

**Objective:** Animations, transitions, responsive design

**What to Improve:**
- Card play animations
- Trick completion animation
- Score change animations
- Mobile responsive design
- Accessibility (ARIA labels)

**Testing:**
- [ ] Animations smooth
- [ ] Works on mobile
- [ ] Keyboard navigation works

---

## Phase 8: Production Testing (Production)
**Goal**: Comprehensive test coverage  
**Tasks**: 3 | **Time**: 2-3 days

### Task 8.1: Backend Integration Tests
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 4.1, Task 4.3, Task 4.4

**Objective:** Integration tests for API and WebSocket

**What to Create:**
- `backend/src/__tests__/integration/auth.test.ts`
- `backend/src/__tests__/integration/game-api.test.ts`
- `backend/src/__tests__/integration/game-flow.test.ts`
- `backend/src/__tests__/integration/websocket.test.ts`

**Test Coverage:**
- All REST endpoints
- All WebSocket events
- Full game flow
- "All players pass" scenario
- Reconnection scenarios

**Setup:** Install supertest, socket.io-client, use test database

**Testing:**
- [ ] All REST endpoints tested
- [ ] All WebSocket events tested
- [ ] Full game flow passes
- [ ] Edge cases covered

---

### Task 8.2: Frontend Component Tests
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 5.17

**Objective:** Test React components

**What to Create:**
- `frontend/src/components/__tests__/Card.test.tsx`
- `frontend/src/components/__tests__/PlayerHand.test.tsx`
- `frontend/src/components/__tests__/BiddingPanel.test.tsx`

**Setup:** Install @testing-library/react, @testing-library/jest-dom

**Testing:**
- [ ] Key components have tests
- [ ] User interactions tested
- [ ] All tests pass

---

### Task 8.3: Performance & Load Testing
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 8.1

**Objective:** Ensure performance is adequate

**What to Test:**
- Multiple concurrent games (10-20)
- WebSocket message latency
- Database query performance
- Memory leaks

**Testing:**
- [ ] <100ms WebSocket latency
- [ ] No memory leaks
- [ ] Handles 20 concurrent games

---

## Phase 9: Production Deployment (Production)
**Goal**: Production-ready infrastructure  
**Tasks**: 4 | **Time**: 2-3 days

### Task 9.1: Docker Development Setup
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 1.5

**Objective:** Docker for local development

**What to Create:**
- `docker-compose.dev.yml` - Development services

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: buckeuchre
      POSTGRES_USER: buckeuchre
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U buckeuchre"]
      interval: 10s

volumes:
  postgres-data:
```

**Testing:**
- [ ] `docker-compose -f docker-compose.dev.yml up -d` works
- [ ] Can connect to PostgreSQL from host
- [ ] Data persists across restarts

---

### Task 9.2: Docker Production Configuration
**Status:** ⬜ NOT_STARTED  
**Dependencies:** All backend and frontend tasks

**Objective:** Production Docker setup

**What to Create:**
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.yml`
- `nginx/nginx.conf`

**Testing:**
- [ ] `docker-compose up` works
- [ ] All services start
- [ ] Can access app
- [ ] Database persists

---

### Task 9.3: Environment Configuration
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 9.2

**Objective:** Production-ready configuration

**What to Do:**
1. Validate `.env.example` is complete
2. Add security headers
3. Configure CORS properly
4. Set up logging
5. Add health checks

**Testing:**
- [ ] All env vars documented
- [ ] Security headers set
- [ ] CORS configured
- [ ] Logs work

---

### Task 9.4: Production Deployment Guide
**Status:** ⬜ NOT_STARTED  
**Dependencies:** Task 9.3

**Objective:** Document deployment process

**What to Create:** `DEPLOYMENT.md`

**Should Include:**
1. Server requirements
2. Initial setup steps
3. Environment configuration
4. Running docker-compose
5. Backup strategy
6. Monitoring setup
7. Troubleshooting

**Testing:**
- [ ] Can deploy to fresh VPS following guide
- [ ] Backup script works
- [ ] App accessible from internet

---

## Progress Overview

**Overall Progress:** 0/53 tasks complete (0%)

### By Milestone:
- **MVP (Phases 1-5):** 0/36 tasks (0%) - Target: Week 4
- **Production Polish (Phases 6-8):** 0/13 tasks (0%) - Target: Week 6
- **Deployment (Phase 9):** 0/4 tasks (0%) - Target: Week 7

### By Phase:
- Phase 1 (Foundation): 0/5 tasks
- Phase 2 (Game Logic): 0/7 tasks
- Phase 3 (Backend Services): 0/5 tasks
- Phase 4 (Backend API): 0/4 tasks
- Phase 5 (Frontend UI): 0/15 tasks
- Phase 6 (Error Handling): 0/6 tasks
- Phase 7 (UI Polish): 0/2 tasks
- Phase 8 (Testing): 0/3 tasks
- Phase 9 (Deployment): 0/4 tasks

### Next Available Tasks:
1. Task 1.1 - Project Structure Setup (no dependencies)

---

## Design Document Changelog

### BUCK_EUCHRE_RULES.md
- 2025-01-04: Fixed rules (5 cards, blind, folding, countdown scoring)
- 2025-01-04: Changed "dealer stuck" - if all pass, hand ends (no scoring)

### GAME_STATE_SPEC.md
- 2025-01-04: Clarified blind cards for info only
- 2025-01-04: Updated "all players pass" scenario

### API_SPEC.md
- 2025-01-04: Fixed bid range (removed 6, max is 5)

### AI_IMPLEMENTATION_ROADMAP.md
- 2025-01-04: Restructured into 9 phases for MVP→Production delivery
- 2025-01-04: Reordered 53 tasks to enable MVP at Phase 5
- 2025-01-04: Simplified MVP tasks (basic errors, no client validation initially)
- 2025-01-04: Moved polish to Phases 6-8, deployment to Phase 9

---

**Last Updated:** 2025-01-04
**Document Version:** 3.0 (Restructured for incremental delivery)
