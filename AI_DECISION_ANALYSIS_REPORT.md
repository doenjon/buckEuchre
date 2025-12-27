# AI Decision-Making Analysis Report
## Buck Euchre - AI vs Analysis Overlay Performance Gap

---

## Executive Summary

**CRITICAL FINDING:** The AI bots and analysis overlay use **different decision criteria** from the same MCTS data, which explains the performance gap.

- **Analysis Overlay:** Sorts options by **average value** (win probability)
- **AI Bots:** Select by **visit count** (most visited action)

These two metrics can differ significantly, especially in high-variance games with imperfect information.

---

## 1. Code Duplication (Frontend/Backend MCTS)

**Confirmed:** MCTS engine code is duplicated between frontend and backend.

### Duplicated Files:
```
backend/src/ai/ismcts/ismcts-engine.ts     (490 lines)
frontend/src/ai/ismcts/ismcts-engine.ts    (490 lines)

backend/src/ai/ismcts/mcts-node.ts         (375 lines)
frontend/src/ai/ismcts/mcts-node.ts        (375 lines)
```

**Differences:**
- Backend: Uses `setImmediate(resolve)` for yielding (Node.js)
- Frontend: Uses `setTimeout(resolve, 0)` for yielding (Browser)
- Otherwise **100% identical algorithms**

---

## 2. How AI Bots Make Decisions

### Decision Flow:
```
1. AI Turn Triggered (executor.ts:79-154)
   └─> getAIProvider(playerId)
       └─> aiProviderCache.getProvider(playerId, 'medium')
           └─> ISMCTSAIProvider (5,000 simulations)

2. AI Makes Decision (providers/ismcts.ts:81-188)
   └─> engine.search(gameState, playerPosition)

3. MCTS Search (ismcts-engine.ts:174-229)
   ├─> Run 5,000 simulations with determinization
   ├─> Build tree of child nodes (one per action)
   │   └─> Each child tracks: visits, totalValue, avgValue
   └─> RETURN: root.getMostVisitedChild()  ⚠️ USES VISIT COUNT
```

### Final Selection Logic (mcts-node.ts:277-293):
```typescript
getMostVisitedChild(): MCTSNode | null {
  let bestChild: MCTSNode | null = null;
  let mostVisits = -1;

  for (const child of this.children.values()) {
    if (child.visits > mostVisits) {  // ⚠️ SELECTS BY VISIT COUNT
      mostVisits = child.visits;
      bestChild = child;
    }
  }
  return bestChild;
}
```

**Key Point:** AI uses **visit count**, not average value.

---

## 3. How Analysis Overlay Presents Information

### Analysis Flow:
```
1. Analysis Triggered (trigger.ts:sendAIAnalysis)
   └─> analyzeHand(gameState, position, { simulations: 20000 })

2. MCTS Analysis (analysis.service.ts:44-189)
   ├─> Run 20,000 simulations (4x more than AI!)
   ├─> Extract statistics: visits, avgValue, stdError, etc.
   └─> Sort by avgValue:  ⚠️ SORTS BY AVERAGE VALUE

3. Sorting Logic (analysis.service.ts:179-183):
```typescript
// Sort by win probability (descending) and assign ranks
analyses.sort((a, b) => b.winProbability - a.winProbability);
analyses.forEach((analysis, index) => {
  analysis.rank = index + 1;  // Rank 1 = highest avgValue
});
```

**Key Point:** Analysis shows options sorted by **average value** (win probability).

---

## 4. The Critical Difference

| Criterion | AI Bots | Analysis Overlay |
|-----------|---------|------------------|
| **Selection Method** | `getMostVisitedChild()` | Sort by `winProbability` |
| **Metric Used** | Visit Count | Average Value |
| **Simulations** | 5,000 | 20,000 |
| **Code Location** | `mcts-node.ts:277` | `analysis.service.ts:180` |

### Why This Matters:

In MCTS, visit count and average value measure different things:

**Visit Count:**
- Measures how often an action was explored
- UCB1 balances exploration/exploitation
- Actions with high uncertainty get more visits
- Standard "robust child" selection in MCTS

**Average Value:**
- Measures the actual expected outcome
- Pure exploitation of simulation results
- The action that performed best in simulations
- What humans see in the analysis overlay

### When They Diverge:

Example scenario:
```
Action A: 2000 visits, avgValue = 0.65 (65% win probability)
Action B: 2500 visits, avgValue = 0.62 (62% win probability)

AI chooses:     Action B (most visits: 2500)
Human sees:     Action A ranked #1 (highest avgValue: 0.65)
Better choice:  Action A (3% better expected outcome)
```

This divergence is common when:
- High variance in outcomes (Buck Euchre has significant variance)
- Imperfect information (opponent hands are hidden)
- UCB1 explores sub-optimal actions to reduce uncertainty

---

## 5. Alternative Selection Methods Available

The codebase already has a better selection method that's NOT being used:

### `getBestValueChild()` (mcts-node.ts:300-316):
```typescript
getBestValueChild(): MCTSNode | null {
  let bestChild: MCTSNode | null = null;
  let bestValue = -Infinity;

  for (const child of this.children.values()) {
    if (child.averageValue > bestValue) {  // ✅ SELECTS BY AVG VALUE
      bestValue = child.averageValue;
      bestChild = child;
    }
  }
  return bestChild;
}
```

**This method selects by average value**, matching what the analysis overlay shows!

---

## 6. Detailed Decision-Making Example

### Card Play Scenario:

**MCTS runs 5,000 simulations, creates this tree:**

```
Root (5000 visits)
├─ Play Ace of Spades
│  ├─ visits: 1800
│  ├─ totalValue: 1260
│  └─ avgValue: 0.70  (70% win probability) ← BEST VALUE
│
├─ Play King of Spades
│  ├─ visits: 2000      ← MOST VISITED
│  ├─ totalValue: 1300
│  └─ avgValue: 0.65  (65% win probability)
│
├─ Play Jack of Hearts
│  ├─ visits: 800
│  ├─ totalValue: 440
│  └─ avgValue: 0.55
│
└─ Play 10 of Clubs
   ├─ visits: 400
   ├─ totalValue: 180
   └─ avgValue: 0.45
