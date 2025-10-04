# AI Implementation Roadmap

## Document Purpose

This is a **living document** that guides AI agents through implementing Buck Euchre. Each AI agent should:
1. Read this roadmap before starting work
2. Choose an available task
3. Update status when starting/completing work
4. Document any design changes made
5. Mark dependencies satisfied

## Status Legend

- ⬜ **NOT_STARTED** - No work done
- 🟨 **IN_PROGRESS** - Currently being worked on (note: date and agent ID)
- ✅ **COMPLETE** - Finished and tested
- ⚠️ **BLOCKED** - Waiting on dependencies
- 🔄 **NEEDS_REVISION** - Complete but needs changes

---

## Phase 0: Project Setup & Foundation

### Task 0.1: Project Structure Setup
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Started:** _none_  
**Completed:** _none_

**Objective:** Create directory structure and package.json files

**What to Create:**
```
buck-euchre/
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── types/
│   │   ├── validators/
│   │   └── constants/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts (empty entry point)
│       ├── game/
│       ├── services/
│       ├── api/
│       ├── sockets/
│       └── db/
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx (empty entry)
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       └── services/
```

**Dependencies:**
- None (start here!)

**Can Change:**
- Exact subdirectory names (but keep logical structure)
- Build tool configuration

**Cannot Change:**
- Three-tier structure (shared, backend, frontend)
- TypeScript requirement
- Technology stack (React, Express, Prisma)

**Testing:**
- [ ] All directories exist
- [ ] `npm install` works in each workspace
- [ ] TypeScript compiles with no errors
- [ ] Can import from `shared` in both backend and frontend

**How to Mark Complete:**
Update this section:
```
Status: ✅ COMPLETE
Completed: 2025-01-04
Changes Made: [list any deviations from plan]
```

---

### Task 0.2: Shared Types Module
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.1

**Objective:** Implement all TypeScript interfaces in `shared/types/`

**What to Create:**
- `shared/types/game.ts` - GameState, Player, Card, Trick, Bid interfaces
- `shared/types/api.ts` - Request/response types for REST and WebSocket
- `shared/types/index.ts` - Export all types

**Reference:** GAME_STATE_SPEC.md sections "Core Data Types" and "Complete Game State"

**Key Interfaces to Implement:**
1. `Card` - suit, rank, id
2. `Player` - id, name, position, score, connected, hand, tricksTaken, folded
3. `Trick` - number, leadPlayerPosition, cards, winner
4. `Bid` - playerPosition, amount
5. `GameState` - complete state (see spec)
6. `GamePhase` - enum of all phases
7. All API request/response types from API_SPEC.md

**Can Change:**
- Add helper types/interfaces as needed
- Add utility types (Omit, Pick, etc.)

**Cannot Change:**
- Core field names (must match GAME_STATE_SPEC.md)
- Field types (e.g., score must be number)
- GamePhase enum values

**Testing:**
- [ ] All types compile
- [ ] No `any` types used
- [ ] All exports work from index.ts
- [ ] Types match GAME_STATE_SPEC.md exactly

**Update When Complete:**
```
Status: ✅ COMPLETE
Completed: YYYY-MM-DD
Changes: [any additions to spec]
```

---

### Task 0.3: Shared Constants Module
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.2

**Objective:** Define game constants

**What to Create:**
- `shared/constants/cards.ts` - Full deck definition, card rankings
- `shared/constants/rules.ts` - Starting score (15), win condition (≤0), bid range (2-5), etc.
- `shared/constants/index.ts` - Exports

**Example:**
```typescript
// cards.ts
export const SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const;
export const RANKS = ['9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'] as const;
export const FULL_DECK: Card[] = [ /* 24 cards */ ];

// rules.ts
export const STARTING_SCORE = 15;
export const WINNING_SCORE = 0;
export const MIN_BID = 2;
export const MAX_BID = 5;
export const CARDS_PER_PLAYER = 5;
export const BLIND_SIZE = 4;
export const EUCHRE_PENALTY = 5;
```

**Reference:** BUCK_EUCHRE_RULES.md

**Can Change:**
- Add more helper constants
- Organization of constants

**Cannot Change:**
- Rule values (must match BUCK_EUCHRE_RULES.md)

**Testing:**
- [ ] FULL_DECK has exactly 24 cards
- [ ] All constants match rules doc
- [ ] TypeScript compiles

---

### Task 0.4: Shared Validators Module
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.2

**Objective:** Create Zod schemas for validation

**What to Create:**
- `shared/validators/game.ts` - PlayCardPayload, PlaceBidPayload, etc.
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

