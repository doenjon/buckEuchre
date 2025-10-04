# Architecture

## Overview

Buck Euchre is a real-time multiplayer web application built with a client-server architecture. This document defines the system architecture, technology choices, and implementation strategy optimized for AI-driven development.

### Implementation Philosophy: MVP → Production

This project is organized for **incremental delivery**:
- **Phases 1-5 (~4 weeks)**: Playable MVP with basic UI
- **Phases 6-8 (~2 weeks)**: Production polish (error handling, testing, reconnection)
- **Phase 9 (~1 week)**: Deployment infrastructure (Docker, monitoring)

See AI_IMPLEMENTATION_ROADMAP.md for detailed task breakdown.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Client                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │         React App (Vite + TypeScript)             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │UI Comps  │  │  State   │  │   Services   │   │   │
│  │  │(Shadcn)  │  │(Zustand) │  │ (Socket.io)  │   │   │
│  │  └──────────┘  └──────────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ HTTP/WebSocket
                         │
┌─────────────────────────────────────────────────────────┐
│                        Server                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │      Node.js + Express + Socket.io                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │   REST   │  │ WebSocket│  │  Game Logic  │   │   │
│  │  │    API   │  │ Handlers │  │   (Pure)     │   │   │
│  │  └──────────┘  └──────────┘  └──────────────┘   │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │         Prisma ORM Client                 │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ SQL
                         │
┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────────┐         │
│   │  Player  │  │   Game   │  │  GameState   │         │
│   │GamePlayer│  │  Round   │  │              │         │
│   └──────────┘  └──────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast dev server, optimized builds)
- **Styling**: Tailwind CSS (utility-first, rapid UI development)
- **UI Components**: Shadcn/ui (accessible, customizable components)
- **State Management**: Zustand (lightweight, simple API)
- **WebSocket Client**: Socket.io-client
- **HTTP Client**: Fetch API (native, no dependencies)

### Backend
- **Runtime**: Node.js 20+ LTS
- **Framework**: Express (minimal, well-documented)
- **WebSocket**: Socket.io (reliable, auto-reconnect, room support)
- **Language**: TypeScript (type safety, better DX)
- **Database**: Prisma ORM (type-safe, migrations, great DX)
- **Validation**: Zod (TypeScript-first schema validation)
- **Authentication**: JWT (jsonwebtoken) - simple name-based auth

### Database
- **Engine**: PostgreSQL 16
- **Why**: ACID compliance, JSON support, mature ecosystem

### Deployment
- **Containerization**: Docker + Docker Compose
- **Target**: AWS Lightsail / EC2 (or any VPS)
- **Reverse Proxy**: Nginx (for production)
- **Cost**: ~$5/month for 10-20 concurrent users

### Package Manager
- **Choice**: npm (most universal, AI-friendly)
- **Not pnpm**: Changed from original plan for better compatibility

## Directory Structure

