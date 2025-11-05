# AI Plugin System

This directory contains a plugin-based AI system for Buck Euchre that makes it easy to implement, test, and swap different AI strategies.

## Architecture

The AI system is built around a **plugin architecture** with the following components:

### Core Components

1. **AIProvider Interface** (`types.ts`)
   - Base interface that all AI implementations must implement
   - Defines methods for bidding, trump declaration, folding, and card play
   - Supports both sync and async implementations

2. **AI Registry** (`registry.ts`)
   - Central registry for AI providers
   - Maps difficulty levels to specific AI implementations
   - Handles provider creation and configuration

3. **Provider Cache** (`provider-cache.ts`)
   - Caches AI providers per player to avoid recreation overhead
   - Automatically manages provider lifecycle

4. **Setup** (`setup.ts`)
   - Registers all available AI providers at server startup
   - Configures default providers and difficulty mappings

### Current Providers

#### Rule-Based AI (`providers/rule-based.ts`)
- **Difficulty**: Easy, Medium
- **Strategy**: Simple heuristics using card counting
- **Performance**: <5ms per decision
- **No training required**

## Usage

### Basic Usage

The AI system is automatically initialized on server startup. AI providers are selected based on difficulty level:

```typescript
import { createAI } from './ai';

// Create an AI for medium difficulty
const ai = await createAI('medium');

// Use the AI to make decisions
const bid = await ai.decideBid(hand, turnUpCard, currentBid, gameState);
const trumpSuit = await ai.decideTrump(hand, turnUpCard, gameState);
const shouldFold = await ai.decideFold(hand, trumpSuit, isClubs, gameState);
const card = await ai.decideCardToPlay(gameState, aiPosition);
```

### Adding a New AI Provider

1. **Create the provider class**:

```typescript
// providers/my-ai.ts
import { AIProvider, AIConfig } from '../types';

export class MyAIProvider implements AIProvider {
  readonly name = 'My AI';
  readonly version = '1.0.0';
  readonly description = 'Description of my AI strategy';

  initialize(config: AIConfig): void {
    // Setup code here
  }

  decideBid(hand, turnUpCard, currentBid, gameState) {
    // Your bidding logic
    return 'PASS';
  }

  // Implement other methods...
}

// Export metadata for registration
export const MyAIMetadata = {
  id: 'my-ai',
  name: 'My AI',
  version: '1.0.0',
  description: 'Description of my AI strategy',
  factory: (config) => new MyAIProvider(),
  supportedDifficulties: ['hard', 'expert'],
  isAsync: false,
  tags: ['experimental'],
};
```

2. **Export from providers/index.ts**:

```typescript
export * from './my-ai';
```

3. **Register in setup.ts**:

```typescript
import { MyAIMetadata } from './providers/my-ai';

export function setupAIProviders(): void {
  // ... existing registrations
  aiRegistry.register(MyAIMetadata);
}
```

4. **Update difficulty mapping** (optional):

```typescript
export function getProviderForDifficulty(difficulty: string): string | undefined {
  switch (difficulty) {
    case 'easy':
      return 'rule-based';
    case 'medium':
      return 'rule-based';
    case 'hard':
      return 'my-ai';  // Use your new AI for hard
    case 'expert':
      return 'my-ai';
    default:
      return undefined;
  }
}
```

### Testing Different AIs

You can easily swap AIs for testing:

```typescript
import { aiRegistry } from './ai';

// Use a specific provider regardless of difficulty
const ai = await aiRegistry.create('my-ai', { difficulty: 'hard' });

// Or use default for difficulty
const ai2 = await aiRegistry.createForDifficulty('hard');
```

### Analysis and Teaching Features

Providers can optionally implement an `analyze()` method for teaching features:

```typescript
const analysis = await ai.analyze(gameState, aiPosition);

console.log(analysis);
// {
//   recommendation: Card,
//   confidence: 0.85,
//   alternatives: [
//     { action: Card, score: 0.75 },
//     { action: Card, score: 0.60 }
//   ],
//   reasoning: [
//     'Leading trump removes opponent advantage',
//     'You have trump control'
//   ]
// }
```

## Performance Considerations

- **Provider Caching**: AI providers are cached per player to avoid recreation overhead
- **Async Support**: All decision methods support async operations for complex AIs
- **Difficulty Scaling**: Use simulation counts or search depth to adjust difficulty

## Future AI Providers

The plugin architecture makes it easy to add advanced AI implementations:

- **PIMC AI**: Perfect Information Monte Carlo (~50-150ms)
- **ISMCTS AI**: Information Set Monte Carlo Tree Search (~100-300ms)
- **Neural AI**: Policy-value neural network (~5-20ms inference)
- **Hybrid AI**: Neural network + MCTS (~200-500ms)

## Directory Structure

```
ai/
├── README.md                    # This file
├── types.ts                     # Core type definitions
├── registry.ts                  # AI provider registry
├── provider-cache.ts            # Provider caching
├── setup.ts                     # Setup and registration
├── index.ts                     # Module exports
├── executor.ts                  # AI execution with timing (existing)
├── trigger.ts                   # AI activation detection (existing)
├── decision-engine.ts           # Original rule-based logic (kept for reference)
└── providers/
    ├── index.ts                 # Provider exports
    └── rule-based.ts            # Rule-based AI implementation
```

## Development Workflow

1. **Implement** your AI provider
2. **Register** it in setup.ts
3. **Test** using the registry API
4. **Benchmark** performance
5. **Deploy** by setting as default for a difficulty level

## Notes

- All AI providers share the same game logic from `@buck-euchre/shared`
- The executor handles timing delays (500-2000ms) to simulate human-like play
- AI providers are stateless - each decision is independent
- For stateful AIs (e.g., with learning), use the `initialize()` and `cleanup()` methods