// ... more schemas
```

**Reference:** API_SPEC.md

**Can Change:**
- Add additional validation logic
- Error messages

**Cannot Change:**
- Field names must match API spec
- Basic validation rules

**Testing:**
- [ ] Valid inputs pass validation
- [ ] Invalid inputs fail validation
- [ ] Error messages are clear

---

### Task 0.5: Database Schema (Prisma)
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.1

**Objective:** Create Prisma schema and initial migration

**What to Create:**
- `backend/prisma/schema.prisma` - Complete schema
- Run `npx prisma migrate dev --name init`

**Reference:** DATABASE_SCHEMA.md (complete Prisma schema provided)

**Can Change:**
- Index optimizations
- Optional fields (Round model details)

**Cannot Change:**
- Core models (Player, Game, GamePlayer, GameState)
- Foreign key relationships
- Required fields

**Testing:**
- [ ] `npx prisma generate` succeeds
- [ ] Migration applies cleanly
- [ ] Can create/query records manually
- [ ] Prisma Studio (`npx prisma studio`) works

---

## Phase 1: Backend - Pure Game Logic

### Task 1.1: Deck & Card Utilities
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.2, Task 0.3

**Objective:** Implement pure functions for deck operations

**What to Create:**
- `backend/src/game/deck.ts`

**Functions to Implement:**
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

**Reference:** GAME_STATE_SPEC.md - "Algorithms" section

**Can Change:**
- Shuffle algorithm (use Fisher-Yates or similar)
- Internal implementation details

**Cannot Change:**
- Function signatures
- Return types
- Card structure

**Testing:**
- [ ] createDeck() returns 24 unique cards
- [ ] shuffleDeck() randomizes order
- [ ] dealCards() gives 5 cards to each player, 4 to blind
- [ ] getEffectiveSuit() handles Left Bower correctly
- [ ] Write unit tests in `__tests__/deck.test.ts`

---

### Task 1.2: Card Ranking & Comparison
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 1.1

**Objective:** Implement card comparison logic

**What to Create:**
- `backend/src/game/cards.ts`

**Functions to Implement:**
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

**Reference:** GAME_STATE_SPEC.md - "Algorithms" section, BUCK_EUCHRE_RULES.md - "Card Rankings"

**Can Change:**
- Internal logic implementation

**Cannot Change:**
- Card ranking order (Right Bower > Left Bower > A > K > Q > 10 > 9 in trump)
- Function signatures

**Testing:**
- [ ] Right Bower beats Left Bower
- [ ] Left Bower beats Ace of trump
- [ ] Trump beats non-trump
- [ ] Off-suit loses to led suit
- [ ] Write comprehensive unit tests

---

### Task 1.3: Trick Evaluation
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 1.2

**Objective:** Determine trick winner

**What to Create:**
- `backend/src/game/trick.ts`

**Functions to Implement:**
```typescript
export function determineTrickWinner(
  trick: Trick,
  trumpSuit: Card['suit'],
  activePlayers: number[]  // Players who didn't fold
): number  // Winner's position
```

**Reference:** GAME_STATE_SPEC.md - "Trick Winner Determination"

**Key Logic:**
- Only consider players who stayed in (didn't fold)
- Trump beats non-trump
- Highest trump wins
- If no trump, highest of led suit wins

**Can Change:**
- Internal algorithm (as long as correct)

**Cannot Change:**
- Function signature
- Trick winner logic

**Testing:**
- [ ] Trump card wins over non-trump
- [ ] Right Bower wins all tricks
- [ ] Left Bower beats other trumps
- [ ] Led suit wins when no trump played
- [ ] Folded players ignored in evaluation
- [ ] Write unit tests with various scenarios

---

### Task 1.4: Scoring Logic
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.2

**Objective:** Calculate round scores

**What to Create:**
- `backend/src/game/scoring.ts`

**Functions to Implement:**
```typescript
export function calculateRoundScores(
  players: Player[],
  winningBidderPosition: number,
  bid: number
): Record<number, number>  // position -> score change

export function checkWinCondition(
  players: Player[]
): { winner: number | null; gameOver: boolean }
```

**Scoring Rules (Reference: BUCK_EUCHRE_RULES.md):**
- Bidder made contract: -tricksTaken
- Bidder failed: +5
- Non-bidder stayed in, took 1+: -tricksTaken
- Non-bidder stayed in, took 0: +5
- Folded: 0
- Win condition: score ≤ 0

**Can Change:**
- Internal calculation logic

**Cannot Change:**
- Scoring rules
- Function signatures

**Testing:**
- [ ] Bidder who makes contract scores correctly
- [ ] Bidder who fails gets +5
- [ ] Non-bidders score correctly
- [ ] Folded players get 0
- [ ] Win condition detects score ≤ 0
- [ ] Write comprehensive unit tests

---

### Task 1.5: Move Validation
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 1.1, Task 0.2

**Objective:** Validate player actions

**What to Create:**
- `backend/src/game/validation.ts`

**Functions to Implement:**
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
  isDealer: boolean,
  allOthersPassed: boolean
): { valid: boolean; reason?: string }

export function canFold(
  isClubsTurnUp: boolean,
  isBidder: boolean
): { valid: boolean; reason?: string }
```

**Reference:** GAME_STATE_SPEC.md - "Follow Suit Validation", BUCK_EUCHRE_RULES.md

**Key Rules:**
- Must follow suit if able (including Left Bower as trump)
- Bids must be higher than current bid
- Dealer must bid if all others pass
- Cannot fold if Clubs turn-up
- Bidder cannot fold

**Can Change:**
- Error message wording

**Cannot Change:**
- Validation rules
- Function signatures

**Testing:**
- [ ] Follow suit validation works
- [ ] Left Bower treated as trump suit
- [ ] Bid validation works
- [ ] Fold validation works
- [ ] Write unit tests for all rules

---

### Task 1.6: State Transitions
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 1.1, Task 1.3, Task 1.4, Task 1.5

**Objective:** Pure functions for state updates

**What to Create:**
- `backend/src/game/state.ts`