```
buck-euchre/
├── shared/                    # Shared code between frontend/backend
│   ├── types/                 # TypeScript interfaces/types
│   │   ├── game.ts           # GameState, Card, Player, Trick, etc.
│   │   ├── api.ts            # API request/response types
│   │   └── index.ts          # Exports all types
│   ├── validators/            # Zod schemas
│   │   ├── game.ts           # Game action validators
│   │   ├── auth.ts           # Auth validators
│   │   └── index.ts
│   └── constants/             # Shared constants
│       ├── cards.ts          # Deck definition, card rankings
│       ├── rules.ts          # Game rules constants
│       └── index.ts
│
├── backend/
│   ├── src/
│   │   ├── index.ts          # App entry point
│   │   ├── server.ts         # Express + Socket.io setup
│   │   ├── config/           # Configuration
│   │   │   └── env.ts        # Environment variables
│   │   ├── auth/             # Authentication
│   │   │   ├── jwt.ts        # JWT utilities
│   │   │   └── middleware.ts # Auth middleware
│   │   ├── game/             # Pure game logic (no I/O)
│   │   │   ├── deck.ts       # Shuffle, deal cards
│   │   │   ├── trick.ts      # Trick evaluation
│   │   │   ├── scoring.ts    # Score calculation
│   │   │   ├── validation.ts # Move validation
│   │   │   └── state.ts      # State transitions
│   │   ├── services/         # Business logic
│   │   │   ├── game.service.ts    # Game lifecycle
│   │   │   ├── player.service.ts  # Player management
│   │   │   └── state.service.ts   # State persistence
│   │   ├── api/              # REST endpoints
│   │   │   ├── auth.routes.ts
│   │   │   ├── game.routes.ts
│   │   │   └── health.routes.ts
│   │   ├── sockets/          # WebSocket handlers
│   │   │   ├── connection.ts # Connection handling
│   │   │   ├── game.ts       # Game event handlers
│   │   │   └── middleware.ts # Socket middleware
│   │   ├── db/               # Database
│   │   │   ├── client.ts     # Prisma client
│   │   │   └── migrations/   # Prisma migrations
│   │   └── utils/            # Utilities
│   │       ├── logger.ts     # Logging
│   │       └── errors.ts     # Error classes
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Seed data
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # App entry point
│   │   ├── App.tsx           # Root component
│   │   ├── components/       # React components
│   │   │   ├── game/         # Game-specific components
│   │   │   │   ├── GameBoard.tsx
│   │   │   │   ├── PlayerHand.tsx
│   │   │   │   ├── CurrentTrick.tsx
│   │   │   │   ├── Scoreboard.tsx
│   │   │   │   ├── BiddingPanel.tsx
│   │   │   │   ├── TrumpSelector.tsx
│   │   │   │   └── Card.tsx
│   │   │   ├── lobby/        # Lobby components
│   │   │   │   ├── GameList.tsx
│   │   │   │   ├── CreateGame.tsx
│   │   │   │   └── JoinGame.tsx
│   │   │   ├── ui/           # Shadcn UI components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   └── ... (other Shadcn components)
│   │   │   └── layout/       # Layout components
│   │   │       ├── Header.tsx
│   │   │       └── Layout.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useGame.ts    # Game state hook
│   │   │   ├── useSocket.ts  # Socket connection hook
│   │   │   └── useAuth.ts    # Auth state hook
│   │   ├── services/         # External services
│   │   │   ├── api.ts        # REST API client
│   │   │   └── socket.ts     # Socket.io client setup
│   │   ├── stores/           # State management (Zustand)
│   │   │   ├── gameStore.ts  # Game state
│   │   │   ├── authStore.ts  # Auth state
│   │   │   └── uiStore.ts    # UI state (modals, etc.)
│   │   ├── utils/            # Utilities
│   │   │   ├── cardHelpers.ts
│   │   │   └── formatting.ts
│   │   ├── styles/           # Global styles
│   │   │   └── globals.css
│   │   └── types/            # Frontend-specific types
│   │       └── index.ts
│   ├── public/               # Static assets
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── nginx/                    # Nginx config (production)
│   └── nginx.conf
│
├── docs/                     # Design documents
│   ├── BUCK_EUCHRE_RULES.md
│   ├── GAME_STATE_SPEC.md
│   ├── API_SPEC.md
│   ├── DATABASE_SCHEMA.md
│   └── ARCHITECTURE.md (this file)
│
├── .env.example              # Environment template
├── docker-compose.yml        # Production deployment
├── docker-compose.dev.yml    # Development environment
└── README.md                 # Project overview
```

## Design Principles

### 1. AI-Friendly Architecture

**Modular**: Each file has single responsibility
- Game logic in `backend/src/game/` - pure functions only
- Services in `backend/src/services/` - orchestrate logic + I/O
- Components in `frontend/src/components/` - focused UI pieces

**Small Files**: Target < 200 lines per file
- Easier for AI to understand and modify
- Reduces context needed

**Clear Interfaces**: TypeScript everywhere
- All functions have explicit types
- No `any` types
- Comprehensive JSDoc comments

**Shared Types**: Single source of truth
- `shared/types/` imported by both frontend and backend
- No duplication of interfaces

### 2. State Management Strategy

**Server is Source of Truth**
- All game logic runs on server
- Client is a view layer that sends actions
- Server validates every action

**Client State (Zustand)**
```typescript
// gameStore.ts
interface GameStore {
  // Server state (received via WebSocket)
  gameState: GameState | null;
  
  // Derived state (computed from gameState)
  myPosition: number | null;
  isMyTurn: boolean;
  playableCards: Card[];
  
  // Actions
  setGameState: (state: GameState) => void;
}
```

**Server State (In-Memory with Action Queue)**
```typescript
// In-memory game store
const activeGames = new Map<string, GameState>();

// Action queue per game (prevents race conditions)
const gameActionQueues = new Map<string, Promise<void>>();

// All state mutations go through the queue
const newState = await executeGameAction(gameId, async (currentState) => {
  return applyAction(currentState, action);
});

// State is automatically persisted to database after each action
```

**Race Condition Prevention:**
- Each game has its own action queue
- Actions for the same game are processed sequentially
- Different games can process actions in parallel
- No locks or mutexes needed - uses Promise chaining

### 3. WebSocket Architecture

**Room-Based Broadcasting**
```typescript
// Each game is a Socket.io room
socket.join(`game:${gameId}`);

// Broadcast to all players in game
io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', gameState);
```

