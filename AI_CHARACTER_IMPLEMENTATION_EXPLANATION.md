# AI Character Implementation Explanation

## How Character Implementation Works

### Overview

The character system allows AI players to have different play styles by modifying their decision-making parameters. The character traits affect:

1. **Bidding Aggressiveness** - How often and how high the AI bids
2. **Risk Taking** - How risky the AI plays cards (leading high vs. playing safe)
3. **Fold Threshold** - How likely the AI is to fold vs. stay in

### Technical Flow

```
1. AI Player Creation
   └─> createAIPlayer(config) creates User record
       ├─> Stores: displayName (e.g., "Pickles")
       ├─> Stores: username (e.g., "AI_Pickles_1234567890")
       └─> Does NOT store: difficulty or character

2. AI Decision Making
   └─> executeAITurn() calls getAIProvider(playerId)
       └─> aiProviderCache.getProvider(playerId, 'medium')
           └─> Creates ISMCTSAIProvider with:
               ├─> difficulty: 'medium' (HARDCODED)
               └─> character: undefined (NEVER PASSED)

3. Character Application
   └─> ISMCTSEngine.search() runs MCTS simulations
       └─> simulate() calls rollout() with character
           └─> Character affects:
               ├─> fastBid() - adjusts bidding thresholds
               ├─> fastFoldDecision() - adjusts fold threshold
               └─> fastCardPlay() - adjusts risk-taking
```

### Character Traits

Character traits are multipliers that modify decision thresholds:

```typescript
interface AICharacter {
  biddingAggressiveness?: number;  // 0.5 = conservative, 1.0 = balanced, 1.5 = aggressive
  riskTaking?: number;            // 0.5 = safe, 1.0 = balanced, 1.5 = risky
  foldThreshold?: number;          // 0.5 = fold more, 1.0 = balanced, 1.5 = fold less
}
```

**Example: Aggressive Character**
- `biddingAggressiveness: 1.5` - Bids with 1.5x fewer trumps needed
- `riskTaking: 1.3` - Plays higher cards more often
- `foldThreshold: 1.2` - Folds less (stays with weaker hands)

### Character Presets

Available presets in `backend/src/ai/character.ts`:

- **balanced** - Standard play (1.0, 1.0, 1.0)
- **aggressive** - More aggressive bidding and risk-taking
- **conservative** - More cautious play
- **risky** - Very aggressive
- **cautious** - Very conservative

## Current Behavior: Is AI Consistent?

### ❌ NO - Same AI Name Does NOT Have Consistent Behavior

**Problem 1: New User Record Each Time**
```typescript
// backend/src/services/ai-player.service.ts:113
const username = `AI_${name.replace(/\s+/g, '_')}_${Date.now()}`;
```
- Each time you add an AI named "Pickles", it creates a **NEW user record** with a different ID
- The username includes a timestamp, so it's always unique
- Even though the `displayName` is "Pickles", it's a different user each time

**Problem 2: Difficulty is Hardcoded**
```typescript
// backend/src/ai/executor.ts:69
return await aiProviderCache.getProvider(playerId, 'medium');
```
- The difficulty is **hardcoded to 'medium'** in `getAIProvider()`
- The `difficulty` parameter passed to `createAIPlayer()` is **never used**
- There's even a TODO comment: `// TODO: Get difficulty from player settings/database`

**Problem 3: Character is Never Passed**
- The character parameter is **never passed** through the creation flow
- `createAIPlayer()` doesn't accept or store character
- `getAIProvider()` doesn't retrieve or pass character
- Character traits are only used if manually passed to `ISMCTSAIProvider.initialize()`

**Problem 4: No Database Storage**
- The `User` table has no fields for `difficulty` or `character`
- `UserSettings` table also doesn't store AI configuration
- Configuration is lost between games

### Current State Summary

| Aspect | Current Behavior |
|--------|------------------|
| **Same Name, Same Behavior?** | ❌ No - creates new user each time |
| **Difficulty Consistency?** | ❌ No - always 'medium' (hardcoded) |
| **Character Consistency?** | ❌ No - never passed or stored |
| **Database Storage?** | ❌ No - not stored anywhere |
| **Iterations Setting?** | ✅ Yes - defaults to 5000, can be overridden |

## How to Make AI Consistent

To make the same AI name have consistent behavior, you would need to:

### Option 1: Store Configuration in Database

1. **Add fields to User table** (via Prisma migration):
```prisma
model User {
  // ... existing fields
  aiDifficulty String?  // 'easy' | 'medium' | 'hard' | 'expert'
  aiCharacter  Json?    // Store character object
}
```

2. **Update createAIPlayer()** to store config:
```typescript
const aiUser = await prisma.user.create({
  data: {
    username,
    displayName: name.trim(),
    isGuest: true,
    aiDifficulty: difficulty,
    aiCharacter: character ? JSON.stringify(character) : null,
  },
});
```

3. **Update getAIProvider()** to retrieve config:
```typescript
async function getAIProvider(playerId: string): Promise<AIProvider> {
  const user = await prisma.user.findUnique({
    where: { id: playerId },
    select: { aiDifficulty: true, aiCharacter: true },
  });
  
  const difficulty = (user?.aiDifficulty as AIDifficulty) || 'medium';
  const character = user?.aiCharacter 
    ? JSON.parse(user.aiCharacter) 
    : undefined;
  
  return await aiProviderCache.getProvider(playerId, difficulty, undefined, {
    character,
  });
}
```

### Option 2: Reuse Same User for Same Name

1. **Find existing AI user by name** instead of always creating new:
```typescript
export async function createAIPlayer(config?: Partial<AIPlayerConfig>): Promise<User> {
  const name = config?.name || await getRandomAIName();
  
  // Try to find existing AI with this name
  const existing = await prisma.user.findFirst({
    where: {
      displayName: name,
      isGuest: true,
      username: { startsWith: 'AI_' },
    },
  });
  
  if (existing) {
    // Update config if provided
    if (config?.difficulty) {
      // Store in UserSettings or new field
    }
    return existing;
  }
  
  // Create new if not found
  // ... existing creation logic
}
```

### Option 3: Store in UserSettings

Use the existing `UserSettings` table to store AI configuration:

```typescript
// Add to UserSettings model
model UserSettings {
  // ... existing fields
  aiDifficulty String?
  aiCharacter  Json?
}
```

## Current Implementation Status

✅ **What Works:**
- Character system is implemented and functional
- Character traits affect bidding, folding, and card play
- Character presets are available
- Iterations default to 5000 (as requested)

❌ **What Doesn't Work:**
- Character is never passed to AI providers
- Difficulty is hardcoded to 'medium'
- Same AI name creates different users each time
- Configuration is not persisted

## Recommendation

To use characters **right now**, you would need to:

1. Modify `getAIProvider()` to accept and pass character:
```typescript
async function getAIProvider(
  playerId: string, 
  character?: AICharacter
): Promise<AIProvider> {
  const provider = await aiProviderCache.getProvider(playerId, 'medium');
  // Manually set character if provided
  if (character && provider instanceof ISMCTSAIProvider) {
    provider.initialize({
      difficulty: 'medium',
      params: { character },
    });
  }
  return provider;
}
```

2. Or modify the API route to pass character through:
```typescript
await addAIToGame(gameId, {
  difficulty: difficulty || 'medium',
  name: name || undefined,
  character: character || undefined, // Add this
});
```

But this still won't persist between games - you'd need database storage for true consistency.