**Functions to Implement:**
```typescript
export function initializeGame(playerIds: string[]): GameState
export function dealNewRound(state: GameState): GameState
export function applyBid(state: GameState, playerPosition: number, bid: Bid['amount']): GameState
export function applyTrumpDeclaration(state: GameState, trumpSuit: Card['suit']): GameState
export function applyFoldDecision(state: GameState, playerPosition: number, folded: boolean): GameState
export function applyCardPlay(state: GameState, playerPosition: number, cardId: string): GameState
export function finishRound(state: GameState): GameState
```

**Key Principle:** These must be PURE functions (no I/O, no mutation)
- Take current state as input
- Return new state as output
- No database calls, no socket emits

**Reference:** GAME_STATE_SPEC.md - "State Transitions"

**Can Change:**
- Internal implementation

**Cannot Change:**
- Must be pure functions
- State structure (must match GameState interface)
- Phase transition logic

**Testing:**
- [ ] Each function returns new state (doesn't mutate)
- [ ] Phase transitions work correctly
- [ ] All state changes are valid
- [ ] Write unit tests for each function
- [ ] Test full game flow end-to-end

---

## Phase 2: Backend - Services Layer

### Task 2.1: Database Client Setup
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.5

**Objective:** Set up Prisma client

**What to Create:**
- `backend/src/db/client.ts`

**Implementation:**
```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
```

**Can Change:**
- Logging configuration
- Connection settings

**Cannot Change:**
- Must use Prisma
- Must export singleton client

**Testing:**
- [ ] Can connect to database
- [ ] Can perform basic queries
- [ ] Handles connection errors gracefully

---

### Task 2.2: Player Service
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 2.1

**Objective:** Player session management

**What to Create:**
- `backend/src/services/player.service.ts`

**Functions to Implement:**
```typescript
export async function createPlayer(name: string): Promise<{ player: Player; token: string }>
export async function validatePlayer(playerId: string): Promise<Player | null>
export async function getPlayerFromToken(token: string): Promise<Player | null>
```

**Reference:** DATABASE_SCHEMA.md, API_SPEC.md (auth section)

**Can Change:**
- Internal implementation
- Token generation logic

**Cannot Change:**
- JWT token structure (must include playerId, name)
- 24-hour expiration

**Testing:**
- [ ] Creates player in database
- [ ] Generates valid JWT token
- [ ] Token validation works
- [ ] Token expiration works

---

### Task 2.3: Game Service
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 2.1, Task 1.6

**Objective:** Game lifecycle management

**What to Create:**
- `backend/src/services/game.service.ts`

**Functions to Implement:**
```typescript
export async function createGame(creatorId: string): Promise<Game>
export async function joinGame(gameId: string, playerId: string): Promise<GameState>
export async function leaveGame(gameId: string, playerId: string): Promise<void>
export async function listAvailableGames(): Promise<GameSummary[]>
export async function getGameState(gameId: string): Promise<GameState | null>
```

**Key Responsibilities:**
- Manage game lifecycle in database
- Bridge between pure game logic and persistence
- Coordinate with state service

**Reference:** DATABASE_SCHEMA.md, API_SPEC.md

**Can Change:**
- Internal query optimizations

**Cannot Change:**
- Function signatures
- Game creation flow

**Testing:**
- [ ] Creates game in database
- [ ] Adds players correctly (positions 0-3)
- [ ] Prevents joining full games
- [ ] Lists games correctly
- [ ] Write integration tests

---

### Task 2.4: State Service
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 2.1, Task 1.6

**Objective:** In-memory state management + persistence

**What to Create:**
- `backend/src/services/state.service.ts`

**Implementation:**
```typescript
// In-memory game state store
const activeGames = new Map<string, GameState>();

export function getActiveGameState(gameId: string): GameState | null
export function setActiveGameState(gameId: string, state: GameState): void
export async function saveGameState(gameId: string, state: GameState): Promise<void>
export async function loadGameState(gameId: string): Promise<GameState | null>
export function deleteGameState(gameId: string): void
```

**Key Responsibilities:**
- In-memory Map for fast access
- Persist to database on each change
- Load from database on server restart

**Reference:** DATABASE_SCHEMA.md (GameState model)

**Can Change:**
- Caching strategy
- When to persist

**Cannot Change:**
- Must maintain in-memory state
- Must persist to database

**Testing:**
- [ ] In-memory operations work
- [ ] Persists to database correctly
- [ ] Loads from database correctly
- [ ] JSON serialization works

---

## Phase 3: Backend - API Layer

### Task 3.1: Authentication Middleware
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 2.2

**Objective:** JWT validation middleware

**What to Create:**
- `backend/src/auth/jwt.ts` - JWT utilities
- `backend/src/auth/middleware.ts` - Express middleware

**Functions to Implement:**
```typescript
// jwt.ts
export function generateToken(playerId: string, playerName: string): string
export function verifyToken(token: string): { playerId: string; playerName: string } | null

// middleware.ts
export function authenticateToken(req, res, next)
```

**Reference:** API_SPEC.md (authentication section)

**Can Change:**
- Token payload structure (add fields)
- Error response format

**Cannot Change:**
- Must use JWT
- Must validate on protected routes

**Testing:**
- [ ] Generates valid tokens
- [ ] Validates correct tokens
- [ ] Rejects invalid/expired tokens
- [ ] Middleware blocks unauthorized requests

---

### Task 3.2: REST API Routes
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 3.1, Task 2.2, Task 2.3

**Objective:** Implement REST endpoints

**What to Create:**
- `backend/src/api/health.routes.ts`
- `backend/src/api/auth.routes.ts`
- `backend/src/api/game.routes.ts`
- `backend/src/api/index.ts` - Route aggregator

**Endpoints to Implement:**
```typescript
// health.routes.ts
GET /health

// auth.routes.ts
POST /api/auth/join

// game.routes.ts
POST /api/games
GET /api/games
GET /api/games/:gameId
```

**Reference:** API_SPEC.md - "REST API Endpoints"

**Can Change:**
- Error handling details
- Response formatting

**Cannot Change:**
- Endpoint paths
- Request/response structure (must match API spec)
- HTTP methods

**Testing:**
- [ ] All endpoints respond correctly
- [ ] Validation works (use Zod schemas)
- [ ] Authentication works
- [ ] Error handling works
- [ ] Write integration tests

---

### Task 3.3: WebSocket Connection Handling
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 3.1

**Objective:** Socket.io setup and authentication

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
      // Handle disconnect
    });
    
    // Register game event handlers
    registerGameHandlers(io, socket);
  });
}
```

**Reference:** API_SPEC.md - "WebSocket API"

**Can Change:**
- Connection logging
- Disconnect handling details

**Cannot Change:**
- Must authenticate via JWT token
- Must use Socket.io rooms

**Testing:**
- [ ] Connection requires valid token
- [ ] Invalid tokens rejected
- [ ] Disconnect handling works
- [ ] Socket.data contains player info

---

### Task 3.4: WebSocket Game Event Handlers
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 3.3, Task 2.3, Task 2.4, Task 1.6

**Objective:** Implement game action handlers

**What to Create:**
- `backend/src/sockets/game.ts`

**Events to Implement:**
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

**Pattern for Each Handler:**
1. Validate payload (Zod schema)
2. Get current game state
3. Validate action against game rules
4. Apply state transition (pure function)
5. Persist state
6. Broadcast update to room

**Reference:** API_SPEC.md - "WebSocket Events", GAME_STATE_SPEC.md

**Can Change:**
- Error message details
- Event emission timing

**Cannot Change:**
- Event names (must match API spec)
- Payload structure
- Validation rules

**Testing:**
- [ ] All events work correctly
- [ ] Validation rejects invalid actions
- [ ] State updates correctly
- [ ] Broadcasts work
- [ ] Error handling works
- [ ] Write integration tests

---

### Task 3.5: Express Server Setup
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 3.2, Task 3.3

**Objective:** Main server file

**What to Create:**
- `backend/src/server.ts`
- `backend/src/config/env.ts`
- `backend/src/index.ts`

**Implementation:**
```typescript
// server.ts
export function createServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN } });
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Routes
  app.use('/', apiRoutes);
  
  // WebSocket
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