**Event Handling Pattern (with Action Queue)**
```typescript
// backend/src/sockets/game.ts
export function registerGameHandlers(io: Server) {
  io.on('connection', (socket) => {
    socket.on('PLAY_CARD', async (payload) => {
      try {
        // 1. Validate payload
        const validated = playCardSchema.parse(payload);
        
        // 2-5. Execute action through queue (ensures sequential processing)
        const newState = await executeGameAction(validated.gameId, async (currentState) => {
          // Validate action against current state
          const validation = validateCardPlay(currentState, validated);
          if (!validation.valid) {
            throw new ValidationError(validation.reason);
          }
          
          // Apply action to state (pure function)
          return applyCardPlay(currentState, validated);
        });
        // State is automatically persisted by executeGameAction
        
        // 6. Broadcast update
        io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
          gameState: newState,
          event: 'CARD_PLAYED'
        });
        
      } catch (error) {
        socket.emit('ERROR', { code: 'INTERNAL_ERROR', message: error.message });
      }
    });
  });
}
```

**Why Action Queue?**
- **Prevents race conditions**: If two players act simultaneously, actions are processed sequentially
- **No locks needed**: Uses Promise chaining (native to Node.js event loop)
- **Per-game isolation**: Different games process actions in parallel
- **Simple to reason about**: Each action sees consistent state
- **Database-safe**: State is persisted after each successful action

### 4. Pure Game Logic

All game logic in `backend/src/game/` is pure functions (no side effects):

```typescript
// Pure function - deterministic, testable
export function determineTrickWinner(
  trick: Trick, 
  trumpSuit: Card['suit']
): number {
  // No I/O, no mutation, just computation
  // ...
}

// Pure function
export function calculateRoundScores(
  players: Player[],
  winningBidderPosition: number,
  bid: number
): Record<number, number> {
  // Deterministic scoring
  // ...
}
```

**Benefits**:
- Easy to test (no mocking needed)
- Easy to understand (no hidden dependencies)
- AI can reason about it clearly

### 5. Error Handling

**Client Errors** (400s):
- Validation failures
- Invalid game actions
- User mistakes

**Server Errors** (500s):
- Database failures
- Unexpected exceptions

```typescript
// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public code: string, public context?: any) {
    super(message);
  }
}

export class GameError extends Error {
  constructor(message: string, public code: string, public context?: any) {
    super(message);
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message, code: error.code });
  } else {
    res.status(500).json({ error: 'Internal server error' });
    logger.error(error);
  }
});
```

## Data Flow

### Game Creation Flow
```
1. User clicks "Create Game"
2. Frontend: POST /api/games
3. Backend: Creates Game in DB, returns gameId
4. Frontend: Navigates to /game/:gameId
5. Frontend: socket.emit('JOIN_GAME', { gameId })
6. Backend: Adds player to game, broadcasts GAME_STATE_UPDATE
7. Frontend: Renders game lobby
```

### Playing a Card Flow
```
1. User clicks card in hand
2. Frontend: Validates it's user's turn (optimistic UI)
3. Frontend: socket.emit('PLAY_CARD', { gameId, cardId })
4. Backend: Validates action (current player, valid card, follow suit)
5. Backend: Updates gameState (remove card from hand, add to trick)
6. Backend: Persists to database
7. Backend: io.to(game).emit('GAME_STATE_UPDATE', { gameState })
8. Frontend: All clients receive update, re-render
9. If trick complete: Backend emits TRICK_COMPLETE first (for animation)
```

## Security

### Authentication
- Simple JWT tokens (playerId + name)
- No passwords (MVP simplification)
- Tokens expire in 24 hours

### Authorization
- Players can only act in games they've joined
- Server validates player position matches token playerId
- GameState sent to clients but hands filtered (only send own hand)

### Input Validation
- All API inputs validated with Zod schemas
- WebSocket payloads validated with Zod schemas
- Game logic validates all moves server-side

### Rate Limiting (Future)
```typescript
// Future enhancement
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Performance

### For MVP (<50 concurrent games)
- In-memory game state (Map<gameId, GameState>)
- Action queue per game (prevents race conditions)
- PostgreSQL for persistence
- No caching layer needed
- Single server instance
- No distributed locks needed (single server + action queue is sufficient)

### Future Scaling
- **Redis**: Move active games to Redis (shared state across servers)
- **Load Balancer**: Nginx → Multiple backend instances
- **Sticky Sessions**: Socket.io needs sticky sessions or Redis adapter
- **Database Connection Pool**: Already built into Prisma

## Deployment

### Development
```bash
docker-compose -f docker-compose.dev.yml up
# Frontend: localhost:5173
# Backend: localhost:3000
# PostgreSQL: localhost:5432
```

### Production
```bash
docker-compose up -d
# Nginx: localhost:80 (or domain)
# All services behind Nginx
```

### Environment Variables
See `.env.example` for all required variables.

## Testing Strategy

### Unit Tests
- Pure game logic functions (high priority)
- Validators
- Utilities

### Integration Tests
- API endpoints
- WebSocket event handlers

### E2E Tests (Optional for MVP)
- Full game flow
- Use Playwright or Cypress

### Test Structure
```typescript
// backend/src/game/__tests__/trick.test.ts
import { determineTrickWinner } from '../trick';

