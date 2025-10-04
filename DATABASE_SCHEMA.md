# Database Schema

## Overview

This document defines the PostgreSQL database schema using Prisma ORM. The schema prioritizes simplicity for MVP while maintaining data integrity.

## Design Principles

1. **Minimal Persistence**: Only store what's necessary for game recovery
2. **In-Memory First**: Active game state lives in memory; database for persistence only
3. **No User Accounts**: Players are ephemeral; identified by JWT tokens only
4. **Audit Trail**: Store completed games for statistics (future feature)

## Schema Definition (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Player session (temporary, for reconnection only)
model Player {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  expiresAt DateTime // Token expiration
  
  // Relations
  gamesCreated Game[] @relation("GameCreator")
  gamePlayers  GamePlayer[]
  
  @@index([createdAt])
}

// Game record
model Game {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  status    GameStatus @default(WAITING)
  
  // Relations
  creatorId String
  creator   Player @relation("GameCreator", fields: [creatorId], references: [id])
  
  players   GamePlayer[]
  gameState GameState?
  rounds    Round[]
  
  @@index([status, createdAt])
}

enum GameStatus {
  WAITING        // Waiting for players
  IN_PROGRESS    // Game active
  COMPLETED      // Game finished
  ABANDONED      // Players left, game inactive
}

// Junction table for players in games
model GamePlayer {
  id       String @id @default(uuid())
  position Int    // 0-3
  
  // Relations
  gameId   String
  game     Game   @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  playerId String
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  joinedAt DateTime @default(now())
  score    Int      @default(0)
  
  @@unique([gameId, position])
  @@unique([gameId, playerId])
  @@index([gameId])
}

// Persisted game state (for recovery after server restart)
model GameState {
  id        String   @id @default(uuid())
  gameId    String   @unique
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  // Serialized game state (JSON)
  state     Json
  
  updatedAt DateTime @updatedAt
  
  @@index([gameId])
}