main();
```

**Reference:** ARCHITECTURE.md

**Can Change:**
- Middleware order
- Logging details

**Cannot Change:**
- Must use Express + Socket.io
- Must load environment variables

**Testing:**
- [ ] Server starts successfully
- [ ] Environment variables load
- [ ] CORS works
- [ ] REST and WebSocket both work

---

## Phase 4: Frontend - Foundation

### Task 4.1: Vite + React Setup
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 0.1

**Objective:** Frontend build setup

**What to Create:**
- `frontend/vite.config.ts`
- `frontend/tailwind.config.js`
- `frontend/tsconfig.json`
- `frontend/index.html`
- `frontend/src/main.tsx` (minimal)
- `frontend/src/App.tsx` (minimal)

**Configuration:**
- Vite with React + TypeScript
- Tailwind CSS with Shadcn/ui
- Path aliases (@/ for src/)

**Can Change:**
- Vite plugins
- Tailwind configuration

**Cannot Change:**
- Must use Vite
- Must use Tailwind

**Testing:**
- [ ] `npm run dev` starts dev server
- [ ] Hot reload works
- [ ] TypeScript compiles
- [ ] Can import from shared package

---

### Task 4.2: API Client Service
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 4.1, Task 0.2

**Objective:** REST API client

**What to Create:**
- `frontend/src/services/api.ts`

**Functions to Implement:**
```typescript
export async function joinSession(playerName: string): Promise<AuthResponse>
export async function createGame(): Promise<CreateGameResponse>
export async function listGames(): Promise<ListGamesResponse>
export async function getGameState(gameId: string): Promise<GameState>
```

**Implementation:**
- Use fetch API
- Handle errors
- Include auth token in headers

**Reference:** API_SPEC.md

**Can Change:**
- Error handling
- Request interceptors

**Cannot Change:**
- Endpoint paths
- Request/response types

**Testing:**
- [ ] All requests work
- [ ] Auth token included
- [ ] Errors handled gracefully

---

### Task 4.3: Socket Client Service
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 4.1, Task 0.2

**Objective:** WebSocket client

**What to Create:**
- `frontend/src/services/socket.ts`

**Implementation:**
```typescript
import io from 'socket.io-client';

export function createSocketConnection(token: string) {
  const socket = io(import.meta.env.VITE_WS_URL, {
    auth: { token }
  });
  
  return socket;
}

export function emitJoinGame(socket: Socket, gameId: string) {
  socket.emit('JOIN_GAME', { gameId });
}

