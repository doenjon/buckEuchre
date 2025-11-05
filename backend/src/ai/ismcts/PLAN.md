# ISMCTS Implementation Plan

## Overview

Implement Information Set Monte Carlo Tree Search (ISMCTS) for Buck Euchre.
ISMCTS handles imperfect information by determinizing (sampling possible opponent hands)
and building a search tree to find the best action.

## Architecture

### Component Breakdown

1. **Determinization System** (determinize.ts)
   - Sample opponent hands consistent with observations
   - Track what we know: cards played, voids revealed, bidding behavior
   - Generate valid hand distributions
   - ~150 lines

2. **MCTS Node** (mcts-node.ts)
   - Tree node structure with UCB1 statistics
   - Visit count, total value, parent/children
   - Action that led to this node
   - ~100 lines

3. **Rollout Policy** (rollout.ts)
   - Fast playout from any game state to end
   - Uses simple heuristics (not optimal play)
   - Must be fast (~0.5-1ms per rollout)
   - ~150 lines

4. **ISMCTS Engine** (ismcts-engine.ts)
   - Main algorithm: selection, expansion, simulation, backpropagation
   - Determinization loop
   - UCB1 selection
   - Result aggregation
   - ~200 lines

5. **ISMCTS Provider** (providers/ismcts.ts)
   - Implements AIProvider interface
   - Configuration for simulation counts
   - Difficulty mapping
   - ~100 lines

Total: ~700 lines

## Algorithm Flow

```
For each decision:
  Create root node

  For N simulations:
    1. DETERMINIZE: Sample opponent hands
    2. SELECTION: Walk tree using UCB1
    3. EXPANSION: Add new child node
    4. SIMULATION: Rollout to game end
    5. BACKPROPAGATION: Update visit counts and values

  Return most visited action
```

## Key Design Decisions

### 1. Determinization Strategy

**Simple approach for v1:**
- Start with uniform distribution over unseen cards
- Later: weight by bidding behavior, void tracking

**What we track:**
- Cards played (visible to all)
- Void suits per player (didn't follow suit)
- Bid amounts (hints at trump strength)

### 2. Node Structure

```typescript
class MCTSNode {
  parent: MCTSNode | null;
  children: Map<Action, MCTSNode>;
  visits: number;
  totalValue: number;
  action: Action | null;  // Action that led here
  untriedActions: Action[];
}
```

### 3. UCB1 Formula

```
UCB1 = (wins / visits) + C * sqrt(ln(parent.visits) / visits)
```
- C = exploration constant (~1.41)
- Balances exploitation vs exploration

### 4. Rollout Policy

**Fast heuristics:**
- Bidding: Count trumps, bid if 3+
- Trump: Choose suit with most cards
- Fold: Fold if <2 trumps
- Play: Lead high, follow low (same as rule-based)

### 5. Value Function

```typescript
// From AI player's perspective
value = -scoreChange  // Lower score is better in Buck Euchre
// Normalize to 0-1 range
normalizedValue = (value + 15) / 30  // Score ranges ~-15 to +15
```

### 6. Simulation Counts

**Difficulty mapping:**
- Easy: 100 simulations (~20ms)
- Medium: 500 simulations (~75ms)
- Hard: 2000 simulations (~250ms)
- Expert: 5000 simulations (~600ms)

## Implementation Order

1. **Determinize (30 min)**
   - Card tracking
   - Hand sampling
   - Validation

2. **MCTS Node (20 min)**
   - Node class
   - UCB1 calculation
   - Tree operations

3. **Rollout (40 min)**
   - Fast game simulator
   - Heuristic policy
   - End state evaluation

4. **ISMCTS Engine (50 min)**
   - Main loop
   - Selection/expansion
   - Integration

5. **Provider (20 min)**
   - AIProvider wrapper
   - Configuration
   - Registration

6. **Testing (30 min)**
   - Unit tests
   - Integration test
   - Performance check

**Total: ~3 hours**

## Data Structures

### Game State Cloning

```typescript
// Need to clone game state for determinization
function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}
```

### Observations

```typescript
interface Observations {
  playedCards: Set<string>;           // All cards played
  playerVoids: Map<number, Set<Suit>>; // Known voids per player
  bidAmounts: Map<number, number>;     // Bid per player
}
```

## Testing Strategy

1. **Unit Tests**
   - Determinization produces valid hands
   - UCB1 selects correctly
   - Rollout completes without errors

2. **Integration Test**
   - ISMCTS makes valid moves
   - Simulation count affects quality
   - Performance within budget

3. **Quality Test**
   - Play 100 games vs rule-based
   - ISMCTS should win 70%+

## Performance Targets

- **100 simulations**: <25ms
- **500 simulations**: <100ms
- **2000 simulations**: <300ms
- **Memory**: <50MB per game

## Known Limitations (v1)

1. **Simple determinization** - Uniform distribution
2. **No opponent modeling** - All opponents treated equally
3. **Fixed rollout policy** - Could be improved with learning
4. **No information set grouping** - Could reduce tree size
5. **No progressive widening** - Explores all actions

## Future Improvements (v2+)

1. **Weighted determinization** based on bidding
2. **Opponent modeling** from past games
3. **Learned rollout policy** from neural network
4. **Progressive widening** to reduce branching
5. **Information set abstraction** to reduce tree size
6. **Parallel MCTS** for faster simulation

## Files to Create

```
backend/src/ai/ismcts/
├── determinize.ts      # Hand sampling
├── mcts-node.ts        # Tree node
├── rollout.ts          # Fast playout
├── ismcts-engine.ts    # Main algorithm
└── index.ts            # Exports

backend/src/ai/providers/
└── ismcts.ts           # Provider implementation
```

## Success Criteria

✅ Makes valid moves in all game phases
✅ Completes within performance budget
✅ Beats rule-based AI >70% of games
✅ No memory leaks or crashes
✅ Integrates cleanly with plugin system

Let's implement!