describe('determineTrickWinner', () => {
  it('should pick highest trump card', () => {
    const trick = {
      cards: [/* ... */],
      // ...
    };
    const winner = determineTrickWinner(trick, 'HEARTS');
    expect(winner).toBe(2);
  });
});
```

## Monitoring & Logging

### Logging
```typescript
// Simple console logging for MVP
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '');
  }
};

// Future: Use Pino or Winston
```

### Metrics (Future)
- Active games count
- Players online
- Average game duration
- Error rates

## Development Workflow

### Starting New Feature
1. Update types in `shared/types/`
2. Create validator in `shared/validators/`
3. Implement pure logic in `backend/src/game/`
4. Add service method in `backend/src/services/`
5. Add API/Socket handler
6. Implement frontend component
7. Wire up to store/hooks

### AI Agent Instructions
Each module should have a comment block:
```typescript
/**
 * @module trick
 * @description Pure functions for evaluating trick winners
 * 
 * Dependencies: Card type, GameState type
 * Side effects: None (pure functions)
 * 
 * Algorithm: See GAME_STATE_SPEC.md section "Trick Winner Determination"
 */
```

## MVP vs Production Features

### MVP (Phases 1-5)
**Must Have:**
- ✅ 4 human players
- ✅ Full Buck Euchre rules
- ✅ Real-time gameplay via WebSocket
- ✅ Score tracking
- ✅ Basic UI with all game components
- ✅ Simple error messages (strings)
- ✅ Basic reconnection (auto-reconnect + state sync)
- ✅ Join game via URL

**Acceptable for MVP:**
- Simple error messages (not structured error codes)
- Server-only validation (no client-side validation)
- Basic turn indicator (text-based)
- No grace periods for disconnection
- No Docker (local services)
- Manual testing (no automated tests yet)

### Production Polish (Phases 6-8)
**Added:**
- ✅ Structured error handling with error codes
- ✅ Client-side validation for instant feedback
- ✅ Reconnection with grace periods
- ✅ Enhanced loading states & turn indicators
- ✅ Full game lobby with game list
- ✅ State versioning for message ordering
- ✅ Comprehensive test coverage
- ✅ UI animations and polish
- ✅ Mobile responsiveness

### Deployment (Phase 9)
**Infrastructure:**
- ✅ Docker development setup
- ✅ Docker production configuration
- ✅ Environment validation
- ✅ Deployment documentation
- ✅ Backup strategy

### Post-MVP (Nice to Have)
- ⬜ AI opponents
- ⬜ Game replay/history viewer
- ⬜ Player statistics
- ⬜ Chat system
- ⬜ Spectator mode
- ⬜ Multiple simultaneous games per player
- ⬜ Tournaments
- ⬜ Leaderboards

### Technical Debt to Address Later
- Add comprehensive test coverage
- Implement proper logging system
- Add error tracking (Sentry)
- Performance monitoring
- Database query optimization
- Redis caching layer
- CI/CD pipeline
- Automated backups

## Key Decisions

### Why TypeScript?
- Type safety reduces bugs
- Better IDE support (autocomplete)
- Self-documenting code
- AI agents benefit from type information

### Why Socket.io over plain WebSockets?
- Automatic reconnection
- Room support (broadcasting)
- Fallback to HTTP long-polling
- Battle-tested, mature library

### Why Zustand over Redux?
- Simpler API (less boilerplate)
- Better TypeScript support
- Smaller bundle size
- Easier for AI to work with

### Why Prisma over raw SQL?
- Type-safe database queries
- Automatic migrations
- Great DX (schema-first)
- Reduces SQL injection risks

### Why not GraphQL?
- REST + WebSocket is simpler for this use case
- Less setup/configuration
- AI agents handle REST better (more common pattern)

### Why npm over pnpm?
- Universal availability
- Better AI/sandbox compatibility
- Simpler for contributors
- Performance difference negligible for this project size

## Conclusion

This architecture prioritizes:
1. **Clarity**: Easy to understand structure
2. **Modularity**: Small, focused files
3. **Type Safety**: TypeScript everywhere
4. **AI-Friendliness**: Clear interfaces, pure functions, good documentation
5. **Simplicity**: No over-engineering, straightforward patterns

The goal is a codebase that AI agents can navigate, understand, and modify confidently.