// ... other emit functions
```

**Reference:** API_SPEC.md - "WebSocket API"

**Can Change:**
- Connection options
- Helper functions

**Cannot Change:**
- Event names
- Payload structure

**Testing:**
- [ ] Connects successfully
- [ ] Emits events correctly
- [ ] Receives events
- [ ] Handles disconnection

---

### Task 4.4: State Management (Zustand Stores)
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 4.2, Task 4.3

**Objective:** Client-side state management

**What to Create:**
- `frontend/src/stores/authStore.ts`
- `frontend/src/stores/gameStore.ts`
- `frontend/src/stores/uiStore.ts`

**Stores to Implement:**
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
  // Derived state
  isMyTurn: () => boolean;
  playableCards: () => Card[];
}

// uiStore.ts
interface UIStore {
  showModal: string | null;
  error: string | null;
  setError: (error: string) => void;
  clearError: () => void;
}
```

**Reference:** ARCHITECTURE.md - "State Management Strategy"

**Can Change:**
- Store structure (add fields)
- Derived state calculations

**Cannot Change:**
- Must use Zustand
- gameState must match GameState interface

**Testing:**
- [ ] Stores update correctly
- [ ] Derived state calculates correctly
- [ ] localStorage persistence works (auth)

---

### Task 4.5: Custom Hooks
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 4.4

**Objective:** Reusable React hooks

**What to Create:**
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/hooks/useSocket.ts`
- `frontend/src/hooks/useGame.ts`

**Hooks to Implement:**
```typescript
// useAuth.ts
export function useAuth() {
  const { playerId, playerName, token, login, logout } = useAuthStore();
  
  const joinSession = async (name: string) => {
    const response = await api.joinSession(name);
    login(response);
  };
  
  return { playerId, playerName, token, joinSession, logout };
}

// useSocket.ts
export function useSocket() {
  const token = useAuthStore(state => state.token);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  useEffect(() => {
    if (token) {
      const s = createSocketConnection(token);
      setSocket(s);
      return () => s.disconnect();
    }
  }, [token]);
  
  return socket;
}

// useGame.ts
export function useGame(gameId: string) {
  const socket = useSocket();
  const { gameState, setGameState } = useGameStore();
  
  useEffect(() => {
    if (socket) {
      socket.emit('JOIN_GAME', { gameId });
      socket.on('GAME_STATE_UPDATE', (data) => {
        setGameState(data.gameState);
      });
    }
  }, [socket, gameId]);
  
  return { gameState };
}
```

**Can Change:**
- Hook implementations
- Add more hooks

**Cannot Change:**
- Hook naming convention (use*)
- Must follow React hooks rules

**Testing:**
- [ ] Hooks work correctly
- [ ] Cleanup happens on unmount
- [ ] Re-renders trigger correctly

---

## Phase 5: Frontend - UI Components

### Task 5.1: Shadcn/ui Setup + Base Components
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 4.1

**Objective:** Install Shadcn/ui components

**What to Do:**
```bash
cd frontend
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add separator
```

**Creates:**
- `frontend/src/components/ui/` directory with components

**Can Change:**
- Theme colors
- Component customization

**Cannot Change:**
- Must use Shadcn/ui
- Must use Tailwind

**Testing:**
- [ ] Components render
- [ ] Styling works
- [ ] Dark/light mode works (if implemented)

---

### Task 5.2: Layout Components
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1

**Objective:** App layout structure

**What to Create:**
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Layout.tsx`

**Components:**
```typescript
// Header.tsx
export function Header() {
  const { playerName } = useAuth();
  return (
    <header className="...">
      <h1>Buck Euchre</h1>
      {playerName && <span>Playing as: {playerName}</span>}
    </header>
  );
}

// Layout.tsx
export function Layout({ children }) {
  return (
    <div className="...">
      <Header />
      <main>{children}</main>
    </div>
  );
}
```

**Can Change:**
- Styling
- Additional layout elements

**Cannot Change:**
- Must wrap all pages

**Testing:**
- [ ] Renders correctly
- [ ] Responsive design works

---

### Task 5.3: Authentication Components
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1, Task 4.5

**Objective:** Login/join flow

**What to Create:**
- `frontend/src/components/auth/JoinSession.tsx`

**Component:**
```typescript
export function JoinSession() {
  const [name, setName] = useState('');
  const { joinSession } = useAuth();
  
  const handleJoin = async () => {
    await joinSession(name);
  };
  
  return (
    <Card>
      <Input value={name} onChange={e => setName(e.target.value)} />
      <Button onClick={handleJoin}>Join</Button>
    </Card>
  );
}
```

**Can Change:**
- UI design
- Validation feedback

**Cannot Change:**
- Must validate name (2-20 chars)

**Testing:**
- [ ] Form validation works
- [ ] Join succeeds
- [ ] Errors displayed

---

### Task 5.4: Lobby Components
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1, Task 4.5

**Objective:** Game creation and listing

**What to Create:**
- `frontend/src/components/lobby/GameList.tsx`
- `frontend/src/components/lobby/CreateGame.tsx`

**Components:**
```typescript
// GameList.tsx
export function GameList() {
  const [games, setGames] = useState([]);
  
  useEffect(() => {
    const fetchGames = async () => {
      const data = await api.listGames();
      setGames(data.games);
    };
    fetchGames();
  }, []);
  
  return (
    <div>
      {games.map(game => (
        <GameListItem key={game.gameId} game={game} />
      ))}
    </div>
  );
}

// CreateGame.tsx
export function CreateGame() {
  const navigate = useNavigate();
  
  const handleCreate = async () => {
    const game = await api.createGame();
    navigate(`/game/${game.gameId}`);
  };
  
  return <Button onClick={handleCreate}>Create Game</Button>;
}
```