// Round history (for statistics, optional for MVP)
model Round {
  id        String   @id @default(uuid())
  gameId    String
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  roundNumber       Int
  dealerPosition    Int
  bidderPosition    Int
  bid               Int
  trumpSuit         String
  bidderMadeContract Boolean
  
  // Scores this round
  scores    Json  // Record<position, score>
  
  // Tricks data (optional, for replay feature)
  tricks    Json? // Array<Trick>
  
  createdAt DateTime @default(now())
  
  @@unique([gameId, roundNumber])
  @@index([gameId])
}
```

## Data Models Explained

### Player
- **Purpose**: Track player sessions for reconnection
- **Lifecycle**: Created on join, expires with JWT token (24 hours)
- **Cleanup**: Cron job removes expired players daily

### Game
- **Purpose**: Top-level game container
- **Status Flow**: WAITING → IN_PROGRESS → COMPLETED/ABANDONED
- **Cleanup**: Archive completed games after 30 days

### GamePlayer
- **Purpose**: Track which players are in which game
- **Position**: Player's seat (0-3), assigned on join (first-come, first-served)
- **Score**: Running total score for the game

### GameState
- **Purpose**: Persist current game state for server restart recovery
- **State Field**: JSON serialization of complete GameState (from GAME_STATE_SPEC.md)
- **Update Frequency**: After every significant game action
- **Performance**: Consider Redis for production (MVP uses PostgreSQL)

### Round
- **Purpose**: Historical record of completed rounds
- **Optional**: Can skip for MVP; useful for statistics/replay later
- **Data**: Stores enough info to reconstruct round outcomes

## JSON Field Structures

### GameState.state
```typescript
// Direct serialization of GameState interface
// See GAME_STATE_SPEC.md for complete structure
{
  gameId: string,
  phase: string,
  players: [...],
  round: number,
  // ... complete GameState
}
```

### Round.scores
```typescript
// Score changes for each player position
{
  "0": 3,   // Player in position 0 gained 3 points
  "1": 1,
  "2": -4,  // Player in position 2 lost 4 points (euchred)
  "3": 2
}
```

### Round.tricks (optional)
```typescript
// Array of all tricks played
[
  {
    number: 1,
    leadPlayerPosition: 2,
    cards: [
      { card: { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' }, playerPosition: 2 },
      { card: { suit: 'HEARTS', rank: 'KING', id: 'HEARTS_KING' }, playerPosition: 3 },
      { card: { suit: 'HEARTS', rank: '9', id: 'HEARTS_9' }, playerPosition: 0 },
      { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 1 }
    ],
    winner: 2
  },
  // ... 5 more tricks
]
```

## Queries

### Common Operations

#### Create Player Session
```typescript
const player = await prisma.player.create({
  data: {
    name: playerName,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
});
```

#### Create Game
```typescript
const game = await prisma.game.create({
  data: {
    creatorId: playerId,
    status: 'WAITING'
  }
});
```

#### Join Game
```typescript
// Check if game is full
const existingPlayers = await prisma.gamePlayer.count({
  where: { gameId }
});

if (existingPlayers >= 4) {
  throw new Error('Game is full');
}

// Find next available position
const usedPositions = await prisma.gamePlayer.findMany({
  where: { gameId },
  select: { position: true }
});

const availablePosition = [0, 1, 2, 3].find(
  pos => !usedPositions.some(p => p.position === pos)
);

// Add player to game
const gamePlayer = await prisma.gamePlayer.create({
  data: {
    gameId,
    playerId,
    position: availablePosition
  }
});
```

#### Save Game State
```typescript
await prisma.gameState.upsert({
  where: { gameId },
  update: {
    state: gameState,
    updatedAt: new Date()
  },
  create: {
    gameId,
    state: gameState
  }
});
```

#### Load Game State
```typescript
const gameState = await prisma.gameState.findUnique({
  where: { gameId },
  include: {
    game: {
      include: {
        players: {
          include: {
            player: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    }
  }
});
```

#### List Available Games
```typescript
const games = await prisma.game.findMany({
  where: {
    status: 'WAITING'
  },
  include: {
    _count: {
      select: { players: true }
    }
  },
  orderBy: {
    createdAt: 'desc'
  },
  take: 20
});
```

#### Complete Round (Save History)
```typescript
await prisma.round.create({
  data: {
    gameId,
    roundNumber,
    dealerPosition,
    bidderPosition,
    bid,
    trumpSuit,
    bidderMadeContract,
    scores: scoresJson,
    tricks: tricksJson // Optional
  }
});
```

#### Update Game Status
```typescript
await prisma.game.update({
  where: { id: gameId },
  data: { status: 'IN_PROGRESS' }
});
```

#### Update Player Score
```typescript
await prisma.gamePlayer.update({
  where: {
    gameId_position: {
      gameId,
      position: playerPosition
    }
  },
  data: {
    score: { increment: scoreChange }
  }
});
```

## Indexes

### Rationale
- `Player.createdAt`: Cleanup expired players
- `Game.status, createdAt`: List available games efficiently
- `GamePlayer.gameId`: Join operations
- `GameState.gameId`: Fast game state lookup
- `Round.gameId`: Fetch round history

## Migrations

### Initial Migration
```bash
cd backend
npx prisma migrate dev --name init
```

### Migration Strategy
- Development: `prisma migrate dev`
- Production: `prisma migrate deploy` (in Docker entrypoint)

## Seed Data (Development)

```typescript
// prisma/seed.ts

async function main() {
  // Create test players
  const alice = await prisma.player.create({
    data: {
      name: 'Alice',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
  
  const bob = await prisma.player.create({
    data: {
      name: 'Bob',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
  
  // Create test game
  const game = await prisma.game.create({
    data: {
      creatorId: alice.id,
      status: 'WAITING',
      players: {
        create: [
          { playerId: alice.id, position: 0 },
          { playerId: bob.id, position: 1 }
        ]
      }
    }
  });
  
  console.log({ alice, bob, game });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Data Retention Policy

### MVP
- Keep all data indefinitely (small scale)

### Future
- **Active Games**: Keep until COMPLETED/ABANDONED
- **Completed Games**: Archive after 30 days
- **Abandoned Games**: Delete after 7 days of inactivity
- **Expired Players**: Delete after token expiration + 1 day
- **Round History**: Keep for 90 days or implement data export

## Backup Strategy

### Development
- No backups needed (can recreate with seed data)

### Production
```bash
# Daily backup (cron job)
docker exec buckeuchre-postgres pg_dump -U buckeuchre buckeuchre > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i buckeuchre-postgres psql -U buckeuchre buckeuchre < backup_20250104.sql
```

## Performance Considerations

### For MVP (< 50 games)
- Default PostgreSQL settings sufficient
- No special indexing needed
- Single database instance

### Future Scaling
- **Redis**: Move active GameState to Redis (sub-millisecond reads)
- **Connection Pooling**: Implement with PgBouncer
- **Read Replicas**: If read-heavy analytics added
- **Partitioning**: Partition Round table by month

## Alternative: Ephemeral MVP (No Database)

For ultra-minimal MVP, consider skipping database entirely:
- Store all state in-memory only
- Games lost on server restart
- Reconnection not possible
- No game history

**Pros**: Simpler, faster to build
**Cons**: Poor UX, no data persistence

**Recommendation**: Use database from start; Prisma setup is quick.

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://buckeuchre:password@localhost:5432/buckeuchre"

# Connection pool (production)
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

## Testing Database

### Setup Test Database
```bash
# Create test database
createdb buckeuchre_test

# Run migrations
DATABASE_URL="postgresql://buckeuchre:password@localhost:5432/buckeuchre_test" npx prisma migrate deploy
```

### Reset Between Tests
```typescript
beforeEach(async () => {
  await prisma.round.deleteMany({});
  await prisma.gameState.deleteMany({});
  await prisma.gamePlayer.deleteMany({});
  await prisma.game.deleteMany({});
  await prisma.player.deleteMany({});
});
```

## Monitoring Queries (Future)

```sql
-- Active games count
SELECT status, COUNT(*) FROM "Game" GROUP BY status;

-- Average game duration
SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) / 60 as avg_minutes
FROM "Game" WHERE status = 'COMPLETED';

-- Most active players
SELECT p.name, COUNT(gp.id) as games_played
FROM "Player" p
JOIN "GamePlayer" gp ON p.id = gp."playerId"
GROUP BY p.id
ORDER BY games_played DESC
LIMIT 10;
```

