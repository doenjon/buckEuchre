# Migration Guide: Player → User Model

## Current Status

✅ **Complete**: Backend infrastructure for user accounts, authentication, friends, invitations, stats, and leaderboards  
⚠️ **Needs Update**: Existing game services still reference the old `Player` model  
🚧 **Pending**: Frontend UI components

## The Issue

The Prisma schema was successfully updated from `Player` (ephemeral sessions) to `User` (persistent accounts), but the following services still reference the old model:

### Files Needing Updates

1. **backend/src/services/game.service.ts** - Game creation and management
2. **backend/src/services/player.service.ts** - Should be deprecated/removed (replaced by user.service.ts)
3. **backend/src/services/ai-player.service.ts** - AI player management
4. **backend/src/api/game.routes.ts** - Game API routes

### Specific Changes Required

#### 1. GamePlayer Model Changes
**Old Schema:**
```prisma
model GamePlayer {
  playerId String
  player   Player @relation(...)
}
```

**New Schema:**
```prisma
model GamePlayer {
  userId    String?  // nullable for guests
  user      User?    @relation(...)
  guestName String?  // for guest players
}
```

#### 2. Service Updates

**game.service.ts Changes:**

Replace all `prisma.player` with `prisma.user`:
```typescript
// OLD
const player = await prisma.player.findUnique({
  where: { id: playerId },
});

// NEW
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

Replace `playerId` with `userId` in GamePlayer operations:
```typescript
// OLD
players: {
  create: {
    playerId: creatorId,
    position: 0,
  },
},

// NEW
players: {
  create: {
    userId: creatorId,
    position: 0,
  },
},
```

Update queries to check `userId` instead of `playerId`:
```typescript
// OLD
where: {
  playerId: userId,
  game: { status: { in: [...] } },
}

// NEW
where: {
  userId: userId,
  game: { status: { in: [...] } },
}
```

Handle guest players (where userId is null):
```typescript
// When creating a GamePlayer
if (user.isGuest) {
  players: {
    create: {
      guestName: user.displayName,
      position: 0,
    },
  }
} else {
  players: {
    create: {
      userId: user.id,
      position: 0,
    },
  }
}
```

**player.service.ts - DEPRECATE**

This file should be removed or significantly refactored. Its functionality is now handled by:
- `user.service.ts` - User account management
- Game player management moved to game.service.ts

**ai-player.service.ts Changes:**

Update AI player creation to use User model:
```typescript
// Create an AI user (guest account)
const aiUser = await prisma.user.create({
  data: {
    username: `AI_${aiName}_${Date.now()}`,
    displayName: aiName,
    isGuest: true,
  },
});

// Add to game
await prisma.gamePlayer.create({
  data: {
    gameId,
    userId: aiUser.id,
    position: availablePosition,
  },
});
```

#### 3. Route Updates

**game.routes.ts Changes:**

Replace `req.player` with `req.user`:
```typescript
// OLD
const playerId = req.player!.id;
const playerName = req.player!.name;

// NEW
const userId = req.user!.id;
const username = req.user!.username;
const displayName = req.user!.displayName;
```

#### 4. Interface Updates

**Type Definitions:**

Update interfaces that reference Player:
```typescript
// OLD
import { Player } from '@prisma/client';

// NEW  
import { User } from '@prisma/client';
```

Update GameWithPlayers interface includes:
```typescript
// Include user data with GamePlayer
include: {
  players: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          isGuest: true,
        },
      },
    },
  },
}
```

## Systematic Migration Steps

### Step 1: Update game.service.ts
1. Change all `prisma.player` → `prisma.user`
2. Change all `playerId` → `userId` in GamePlayer operations  
3. Add guest player handling
4. Update includes to fetch `user` instead of `player`
5. Update all type imports from Player → User

### Step 2: Update ai-player.service.ts
1. Create AI users as guests in User table
2. Use userId in GamePlayer creation
3. Update all Player references → User

### Step 3: Update game.routes.ts
1. Replace `req.player` → `req.user`
2. Update response objects to use username/displayName
3. Ensure authentication middleware is imported correctly

### Step 4: Remove/Update player.service.ts
1. Delete file or keep minimal compatibility layer
2. Update any imports pointing to this service
3. Ensure all functionality is covered by user.service.ts

### Step 5: Test
1. Compile TypeScript: `npm run build`
2. Run tests: `npm test`
3. Manual testing of game flow

## Quick Find & Replace

Use these patterns carefully with your IDE's find-and-replace:

| Find | Replace | Notes |
|------|---------|-------|
| `prisma.player` | `prisma.user` | In all service files |
| `playerId:` | `userId:` | In GamePlayer creation |
| `req.player` | `req.user` | In route handlers |
| `import.*Player.*from '@prisma/client'` | `import.*User.*from '@prisma/client'` | Update imports |
| `.player.` | `.user.` | In include statements |

⚠️ **Warning**: Some replacements may need manual review. For example:
- `@buck-euchre/shared` still exports a `Player` interface (game state player, not database model)
- AI player logic may need special handling
- Guest player handling requires new logic

## Testing Checklist

After migration, verify:
- [ ] Users can register and login
- [ ] Guests can play without registration
- [ ] Game creation works
- [ ] Joining games works
- [ ] AI players can be added
- [ ] Games start when full
- [ ] Game state is tracked correctly
- [ ] Stats are recorded (once game engine integration is added)
- [ ] Friends can invite each other
- [ ] Leaderboards display correctly

## Why This Happened

The Prisma schema was updated and migrated successfully, which changed the database structure. However, the application services were written against the old schema. This is normal during a major refactor like this—the database layer changes first, then the service layer needs to catch up.

## Next Steps After Migration

Once the game services are updated and compilation succeeds:

1. **Test the Backend**
   - Start server: `cd backend && npm run dev`
   - Test auth endpoints with Postman/curl
   - Create test games
   - Verify database data looks correct

2. **Integrate Game Engine Stats** (currently deferred)
   - Import `updateRoundStats` and `updateGameStats` from stats.service
   - Call after each round and game completion
   - Track all player statistics

3. **Build Frontend UI**
   - Authentication pages (Login/Register)
   - Profile page with stats
   - Friends management page
   - Leaderboard page
   - Navigation updates

## Estimated Effort

- **Game Service Migration**: 2-3 hours (systematic find-and-replace + testing)
- **AI Player Service Update**: 1 hour
- **Route Updates**: 30 minutes
- **Testing**: 1-2 hours
- **Total**: ~5-7 hours for backend completion

The infrastructure is solid—this is just updating references to match the new schema.