**Can Change:**
- UI design
- Refresh logic

**Cannot Change:**
- Must show player count
- Must navigate to game on join

**Testing:**
- [ ] Lists games correctly
- [ ] Create game works
- [ ] Join game works

---

### Task 5.5: Card Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1

**Objective:** Visual card representation

**What to Create:**
- `frontend/src/components/game/Card.tsx`

**Component:**
```typescript
interface CardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  faceDown?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function Card({ card, onClick, disabled, faceDown, size = 'medium' }: CardProps) {
  // Render card with suit symbol, rank, and styling
  // Use Tailwind for responsive sizing
  // Show red for hearts/diamonds, black for spades/clubs
  // Handle faceDown (show card back)
}
```

**Can Change:**
- Visual design
- Animations
- Card back design

**Cannot Change:**
- Must show suit and rank when face up
- Must distinguish colors

**Testing:**
- [ ] Renders all cards correctly
- [ ] Colors are correct
- [ ] Click handler works
- [ ] Disabled state works
- [ ] Face down shows card back

---

### Task 5.6: Player Hand Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.5, Task 4.5

**Objective:** Display player's cards

**What to Create:**
- `frontend/src/components/game/PlayerHand.tsx`

**Component:**
```typescript
export function PlayerHand() {
  const { gameState } = useGame();
  const { playableCards, isMyTurn } = useGameStore();
  const socket = useSocket();
  
  const myHand = gameState?.players[myPosition]?.hand || [];
  const playable = playableCards();
  
  const handleCardClick = (card: Card) => {
    if (isMyTurn() && playable.includes(card)) {
      socket?.emit('PLAY_CARD', { gameId, cardId: card.id });
    }
  };
  
  return (
    <div className="flex gap-2">
      {myHand.map(card => (
        <Card 
          key={card.id}
          card={card}
          onClick={() => handleCardClick(card)}
          disabled={!playable.includes(card)}
        />
      ))}
    </div>
  );
}
```

**Can Change:**
- Layout (fan, grid, etc.)
- Animations

**Cannot Change:**
- Must highlight playable cards
- Must disable unplayable cards

**Testing:**
- [ ] Shows correct cards
- [ ] Playable cards highlighted
- [ ] Plays card on click
- [ ] Follow suit validation works

---

### Task 5.7: Current Trick Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.5

**Objective:** Display cards played in current trick

**What to Create:**
- `frontend/src/components/game/CurrentTrick.tsx`