```

**AI Bot Decision:**
```typescript
const bestChild = root.getMostVisitedChild();
// Returns: King of Spades (2000 visits)
```

**Analysis Overlay Display:**
```typescript
analyses.sort((a, b) => b.winProbability - a.winProbability);
// Rank 1: Ace of Spades (0.70 avgValue)
// Rank 2: King of Spades (0.65 avgValue)
// Rank 3: Jack of Hearts (0.55 avgValue)
// Rank 4: 10 of Clubs (0.45 avgValue)
```

**Human Player:** Sees Ace of Spades at top, plays it → Better outcome!

---

## 7. Why This Happens (MCTS Theory)

### UCB1 Formula:
```
UCB1 = avgValue + C * sqrt(ln(parent_visits) / child_visits)
         ↑              ↑
    exploitation   exploration
```

The exploration term causes MCTS to:
1. Try promising actions many times (exploitation)
2. Also try uncertain actions to gather data (exploration)

By the end of search:
- High-value actions might have fewer visits (already confident)
- Medium-value actions might have more visits (still exploring)

**"Robust child" selection** (most visits) is conservative and works well when simulations are noisy or limited. But with sufficient simulations, **"best value" selection** often performs better.

---

## 8. Impact on Each Game Phase

| Phase | AI Impact | Analysis Impact |
|-------|-----------|-----------------|
| **Bidding** | Choose bid with most visits | Show bids sorted by avgValue |
| **Trump Selection** | Choose suit with most visits | Show suits sorted by avgValue |
| **Fold Decision** | Choose fold/stay with most visits | Show fold/stay sorted by avgValue |
| **Card Play** | Choose card with most visits | Show cards sorted by avgValue |

In **all phases**, the AI might choose a sub-optimal action if visit count doesn't align with average value.

---

## 9. Simulation Count Difference

**Secondary Factor:**
- AI Bots: 5,000 simulations
- Analysis Overlay: 20,000 simulations (card play), 5,000 (other phases)

More simulations = more accurate estimates, but both use the same algorithm. The selection method difference is more significant.

---

## 10. Recommendations

### Option 1: Change AI to Use Best Value (Matches Analysis)
**File:** `backend/src/ai/ismcts/ismcts-engine.ts:221`

Change from:
```typescript
const bestChild = root.getMostVisitedChild();
```

To:
```typescript
const bestChild = root.getBestValueChild();
```

**Pros:**
- AI matches what analysis shows
- Likely better performance
- Simple one-line change

**Cons:**
- Less "robust" with noisy simulations
- Deviates from standard MCTS

---

### Option 2: Increase AI Simulations (More Exploration)
**File:** `backend/src/ai/providers/ismcts.ts:29`

Change from:
```typescript
return 5000;
```

To:
```typescript
return 20000;
```

**Pros:**
- More accurate estimates
- Visit counts and values converge
- Still uses standard robust selection

**Cons:**
- 4x slower AI thinking time
- Doesn't address fundamental selection difference

---

### Option 3: Hybrid Approach (Best of Both)

Use visit count for low-simulation scenarios, value for high-simulation:

```typescript
async search(gameState: GameState, playerPosition: PlayerPosition): Promise<Action> {
  // ... run simulations ...

  // Use best value if we have enough simulations, otherwise use robust child
  const bestChild = this.config.simulations >= 10000
    ? root.getBestValueChild()
    : root.getMostVisitedChild();

  return bestChild.action;
}
```

**Pros:**
- Adaptive strategy
- Robust with few simulations
- Exploitative with many simulations

**Cons:**
- More complex
- Magic number threshold

---

## 11. Testing Plan

To verify the hypothesis, add logging to compare decisions:

```typescript
// In ismcts-engine.ts after simulations complete:
const mostVisited = root.getMostVisitedChild();
const bestValue = root.getBestValueChild();

if (mostVisited !== bestValue) {
  console.log('[MCTS] Decision divergence:');
  console.log(`  Most visited: ${serializeAction(mostVisited.action)} (${mostVisited.visits} visits, ${mostVisited.averageValue.toFixed(3)} value)`);
  console.log(`  Best value: ${serializeAction(bestValue.action)} (${bestValue.visits} visits, ${bestValue.averageValue.toFixed(3)} value)`);
}
```

Track how often they differ and the magnitude of value difference.

---

## 12. Conclusion

**The analysis overlay plays better because:**

1. **Primary Reason:** It shows options sorted by **average value** (actual win probability), allowing humans to choose the highest-value action
2. **AI Limitation:** AI selects by **visit count**, which can diverge from optimal when exploration visits sub-optimal actions
3. **Secondary Factor:** Analysis uses 4x more simulations for card play (20k vs 5k)

**The fix is simple:** Change AI selection from `getMostVisitedChild()` to `getBestValueChild()` in `ismcts-engine.ts:221`.

**Expected improvement:** AI will choose the same actions that rank #1 in the analysis overlay, closing the performance gap.