**Component:**
```typescript
export function CurrentTrick() {
  const { gameState } = useGame();
  const currentTrick = gameState?.currentTrick;
  
  if (!currentTrick) return null;
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(position => {
        const playedCard = currentTrick.cards.find(
          c => c.playerPosition === position
        );
        return (
          <div key={position}>
            {playedCard ? (
              <Card card={playedCard.card} />
            ) : (
              <div className="card-placeholder" />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Can Change:**
- Layout (circle, square, etc.)
- Animations

**Cannot Change:**
- Must show all 4 positions
- Must show which player played which card

**Testing:**
- [ ] Shows cards correctly
- [ ] Updates in real-time
- [ ] Shows player positions

---

### Task 5.8: Scoreboard Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1

**Objective:** Display player scores

**What to Create:**
- `frontend/src/components/game/Scoreboard.tsx`

**Component:**
```typescript
export function Scoreboard() {
  const { gameState } = useGame();
  
  if (!gameState) return null;
  
  const sortedPlayers = [...gameState.players].sort((a, b) => a.score - b.score);
  
  return (
    <Card>
      <h3>Scores (Race to 0)</h3>
      {sortedPlayers.map(player => (
        <div key={player.id} className="flex justify-between">
          <span>{player.name}</span>
          <Badge variant={player.score <= 0 ? 'success' : 'default'}>
            {player.score}
          </Badge>
        </div>
      ))}
    </Card>
  );
}
```

**Can Change:**
- Visual design
- Sorting

**Cannot Change:**
- Must show all player scores
- Must highlight winner (score ≤ 0)

**Testing:**
- [ ] Shows all players
- [ ] Scores update correctly
- [ ] Winner highlighted

---

### Task 5.9: Bidding Panel Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1, Task 4.5

**Objective:** Bidding interface

**What to Create:**
- `frontend/src/components/game/BiddingPanel.tsx`

**Component:**
```typescript
export function BiddingPanel() {
  const { gameState } = useGame();
  const socket = useSocket();
  
  const isMyTurn = gameState?.currentBidder === myPosition;
  const minBid = (gameState?.highestBid || 1) + 1;
  
  const handleBid = (amount: number | 'PASS') => {
    socket?.emit('PLACE_BID', { gameId, amount });
  };
  
  if (gameState?.phase !== 'BIDDING') return null;
  
  return (
    <Card>
      <h3>Bidding</h3>
      <div className="flex gap-2">
        {[2, 3, 4, 5].map(bid => (
          <Button 
            key={bid}
            onClick={() => handleBid(bid)}
            disabled={!isMyTurn || bid < minBid}
          >
            {bid}
          </Button>
        ))}
        <Button onClick={() => handleBid('PASS')} disabled={!isMyTurn}>
          Pass
        </Button>
      </div>
      <div>Current High Bid: {gameState.highestBid || 'None'}</div>
    </Card>
  );
}
```

**Can Change:**
- UI design
- Button layout

**Cannot Change:**
- Bid range (2-5)
- Must disable invalid bids

**Testing:**
- [ ] Shows when phase is BIDDING
- [ ] Only active for current bidder
- [ ] Disables invalid bids
- [ ] Sends bid correctly

---

### Task 5.10: Trump Selector Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1, Task 4.5

**Objective:** Trump declaration interface

**What to Create:**
- `frontend/src/components/game/TrumpSelector.tsx`

**Component:**
```typescript
export function TrumpSelector() {
  const { gameState } = useGame();
  const socket = useSocket();
  
  const handleSelectTrump = (suit: Card['suit']) => {
    socket?.emit('DECLARE_TRUMP', { gameId, trumpSuit: suit });
  };
  
  if (gameState?.phase !== 'DECLARING_TRUMP') return null;
  if (gameState.currentPlayerPosition !== myPosition) return null;
  
  return (
    <Dialog open={true}>
      <h3>Declare Trump Suit</h3>
      <div className="grid grid-cols-2 gap-4">
        {['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'].map(suit => (
          <Button key={suit} onClick={() => handleSelectTrump(suit)}>
            {suit}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
```

**Can Change:**
- UI design
- Suit symbols

**Cannot Change:**
- Must show all 4 suits
- Only winning bidder can select

**Testing:**
- [ ] Shows only for winning bidder
- [ ] Shows in correct phase
- [ ] Sends selection correctly
- [ ] Modal/dialog behavior

---

### Task 5.11: Fold Decision Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.1, Task 4.5

**Objective:** Fold/stay decision interface

**What to Create:**
- `frontend/src/components/game/FoldDecision.tsx`

**Component:**
```typescript
export function FoldDecision() {
  const { gameState } = useGame();
  const socket = useSocket();
  
  const handleDecision = (folded: boolean) => {
    socket?.emit('FOLD_DECISION', { gameId, folded });
  };
  
  if (gameState?.phase !== 'FOLDING_DECISION') return null;
  if (gameState.winningBidderPosition === myPosition) return null;
  if (gameState.players[myPosition].folded !== undefined) return null;
  
  const canFold = !gameState.isClubsTurnUp;  // Can't fold if Clubs turn-up
  
  return (
    <Dialog open={true}>
      <h3>Trump is {gameState.trumpSuit}</h3>
      <p>Stay in or fold?</p>
      <div className="flex gap-2">
        <Button onClick={() => handleDecision(false)}>Stay In</Button>
        <Button 
          onClick={() => handleDecision(true)} 
          disabled={!canFold}
          title={!canFold ? "Can't fold - Clubs turned up" : ""}
        >
          Fold
        </Button>
      </div>
    </Dialog>
  );
}
```

**Can Change:**
- UI messaging
- Dialog design

**Cannot Change:**
- Fold disabled if Clubs turn-up
- Only non-bidders see this

**Testing:**
- [ ] Shows for non-bidders only
- [ ] Fold disabled if Clubs
- [ ] Sends decision correctly
- [ ] Doesn't show if already decided

---

### Task 5.12: Game Board Component
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 5.6, Task 5.7, Task 5.8, Task 5.9, Task 5.10, Task 5.11

**Objective:** Main game view combining all components

**What to Create:**
- `frontend/src/components/game/GameBoard.tsx`

**Component:**
```typescript
export function GameBoard({ gameId }: { gameId: string }) {
  const { gameState } = useGame(gameId);
  
  if (!gameState) return <div>Loading...</div>;
  
  return (
    <div className="game-board">
      <Scoreboard />
      <CurrentTrick />
      <PlayerHand />
      
      {/* Conditional UI based on phase */}
      <BiddingPanel />
      <TrumpSelector />
      <FoldDecision />
      
      {/* Game info */}
      <div>
        Round: {gameState.round}
        {gameState.trumpSuit && <span>Trump: {gameState.trumpSuit}</span>}
      </div>
    </div>
  );
}
```

**Can Change:**
- Layout design
- Responsive behavior

**Cannot Change:**
- Must show all relevant components
- Must be responsive

**Testing:**
- [ ] All components render
- [ ] Responsive design works
- [ ] Updates in real-time
- [ ] Phase transitions work

---

## Phase 6: Integration & Testing

### Task 6.1: End-to-End Game Flow Test
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** All previous tasks

**Objective:** Test complete game from start to finish

**What to Test:**
1. 4 players join
2. Cards dealt
3. Trump revealed (blind card)
4. Bidding completes
5. Trump declared
6. Fold decisions made
7. 5 tricks played
8. Scores calculated correctly
9. Next round starts
10. Game ends when player reaches 0

**Testing Method:**
- Manual testing with 4 browser tabs
- Automated with Playwright (optional)

**Success Criteria:**
- [ ] Complete game plays without errors
- [ ] All rules enforced correctly
- [ ] Scoring works correctly
- [ ] Win condition triggers

---

### Task 6.2: Edge Case Testing
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 6.1

**Objective:** Test edge cases

**What to Test:**
1. Dealer forced to bid (all others pass)
2. Clubs turn-up (no folding)
3. All non-bidders fold
4. Multiple players reach 0 same round
5. Disconnection/reconnection
6. Invalid moves rejected
7. Follow suit violations
8. Left Bower as trump

**Success Criteria:**
- [ ] All edge cases handled
- [ ] No crashes
- [ ] Error messages clear

---

### Task 6.3: Performance & Load Testing
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 6.1

**Objective:** Ensure performance is adequate

**What to Test:**
1. Multiple concurrent games (10-20)
2. WebSocket message latency
3. Database query performance
4. Memory leaks

**Success Criteria:**
- [ ] <100ms WebSocket latency
- [ ] No memory leaks
- [ ] Handles 20 concurrent games

---

## Phase 7: Deployment

### Task 7.1: Docker Configuration
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** All backend and frontend tasks

**Objective:** Create Docker setup

**What to Create:**
- `backend/Dockerfile`
- `backend/Dockerfile.dev`
- `frontend/Dockerfile`
- `frontend/Dockerfile.dev`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `nginx/nginx.conf`

**Reference:** Original docker-compose files (deleted earlier)

**Can Change:**
- Optimization settings

**Cannot Change:**
- Container structure
- Port mappings

**Testing:**
- [ ] `docker-compose up` works
- [ ] All services start
- [ ] Can access app
- [ ] Database persists

---

### Task 7.2: Environment Configuration
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 7.1

**Objective:** Production-ready configuration

**What to Do:**
1. Validate `.env.example` is complete
2. Add security headers
3. Configure CORS properly
4. Set up logging
5. Add health checks

**Success Criteria:**
- [ ] All env vars documented
- [ ] Security headers set
- [ ] CORS configured
- [ ] Logs work

---

### Task 7.3: Production Deployment Guide
**Status:** ⬜ NOT_STARTED  
**Assigned to:** _none_  
**Dependencies:** Task 7.2

**Objective:** Document deployment process

**What to Create:**
- `DEPLOYMENT.md` with step-by-step instructions

**Should Include:**
1. Server requirements
2. Initial setup steps
3. Environment configuration
4. Running docker-compose
5. Backup strategy
6. Monitoring setup
7. Troubleshooting

**Success Criteria:**
- [ ] Can deploy to fresh VPS following guide
- [ ] Backup script works
- [ ] App accessible from internet

---

## Guidelines for AI Agents

### Before Starting Work

1. **Read the roadmap** - Understand all tasks
2. **Check dependencies** - Ensure prerequisite tasks are complete
3. **Read reference docs** - Review linked specification documents
4. **Claim the task** - Update status to IN_PROGRESS with your ID

### While Working

1. **Follow the spec** - Don't deviate from design docs without updating them
2. **Test as you go** - Complete testing checklist
3. **Document changes** - Note any deviations in the task
4. **Ask questions** - Update roadmap with questions if blocked

### When Complete

1. **Run all tests** - Ensure testing checklist is ✅
2. **Update status** - Mark as COMPLETE with date
3. **Document changes** - List any alterations made
4. **Unblock dependents** - Check if your completion unblocks other tasks

### Communication Format

When updating a task:
```
Status: 🟨 IN_PROGRESS
Assigned to: AI-Agent-12345
Started: 2025-01-05
Progress: Implemented 3/5 functions, working on validation
Blockers: None
```

When completing:
```
Status: ✅ COMPLETE
Completed: 2025-01-05
Changes Made:
- Added helper function `isValidBid()` for clarity
- Updated GAME_STATE_SPEC.md to clarify dealer-stuck rule
Testing: All tests passing (see __tests__/validation.test.ts)
```

### If You Need to Change Design

1. Update the relevant design document (RULES, SPEC, API, etc.)
2. Note the change in this roadmap
3. Check if change affects other tasks
4. Update dependent tasks if needed

### If You Find a Bug in the Spec

1. Mark task as 🔄 NEEDS_REVISION
2. Document the issue
3. Update the spec document
4. Resume work

---

## Progress Overview

**Overall Progress:** 0/43 tasks complete (0%)

### By Phase:
- Phase 0 (Foundation): 0/5 complete (0%)
- Phase 1 (Game Logic): 0/6 complete (0%)
- Phase 2 (Services): 0/4 complete (0%)
- Phase 3 (Backend API): 0/5 complete (0%)
- Phase 4 (Frontend Foundation): 0/5 complete (0%)
- Phase 5 (UI Components): 0/12 complete (0%)
- Phase 6 (Testing): 0/3 complete (0%)
- Phase 7 (Deployment): 0/3 complete (0%)

### Next Available Tasks:
1. Task 0.1 - Project Structure Setup (no dependencies)

---

## Design Document Changelog

Track changes to design documents here:

### BUCK_EUCHRE_RULES.md
- 2025-01-04: Fixed rules (5 cards, blind, folding, countdown scoring)

### GAME_STATE_SPEC.md
- _No changes yet_

### API_SPEC.md
- _No changes yet_

### DATABASE_SCHEMA.md
- _No changes yet_

### ARCHITECTURE.md
- _No changes yet_

---

## Questions & Decisions Log

Track major decisions and open questions:

### Open Questions:
- _None yet_

### Decisions Made:
- 2025-01-04: Use npm instead of pnpm for better AI compatibility
- 2025-01-04: PostgreSQL in Docker (not RDS) for cost savings

---

**Last Updated:** 2025-01-04
**Document Version:** 1.0

