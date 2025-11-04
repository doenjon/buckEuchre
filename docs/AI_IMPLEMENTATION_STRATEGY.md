# Buck Euchre AI Implementation Strategy

**Version:** 1.0
**Date:** November 4, 2025
**Status:** Design & Planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [AI Approaches Overview](#ai-approaches-overview)
4. [Deployment Architecture Options](#deployment-architecture-options)
5. [Teaching & Interpretability Features](#teaching--interpretability-features)
6. [AI Research Platform](#ai-research-platform)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Technical Specifications](#technical-specifications)
9. [Performance Benchmarks](#performance-benchmarks)
10. [References & Further Reading](#references--further-reading)

---

## Executive Summary

This document outlines a comprehensive strategy for implementing state-of-the-art AI for Buck Euchre, a 4-player trick-taking card game with imperfect information. The strategy addresses multiple objectives:

- **Strong AI opponents** for challenging gameplay
- **Teaching features** to help users improve their play
- **Offline capability** for practice mode in PWA
- **Research infrastructure** for continuous AI improvement
- **Multiple difficulty levels** for accessibility

### Key Recommendations

1. **Hybrid Architecture**: Server-side AI for multiplayer + Client-side AI for practice mode
2. **Primary Approach**: Information Set Monte Carlo Tree Search (ISMCTS) with optional neural network enhancement
3. **Research Platform**: Separate AI battle arena for experimentation and validation
4. **Incremental Deployment**: Ship improvements iteratively (rule-based → ISMCTS → Neural)

### Expected Outcomes

- **Easy AI**: Beginner human level (current baseline improved)
- **Medium AI**: Competent player level (PIMC or lightweight ISMCTS)
- **Hard AI**: Expert level (ISMCTS with 2000+ simulations)
- **Expert AI**: Superhuman level (Neural network + MCTS hybrid)

---

## Current State Analysis

### Existing AI Implementation

The game currently has a **rule-based AI system** with the following components:

#### 1. Decision Engine (`backend/src/ai/decision-engine.ts`)

**Bidding Strategy:**
```typescript
function decideBid(hand: Card[], turnUpCard: Card, currentBid: number | null): BidAmount {
  const trumpCount = countTrumps(hand, turnUpCard.suit);
  const highTrumpCount = countHighTrumps(hand, turnUpCard.suit);

  // Simple heuristic: bid based on trump count
  if (trumpCount >= 4 && highTrumpCount >= 2) return 4 or 5;
  if (trumpCount >= 3 && highTrumpCount >= 1) return 3;
  if (trumpCount >= 2) return 2;
  return 'PASS';
}
```

**Issues:**
- No consideration of non-trump strength
- Doesn't model opponent behavior
- No probabilistic reasoning about making bid
- Fixed thresholds don't adapt to game state

**Trump Declaration:**
```typescript
function decideTrump(hand: Card[], turnUpCard: Card): Suit {
  // Evaluate all suits, pick strongest
  const scores = suits.map(suit =>
    countTrumps(hand, suit) + (countHighTrumps(hand, suit) * 2)
  );
  return suits[argmax(scores)];
}
```

**Issues:**
- Purely counting-based
- Doesn't consider suit distribution or control

**Folding Decision:**
```typescript
function decideFold(hand: Card[], trumpSuit: Suit, isClubs: boolean): boolean {
  if (isClubs) return false; // Can't fold on clubs
  const trumpCount = countTrumps(hand, trumpSuit);
  const hasHighTrump = hasAnyHighTrump(hand, trumpSuit);

  return trumpCount < 2 && !hasHighTrump;
}
```

**Issues:**
- Binary decision with no probability assessment
- Doesn't consider bid amount or position

**Card Play:**
```typescript
function decideCardToPlay(gameState: GameState, position: PlayerPosition): Card {
  const legalCards = getLegalCards(hand, currentTrick, trumpSuit);

  // Simple greedy strategy
  if (isLeading) {
    return highest(legalCards); // Play highest card when leading
  } else {
    return lowest(legalCards);  // Play lowest when following
  }
}
```

**Issues:**
- No planning (greedy single-trick optimization)
- Doesn't track played cards
- No inference about opponent hands
- No control/tempo considerations

#### 2. AI Executor (`backend/src/ai/executor.ts`)

Handles realistic timing and execution:
- Random thinking delay: 500-2000ms
- Validates moves before execution
- Integrates with game state service
- Broadcasts results via WebSocket

**Good aspects:**
- Clean separation of decision and execution
- Proper validation
- Human-like timing

**Performance characteristics:**
- 500-2000ms artificial delay per decision
- 80-200 seconds per game
- ~18-45 games per hour
- Not suitable for bulk experimentation

#### 3. AI Trigger System (`backend/src/ai/trigger.ts`)

Automatically detects when AI should act:
- Monitors game state after each update
- Identifies current acting player
- Special handling for FOLDING_DECISION phase
- Fast name-based AI detection (`playerName.startsWith('Bot ')`)

**Good aspects:**
- Automatic activation
- Handles all game phases
- Staggered delays for concurrent decisions

#### 4. AI Player Service (`backend/src/services/ai-player.service.ts`)

Manages AI player lifecycle:
- Creates guest users with "Bot [Name]" display names
- Adds AI to games
- Cleanup of unused AI players
- Difficulty levels defined but not implemented

**Good aspects:**
- Clean integration with user system
- Proper cleanup
- Ready for difficulty implementation

### Current Strengths & Weaknesses

**Strengths:**
- ✅ Complete integration with game system
- ✅ Works reliably in multiplayer
- ✅ Clean architecture (decision/execution separation)
- ✅ Proper validation and error handling
- ✅ Human-like behavior (delays, natural flow)

**Weaknesses:**
- ❌ Weak play (beginner level at best)
- ❌ No card counting or inference
- ❌ No planning beyond current trick
- ❌ No opponent modeling
- ❌ Difficulty levels not implemented
- ❌ No teaching/analysis features
- ❌ Too slow for experimentation (artificial delays)

### Game Characteristics Relevant to AI

**Buck Euchre Complexity:**
- **State space**: ~10^15+ states
- **Action space**:
  - Bidding: 5 options (PASS, 2, 3, 4, 5)
  - Trump: 4 options (suits)
  - Fold: 2 options (stay/fold)
  - Card play: 1-5 options per trick
- **Imperfect information**: Hidden opponent hands
- **Stochastic**: Card dealing creates randomness
- **Partial observability**: Can infer hands from bidding/play
- **4-player**: Not zero-sum (bidder vs 3 defenders)

**Comparison to other games:**
- Simpler than Bridge (fewer cards, simpler bidding)
- More complex than Hearts (bidding, folding, special rules)
- Similar complexity to Spades or Euchre (obviously)

**AI Implications:**
- Need to handle imperfect information (determinization or CFR)
- Can benefit from opponent modeling (bidding reveals information)
- Card counting is feasible (only 24 cards)
- Planning ahead matters (5 tricks total)
- Position matters (dealer, bidder advantages)

---

## AI Approaches Overview

### 1. Enhanced Rule-Based AI

**Approach:** Improve heuristics with better game understanding.

#### Improvements Over Current AI

**Better Hand Evaluation:**
```typescript
function evaluateHand(hand: Card[], trumpSuit: Suit): HandStrength {
  let strength = 0;

  // Trump strength
  const trumps = hand.filter(c => getEffectiveSuit(c, trumpSuit) === trumpSuit);
  strength += trumps.length * 2;

  // High trump bonus
  if (hasRightBower(trumps, trumpSuit)) strength += 5;
  if (hasLeftBower(trumps, trumpSuit)) strength += 4;
  if (hasAce(trumps)) strength += 3;

  // Control cards in side suits
  for (const suit of NON_TRUMP_SUITS) {
    const suitCards = hand.filter(c => c.suit === suit);
    if (hasAce(suitCards)) strength += 2;
    if (suitCards.length >= 3) strength += 1; // Length
  }

  // Void suits (can trump in)
  const voidSuits = suits.filter(s =>
    hand.filter(c => c.suit === s).length === 0
  );
  strength += voidSuits.length * 1.5;

  return {
    strength,
    trumpCount: trumps.length,
    controls: countControlCards(hand, trumpSuit),
    voids: voidSuits
  };
}
```

**Card Counting & Inference:**
```typescript
class CardTracker {
  private playedCards: Set<CardId> = new Set();
  private playerVoids: Map<PlayerPosition, Set<Suit>> = new Map();

  trackCardPlayed(card: Card, player: PlayerPosition) {
    this.playedCards.add(card.id);
  }

  trackVoid(player: PlayerPosition, suit: Suit, trick: Trick) {
    // If player didn't follow suit, mark as void
    if (trick.ledSuit === suit && !playerFollowed(player, suit, trick)) {
      this.playerVoids.get(player)?.add(suit);
    }
  }

  getRemainingCards(suit: Suit): Card[] {
    return DECK.filter(c =>
      c.suit === suit && !this.playedCards.has(c.id)
    );
  }

  getPossibleHands(player: PlayerPosition): Card[][] {
    // Return possible hands consistent with observations
    const impossible = Array.from(this.playedCards);
    const voidSuits = this.playerVoids.get(player) || new Set();

    return generateConsistentHands(impossible, voidSuits);
  }
}
```

**Smarter Card Play:**
```typescript
function selectCardToPlay(
  hand: Card[],
  trick: Trick,
  trumpSuit: Suit,
  tracker: CardTracker,
  position: PlayerPosition
): Card {
  const legal = getLegalCards(hand, trick, trumpSuit);

  if (trick.cards.length === 0) {
    // Leading: Strategic considerations

    // Lead trump if holding control
    if (hasRightBower(hand, trumpSuit) || hasMostTrump(hand, tracker)) {
      return highestTrump(legal, trumpSuit);
    }

    // Lead from void suits (others might have to follow)
    const longSuits = suits.filter(s =>
      hand.filter(c => c.suit === s).length >= 3
    );
    if (longSuits.length > 0) {
      return lowestOfSuit(legal, longSuits[0]);
    }

    // Default: lead low from weak suit
    return lowestNonTrump(legal, trumpSuit);

  } else {
    // Following: Try to win or dump

    const currentWinner = getTrickWinner(trick, trumpSuit);
    const canWin = legal.filter(c =>
      beats(c, currentWinner, trick.ledSuit, trumpSuit)
    );

    if (canWin.length > 0) {
      // Win cheaply if possible
      return lowestWinningCard(canWin);
    } else {
      // Can't win: dump lowest
      return lowest(legal);
    }
  }
}
```

**Performance:**
- Inference time: <5ms per decision
- Memory: <1MB
- Strength: Casual player level
- Difficulty to implement: Low (1-2 weeks)

**Pros:**
- ✅ Fast (<5ms)
- ✅ No training required
- ✅ Easy to understand and debug
- ✅ Small code footprint
- ✅ Deterministic (given same state)

**Cons:**
- ❌ Still fairly weak (ceiling at casual level)
- ❌ No probabilistic reasoning
- ❌ Hard to tune thresholds
- ❌ Can't provide win probabilities
- ❌ No learning or adaptation

**Best Used For:**
- Easy difficulty level
- Fast baseline for comparisons
- Sanity checks in testing

---

### 2. Perfect Information Monte Carlo (PIMC)

**Approach:** Sample possible opponent hands, simulate games assuming perfect information.

#### Algorithm

```typescript
function pimcDecision(
  gameState: GameState,
  myPosition: PlayerPosition,
  simulations: number = 100
): Action {
  const legalActions = getLegalActions(gameState, myPosition);
  const scores = new Map<Action, number>();

  // For each legal action
  for (const action of legalActions) {
    let totalScore = 0;

    // Run many simulations
    for (let i = 0; i < simulations; i++) {
      // Sample possible opponent hands
      const scenario = sampleOpponentHands(gameState, myPosition);

      // Play out the game with this action
      const outcome = simulateGame(scenario, action, myPosition);

      totalScore += outcome.scoreChange;
    }

    scores.set(action, totalScore / simulations);
  }

  // Return action with best average score
  return argmax(scores);
}

function sampleOpponentHands(
  gameState: GameState,
  myPosition: PlayerPosition
): GameState {
  // Get cards not yet seen
  const unseenCards = getUnseenCards(gameState, myPosition);

  // Shuffle and deal to opponents
  shuffle(unseenCards);

  const scenario = cloneGameState(gameState);
  let idx = 0;

  for (let pos = 0; pos < 4; pos++) {
    if (pos === myPosition) continue;

    const handSize = scenario.players[pos].hand.length;
    scenario.players[pos].hand = unseenCards.slice(idx, idx + handSize);
    idx += handSize;
  }

  return scenario;
}

function simulateGame(
  scenario: GameState,
  firstAction: Action,
  myPosition: PlayerPosition
): Outcome {
  let state = applyAction(scenario, firstAction);

  // Play rest of game with fast rollout policy
  while (!state.gameOver) {
    const currentPlayer = getCurrentPlayer(state);
    const action = fastRolloutPolicy(state, currentPlayer);
    state = applyAction(state, action);
  }

  return {
    scoreChange: state.players[myPosition].score - scenario.players[myPosition].score,
    tricksWon: state.players[myPosition].tricksTaken
  };
}
```

#### Strategy Fusion Problem

PIMC has a known weakness called "strategy fusion":

**Example:**
- Opponent has either (A♠, K♠, 10♣) OR (10♠, 9♠, A♣)
- PIMC samples both scenarios
- In scenario 1: Leading spades is bad (opponent has A♠)
- In scenario 2: Leading spades is good (opponent has low spades)
- **Problem**: In reality, opponent knows their hand!
  - If they have A♠, they'll cover your K♠
  - If they don't, they can't
- PIMC averages these scenarios incorrectly

**Mitigation:**
- Use many more samples (1000+)
- Weight samples by likelihood (based on bidding)
- Use as baseline, not final approach

**Performance:**
- Inference time: 50-150ms (100 simulations)
- Memory: ~10MB per game
- Strength: Competent player level
- Difficulty to implement: Medium (1 week)

**Pros:**
- ✅ Better than pure rules
- ✅ Provides win probabilities
- ✅ No training required
- ✅ Can evaluate all actions
- ✅ Relatively simple to implement

**Cons:**
- ❌ Strategy fusion problem
- ⚠️ Slower than rules (100x)
- ⚠️ Can be exploitable
- ❌ No persistent learning

**Best Used For:**
- Medium difficulty level
- Teaching features (win probabilities)
- Baseline for ISMCTS comparison

---

### 3. Information Set Monte Carlo Tree Search (ISMCTS)

**Approach:** Extension of MCTS for imperfect information games. Builds search tree over information sets.

#### Algorithm

```typescript
class ISMCTSNode {
  visits: number = 0;
  totalValue: number = 0;
  children: Map<Action, ISMCTSNode> = new Map();

  get ucb1(): number {
    if (this.visits === 0) return Infinity;
    const exploitation = this.totalValue / this.visits;
    const exploration = Math.sqrt(Math.log(this.parent.visits) / this.visits);
    return exploitation + C_EXPLORATION * exploration;
  }
}

class ISMCTSEngine {
  async decide(
    gameState: GameState,
    myPosition: PlayerPosition,
    simulations: number = 2000
  ): Promise<Action> {
    const root = new ISMCTSNode();

    for (let i = 0; i < simulations; i++) {
      // 1. Determinization: Sample a possible world
      const scenario = this.sampleConsistentWorld(gameState, myPosition);

      // 2. Selection: Walk down tree using UCB1
      let node = root;
      let state = scenario;
      const path: ISMCTSNode[] = [root];

      while (!this.isTerminal(state) && node.children.size > 0) {
        const action = this.selectActionUCB1(node);
        state = applyAction(state, action);
        node = node.children.get(action)!;
        path.push(node);
      }

      // 3. Expansion: Add new node
      if (!this.isTerminal(state)) {
        const action = this.selectUntriedAction(node, state);
        state = applyAction(state, action);
        const child = new ISMCTSNode();
        node.children.set(action, child);
        path.push(child);
        node = child;
      }

      // 4. Simulation: Play out with fast policy
      const outcome = this.rollout(state, myPosition);

      // 5. Backpropagation: Update statistics
      for (const n of path) {
        n.visits++;
        n.totalValue += outcome.value;
      }
    }

    // Return most visited action (robust child)
    return this.getMostVisitedAction(root);
  }

  private sampleConsistentWorld(
    gameState: GameState,
    myPosition: PlayerPosition
  ): GameState {
    // More sophisticated than PIMC
    const observations = this.getObservations(gameState, myPosition);

    // Sample weighted by likelihood
    const unseenCards = this.getUnseenCards(gameState, myPosition);
    const distribution = this.inferDistribution(observations);

    return this.sampleFromDistribution(unseenCards, distribution);
  }

  private inferDistribution(observations: Observation[]): Distribution {
    // Infer opponent hand distributions from:
    // - Bidding behavior (bid 4 => likely strong in trump)
    // - Cards played (didn't follow suit => void)
    // - Folding decisions (folded => weak trump)

    const priors = uniformDistribution();

    for (const obs of observations) {
      if (obs.type === 'BID') {
        // Higher bid => more likely to have trump
        priors.adjustForBid(obs.player, obs.amount);
      }
      if (obs.type === 'VOID_REVEALED') {
        // Player didn't follow suit => void
        priors.eliminateSuit(obs.player, obs.suit);
      }
      if (obs.type === 'FOLD') {
        // Folded => likely weak trump
        priors.adjustForFold(obs.player);
      }
    }

    return priors;
  }

  private rollout(state: GameState, myPosition: PlayerPosition): Outcome {
    // Fast playout with simple heuristics
    while (!state.gameOver) {
      const player = getCurrentPlayer(state);
      const action = this.fastPolicy(state, player);
      state = applyAction(state, action);
    }

    return {
      value: this.evaluateOutcome(state, myPosition),
      tricks: state.players[myPosition].tricksTaken
    };
  }
}
```

#### Key Advantages Over PIMC

1. **Tree reuse across determinizations**: PIMC throws away information between samples
2. **Exploration/exploitation tradeoff**: UCB1 balances trying new actions vs exploiting good ones
3. **Focused search**: Spends more time on promising lines
4. **Better handling of information sets**: Groups similar states together

#### Statistical Output

```typescript
interface ISMCTSAnalysis {
  actions: Array<{
    action: Action;
    visits: number;           // How many times explored
    winRate: number;          // Wins / visits
    avgTricks: number;        // Average tricks from this action
    avgScore: number;         // Average score change
    confidence: number;       // Visit count / total visits
    ucb1Score: number;        // Exploration/exploitation value
  }>;
  totalSimulations: number;
  explorationComplete: number; // 0.0-1.0
  bestAction: Action;
  alternativeActions: Action[];
}

// Example usage for teaching
const analysis = await ismcts.analyze(gameState, myPosition, 2000);

console.log(analysis.actions);
// [
//   {
//     action: { type: 'PLAY_CARD', card: 'SPADES_ACE' },
//     visits: 850,
//     winRate: 0.65,
//     avgTricks: 3.2,
//     avgScore: -2.8,
//     confidence: 0.425,  // 850/2000
//     ucb1Score: 0.68
//   },
//   {
//     action: { type: 'PLAY_CARD', card: 'HEARTS_KING' },
//     visits: 680,
//     winRate: 0.52,
//     avgTricks: 2.9,
//     avgScore: -1.5,
//     confidence: 0.34,
//     ucb1Score: 0.55
//   },
//   // ... other actions
// ]
```

**Performance:**
- Inference time: 100-200ms (1000 simulations)
- Memory: ~20MB per game
- Strength: Strong player to expert level
- Difficulty to implement: Medium-High (1-2 weeks)

**Pros:**
- ✅✅ Strong play (expert level with enough sims)
- ✅✅ Excellent for teaching (rich statistics)
- ✅ No training required
- ✅ Handles imperfect information well
- ✅ Provides confidence intervals
- ✅ Can run more simulations for critical decisions

**Cons:**
- ⚠️ Slower than rules/PIMC
- ⚠️ Memory usage grows with tree size
- ⚠️ Quality depends on rollout policy
- ❌ No persistent learning between games

**Best Used For:**
- Hard difficulty level
- Teaching features (probabilities + confidence)
- Offline practice mode (powerful device)
- Baseline for neural network comparison

**Recommended Configuration:**
- Easy: 100 simulations (~20ms)
- Medium: 500 simulations (~75ms)
- Hard: 2000 simulations (~250ms)
- Expert: 5000 simulations (~600ms)

---

### 4. Neural Network (Policy-Value Network)

**Approach:** Train a neural network to predict (1) best action probabilities and (2) expected outcome.

#### Architecture

```python
import torch
import torch.nn as nn

class BuckEuchreNet(nn.Module):
    """Policy-Value Network for Buck Euchre"""

    def __init__(self, hidden_dim=256):
        super().__init__()

        # Input: State encoding
        # - My hand: 24 binary (which cards I have)
        # - Cards played: 24 binary (which cards seen)
        # - Trump suit: 4 one-hot
        # - My position: 4 one-hot
        # - Scores: 4 floats (normalized)
        # - Phase info: 5 one-hot
        # - Bid info: ~10 floats
        # Total: ~75 features

        self.input_size = 75

        # Shared trunk: ResNet-style blocks
        self.input_layer = nn.Linear(self.input_size, hidden_dim)

        self.res_blocks = nn.ModuleList([
            ResidualBlock(hidden_dim) for _ in range(10)
        ])

        # Policy head: Predict action probabilities
        self.policy_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, MAX_ACTIONS),  # ~30 max actions
            nn.Softmax(dim=-1)
        )

        # Value head: Predict expected score
        self.value_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 4),
            nn.ReLU(),
            nn.Linear(hidden_dim // 4, 1),
            nn.Tanh()  # Score is bounded
        )

    def forward(self, state):
        x = F.relu(self.input_layer(state))

        # Pass through residual blocks
        for block in self.res_blocks:
            x = block(x)

        # Get policy and value predictions
        policy = self.policy_head(x)
        value = self.value_head(x)

        return policy, value

class ResidualBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.fc1 = nn.Linear(dim, dim)
        self.fc2 = nn.Linear(dim, dim)

    def forward(self, x):
        residual = x
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        return F.relu(x + residual)
```

**Model Size:**
- Parameters: ~10-20M
- Memory: 40-80MB (float32), 10-20MB (quantized)
- Inference time: 2-5ms (Core ML), 5-20ms (TensorFlow.js)

#### Training Pipeline

```python
class BuckEuchreTrainer:
    def __init__(self, model, device='cuda'):
        self.model = model.to(device)
        self.optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
        self.device = device

    def train_supervised(self, dataset):
        """
        Phase 1: Supervised learning from expert games

        Dataset: List of (state, expert_action, outcome)
        Generated from ISMCTS self-play
        """
        for epoch in range(num_epochs):
            for batch in dataloader:
                states, actions, outcomes = batch

                # Forward pass
                policy_pred, value_pred = self.model(states)

                # Loss = Policy loss + Value loss
                policy_loss = F.cross_entropy(policy_pred, actions)
                value_loss = F.mse_loss(value_pred, outcomes)

                total_loss = policy_loss + value_loss

                # Backward pass
                self.optimizer.zero_grad()
                total_loss.backward()
                self.optimizer.step()

    def train_reinforcement(self, num_iterations=10):
        """
        Phase 2: Reinforcement learning via self-play

        AlphaZero-style training:
        1. Generate games with current network
        2. Train network on game outcomes
        3. Repeat
        """
        for iteration in range(num_iterations):
            # Generate self-play games
            games = self.generate_self_play_games(
                num_games=1000,
                simulations_per_move=200
            )

            # Extract training examples
            examples = self.process_games(games)

            # Train on examples
            self.train_supervised(examples)

            # Evaluate improvement
            if iteration % 5 == 0:
                self.evaluate_vs_baseline()

    def generate_self_play_games(self, num_games, simulations_per_move):
        """Generate games using network + MCTS"""
        games = []

        for _ in range(num_games):
            game_states = []
            state = initializeGame()

            while not state.gameOver:
                # Use network to guide MCTS
                action, search_stats = self.mcts_with_network(
                    state,
                    simulations=simulations_per_move
                )

                game_states.append({
                    'state': state,
                    'action': action,
                    'search_policy': search_stats.visit_distribution
                })

                state = applyAction(state, action)

            # Add final outcome to all states
            for s in game_states:
                s['outcome'] = state.finalScores

            games.append(game_states)

        return games
```

#### Export to TensorFlow.js

```python
def export_to_tfjs(model, export_path):
    """Export PyTorch model to TensorFlow.js format"""

    # Method 1: Via ONNX
    dummy_input = torch.randn(1, 75)
    torch.onnx.export(
        model,
        dummy_input,
        'model.onnx',
        export_params=True,
        opset_version=11
    )

    # Convert ONNX to TensorFlow
    import onnx
    from onnx_tf.backend import prepare

    onnx_model = onnx.load('model.onnx')
    tf_rep = prepare(onnx_model)
    tf_rep.export_graph('model_tf')

    # Convert TensorFlow to TensorFlow.js
    import tensorflowjs as tfjs
    tfjs.converters.convert_tf_saved_model(
        'model_tf',
        export_path,
        quantization_bytes=2  # Quantize to reduce size
    )

    print(f"Model exported to {export_path}")
    print(f"Load in JS with: tf.loadGraphModel('{export_path}/model.json')")
```

#### Usage in TypeScript (PWA)

```typescript
import * as tf from '@tensorflow/tfjs';

class NeuralAgent {
  private model: tf.GraphModel | null = null;

  async loadModel(modelPath: string) {
    this.model = await tf.loadGraphModel(modelPath);
    console.log('Model loaded');
  }

  async evaluate(gameState: GameState): Promise<{
    policy: Map<Action, number>;
    value: number;
  }> {
    // Encode state to tensor
    const stateTensor = this.encodeState(gameState);

    // Run inference
    const [policyTensor, valueTensor] = this.model!.predict(stateTensor) as [tf.Tensor, tf.Tensor];

    // Decode outputs
    const policyArray = await policyTensor.data();
    const valueArray = await valueTensor.data();

    // Map to actions
    const legalActions = getLegalActions(gameState);
    const policy = new Map<Action, number>();

    for (let i = 0; i < legalActions.length; i++) {
      policy.set(legalActions[i], policyArray[i]);
    }

    return {
      policy,
      value: valueArray[0]
    };
  }

  private encodeState(gameState: GameState): tf.Tensor {
    const features: number[] = [];

    // My hand (24 binary features)
    for (const card of ALL_CARDS) {
      features.push(myHand.includes(card) ? 1 : 0);
    }

    // Cards played (24 binary features)
    for (const card of ALL_CARDS) {
      features.push(hasBeenPlayed(card, gameState) ? 1 : 0);
    }

    // Trump suit (4 one-hot)
    for (const suit of SUITS) {
      features.push(gameState.trumpSuit === suit ? 1 : 0);
    }

    // My position (4 one-hot)
    for (let pos = 0; pos < 4; pos++) {
      features.push(myPosition === pos ? 1 : 0);
    }

    // Scores (4 floats, normalized)
    for (const player of gameState.players) {
      features.push(player.score / 15);  // Normalize by starting score
    }

    // Phase (5 one-hot)
    for (const phase of PHASES) {
      features.push(gameState.phase === phase ? 1 : 0);
    }

    // Bid info
    features.push((gameState.highestBid || 0) / 5);
    // ... etc

    return tf.tensor2d([features], [1, features.length]);
  }
}
```

**Performance:**
- Training time: 4-12 hours on RTX 3070 (supervised)
- Training time: 20-40 hours (reinforcement learning)
- Inference time:
  - Core ML (iOS): 2-5ms
  - TensorFlow.js (WebGL): 5-20ms
  - TensorFlow.js (CPU): 50-100ms
- Memory: 40-80MB (model) + 10MB (runtime)
- Strength: Expert level (with good training data)
- Difficulty to implement: High (3-4 weeks)

**Pros:**
- ✅✅ Fast inference (5-20ms)
- ✅✅ Continuous value predictions
- ✅✅ Can evaluate all actions in one pass
- ✅ Learns from experience
- ✅ Policy gives probability distribution
- ✅ Excellent for teaching features

**Cons:**
- ❌ Requires significant training
- ❌ Large model size (40-80MB)
- ❌ Needs training data or self-play
- ❌ Less interpretable than MCTS
- ⚠️ Can overfit or have blind spots
- ⚠️ Quality depends on training

**Best Used For:**
- Fast evaluation in hybrid MCTS
- Teaching features (instant probabilities)
- When inference speed is critical
- After collecting sufficient training data

---

### 5. Hybrid: Neural Network + MCTS

**Approach:** Use neural network to guide MCTS search (AlphaZero-style).

#### Algorithm

```typescript
class NeuralMCTS {
  constructor(
    private neuralNet: NeuralAgent,
    private numSimulations: number = 1000
  ) {}

  async decide(
    gameState: GameState,
    myPosition: PlayerPosition
  ): Promise<Action> {
    const root = new MCTSNode();

    // Get neural network's initial evaluation
    const { policy: priorPolicy, value: priorValue } =
      await this.neuralNet.evaluate(gameState);

    // Initialize root with neural priors
    for (const [action, prob] of priorPolicy) {
      root.initChild(action, prob);
    }

    for (let i = 0; i < this.numSimulations; i++) {
      // Sample a determinization
      const scenario = sampleConsistentWorld(gameState, myPosition);

      // Selection with neural-guided UCB
      let node = root;
      let state = scenario;

      while (!isTerminal(state) && node.isFullyExpanded()) {
        const action = this.selectActionPUCT(node);  // Uses neural priors
        state = applyAction(state, action);
        node = node.children.get(action)!;
      }

      // Expansion
      if (!isTerminal(state) && !node.isFullyExpanded()) {
        const action = node.selectUntriedAction();
        state = applyAction(state, action);
        const child = node.expand(action);
        node = child;
      }

      // Evaluation: Use neural network instead of rollout!
      const { value } = await this.neuralNet.evaluate(state);

      // Backpropagation
      node.backpropagate(value);
    }

    return root.getMostVisitedAction();
  }

  private selectActionPUCT(node: MCTSNode): Action {
    // PUCT: Predictor + UCT
    // Combines visit counts with neural network priors

    let bestScore = -Infinity;
    let bestAction: Action | null = null;

    for (const [action, child] of node.children) {
      const Q = child.totalValue / (child.visits + 1);  // Avg value
      const U = this.c_puct * child.prior *
                Math.sqrt(node.visits) / (1 + child.visits);  // Exploration

      const score = Q + U;

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction!;
  }
}
```

#### Why This Is Best

Combines strengths of both approaches:

**Neural Network provides:**
- Fast position evaluation (no rollout needed)
- Good action priors (focus search on promising moves)
- Learned patterns from training

**MCTS provides:**
- Refinement through search
- Handling of tactics and concrete lines
- Confidence through visit counts
- Adaptability to specific position

**Result:**
- Stronger than either alone
- More robust than pure neural network
- Better sample efficiency than pure MCTS

#### Comparison Example

Consider bidding decision:

**Pure Neural Network:**
```
Bid 2: 15% probability
Bid 3: 68% probability  ← Recommends
Bid 4: 12% probability
Bid 5: 5% probability
```
Fast but might miss tactical considerations.

**Pure ISMCTS:**
```
Bid 2: 45/200 simulations (22.5%)
Bid 3: 120/200 simulations (60%)  ← Recommends
Bid 4: 30/200 simulations (15%)
Bid 5: 5/200 simulations (2.5%)
```
More thorough but slower, might waste time on unlikely bids.

**Neural + MCTS:**
```
Using neural priors to guide search:
Bid 2: 20/1000 simulations (neural said 15%, search confirms low)
Bid 3: 750/1000 simulations (neural said 68%, search heavily explores)
Bid 4: 180/1000 simulations (neural said 12%, search refines)
Bid 5: 50/1000 simulations (neural said 5%, search verifies bad)

Final: Bid 3 with 75% confidence
```
Best of both: Neural priors guide search, search refines estimate.

**Performance:**
- Inference time: 200-500ms (depends on sims)
- Memory: ~60-100MB (model + tree)
- Strength: Superhuman level (given good training)
- Difficulty to implement: High (4-6 weeks total)

**Pros:**
- ✅✅✅ Strongest possible play
- ✅✅ Best teaching features (neural + search stats)
- ✅✅ Cross-validation (neural and search agree/disagree)
- ✅ More robust than pure neural
- ✅ Better sample efficiency than pure MCTS

**Cons:**
- ❌ Most complex to implement
- ❌ Requires neural network training
- ❌ Slowest inference (but still real-time viable)
- ❌ Largest memory footprint

**Best Used For:**
- Expert/Master difficulty level
- Ultimate AI strength goal
- Research and experimentation
- Teaching features (best explanations)

---

## Deployment Architecture Options

### Constraint Analysis

**Current Infrastructure:**
- **Server**: AWS Lightsail $12/month (2GB RAM, 2 cores @ 20% utilization)
- **Training**: RTX 3070 (8GB VRAM), AMD 5070 CPU
- **Client**: PWA (targets iPhone 16 Pro Max and similar devices)
- **Load**: ~10 concurrent games, ~100 AI decisions/minute

**Per-Decision Budget:**
- 100 decisions/min = 1.67/sec
- Target: <500ms response time
- Effective compute: ~0.4 CPU cores (20% of 2)
- **Budget: ~240ms CPU time per decision**

### Architecture Option 1: Server-Side AI Only

```
┌─────────────┐          ┌─────────────────────┐
│   Client    │          │      Server         │
│   (PWA)     │◄────────►│   - Game State      │
│             │ WebSocket│   - AI Decision     │
│  UI Only    │          │   - Validation      │
└─────────────┘          │   - Persistence     │
                         └─────────────────────┘
```

**AI Approach for Server:**
- Enhanced rule-based (Easy): <5ms
- PIMC (Medium): 50-150ms, 100-200 simulations
- Lightweight ISMCTS (Hard): 100-200ms, 200-400 simulations

**Pros:**
- ✅ Simple architecture (current setup)
- ✅ Works for all clients (no client requirements)
- ✅ Consistent AI across devices
- ✅ Easy to update AI (server deploy)
- ✅ Works offline if cached properly

**Cons:**
- ❌ Limited by weak server (can't run heavy AI)
- ❌ Network latency for each move
- ❌ Scales poorly (10 concurrent games max)
- ❌ No offline practice with strong AI

**Best for:**
- Multiplayer games with AI fillers
- Users without powerful devices
- Consistent experience across platforms

**Performance on $12/month server:**
```
Easy (Rules):      <5ms     ✅✅✅
Medium (PIMC):     100ms    ✅✅
Hard (ISMCTS):     200ms    ✅
Expert (Neural):   N/A      ❌ (too large for 2GB RAM)
```

### Architecture Option 2: Client-Side AI Only

```
┌─────────────────────┐          ┌─────────────┐
│   Client (PWA)      │          │   Server    │
│  - Game State       │◄────────►│             │
│  - AI Decision      │          │  Minimal:   │
│  - Validation       │          │  - Users    │
│  - Teaching         │          │  - Lobbies  │
└─────────────────────┘          │  - Stats    │
                                 └─────────────┘
```

**AI Approach for Client:**
- JavaScript ISMCTS: 250ms, 2000 simulations
- TensorFlow.js + MCTS: 300-500ms
- WebAssembly ISMCTS: 150ms, 5000 simulations

**Pros:**
- ✅ Powerful AI (uses client device)
- ✅ No server load for AI
- ✅ No network latency
- ✅ True offline capability
- ✅ Infinite scalability (client pays compute cost)

**Cons:**
- ❌ Requires powerful client device
- ❌ Drains battery
- ❌ Inconsistent across devices
- ❌ Hard to update AI (client update required)
- ❌ Doesn't work for multiplayer with AI bots

**Best for:**
- Practice/training mode
- Offline play
- Users with powerful devices (iPhone 16 Pro Max, etc.)

**Performance on iPhone 16 Pro Max:**
```
JavaScript ISMCTS (2000 sims):     250ms   ✅✅✅
TensorFlow.js + MCTS (1000 sims):  350ms   ✅✅
WebAssembly ISMCTS (5000 sims):    180ms   ✅✅✅
```

### Architecture Option 3: Hybrid (Recommended) ✅

```
Multiplayer Mode:              Practice Mode:
┌─────────┐                    ┌─────────────────┐
│ Client  │◄─WebSocket────┐    │ Client (PWA)    │
└─────────┘                │    │  - Local game   │
┌─────────┐                │    │  - Strong AI    │
│ Client  │◄───────────────┤    │  - Teaching     │
└─────────┘                │    │  - Offline      │
    ↓                      │    └─────────────────┘
Server runs               │         No server
lightweight AI        ────┘         needed!
```

**Implementation:**

```typescript
// Game mode selection
enum GameMode {
  MULTIPLAYER_ONLINE,   // Server-side game + AI
  PRACTICE_OFFLINE      // Client-side game + AI
}

class GameManager {
  createGame(mode: GameMode, options: GameOptions) {
    if (mode === GameMode.MULTIPLAYER_ONLINE) {
      return new OnlineGame(options);  // Uses server
    } else {
      return new OfflineGame(options); // All local
    }
  }
}

// Online game (current implementation)
class OnlineGame {
  constructor(private serverConnection: WebSocketConnection) {}

  async makeMove(action: Action) {
    // Send to server
    await this.serverConnection.send('GAME_ACTION', action);
    // Server validates, updates state, triggers AI if needed
  }
}

// Offline game (new for practice mode)
class OfflineGame {
  private state: GameState;
  private aiEngines: AIEngine[];

  constructor(options: { difficulty: 'easy' | 'medium' | 'hard' }) {
    this.state = initializeGame();

    // Create 3 AI opponents based on difficulty
    this.aiEngines = [
      this.createAI(options.difficulty, 0),
      this.createAI(options.difficulty, 1),
      this.createAI(options.difficulty, 2),
    ];
  }

  private createAI(difficulty: string, position: number): AIEngine {
    switch (difficulty) {
      case 'easy':
        return new RuleBasedAI(position);
      case 'medium':
        return new PIMCAIEngine(position, { simulations: 200 });
      case 'hard':
        return new ISMCTSEngine(position, { simulations: 2000 });
      default:
        throw new Error(`Unknown difficulty: ${difficulty}`);
    }
  }

  async makeMove(action: Action) {
    // Validate and apply player action
    if (!isValidAction(this.state, action)) {
      throw new Error('Invalid action');
    }

    this.state = applyAction(this.state, action);
    this.notifyObservers();

    // Run AI turns until it's player's turn again
    await this.runAITurns();
  }

  private async runAITurns() {
    while (this.isAITurn() && !this.state.gameOver) {
      const aiPosition = this.getCurrentPlayerPosition();
      const ai = this.aiEngines[aiPosition];

      // Get AI decision (with teaching analysis)
      const { action, analysis } = await ai.decideWithAnalysis(this.state);

      // Show teaching overlay if enabled
      if (this.teachingMode) {
        this.showAIThinking(analysis);
        await this.delay(1000);  // Let user see AI's thinking
      }

      // Apply AI action
      this.state = applyAction(this.state, action);
      this.notifyObservers();
    }
  }

  async getTeachingAnalysis(): Promise<TeachingAnalysis> {
    // Use same AI engine to analyze player's options
    const myPosition = this.getHumanPlayerPosition();
    const ai = this.aiEngines[0];  // Use hard AI for analysis

    return await ai.analyzeAllActions(this.state, myPosition);
  }
}
```

**Server AI (Multiplayer):**
- Easy: Enhanced rules (<5ms)
- Medium: PIMC (~100ms, 100 sims)
- Hard: Lightweight ISMCTS (~200ms, 300 sims)

**Client AI (Practice Mode):**
- Easy: Enhanced rules (<5ms)
- Medium: PIMC (~50ms, 200 sims)
- Hard: ISMCTS (~250ms, 2000 sims)
- Expert: Neural + MCTS (~400ms, 1000 sims)

**Pros:**
- ✅✅ Best of both worlds
- ✅ Multiplayer works on weak server
- ✅ Practice mode has strong AI
- ✅ True offline capability for practice
- ✅ Scales well (server handles simple, client handles complex)

**Cons:**
- ⚠️ More complex to implement (two code paths)
- ⚠️ Code sharing needed (shared game logic)
- ⚠️ Testing both modes

**Implementation Effort:**
- Refactor shared logic: 3-5 days
- Server AI improvements: 1-2 weeks
- Client AI implementation: 2-3 weeks
- Testing and polish: 1 week
- **Total: 5-7 weeks**

### Shared Code Strategy

Move game logic to shared package:

```
Before:
backend/src/game/         ← Game rules here
frontend/src/            ← Reimplements rules? ❌

After:
shared/src/game/         ← Game rules HERE (single source of truth)
├── cards.ts
├── state.ts
├── validation.ts
├── scoring.ts
└── deck.ts

backend/src/             ← Imports from shared ✅
frontend/src/            ← Imports from shared ✅
ai-research/src/         ← Imports from shared ✅
```

**Benefits:**
- ✅ Single source of truth for game rules
- ✅ Rules tested once, work everywhere
- ✅ AI training uses same rules as production
- ✅ Easy to add new features (update once)

---

## Teaching & Interpretability Features

### Requirement

Users want to **improve their play** through:
- Seeing ideal moves with probabilities
- Understanding win rates for different actions
- Learning from post-game analysis
- Getting hints with adjustable detail

### Why This Favors Probabilistic AI

| Feature | Rules | PIMC | ISMCTS | Neural | Neural+MCTS |
|---------|-------|------|--------|--------|-------------|
| Best move | ✅ | ✅ | ✅ | ✅ | ✅ |
| Win % per action | ❌ | ⚠️ | ✅✅ | ✅✅ | ✅✅✅ |
| Expected tricks | ❌ | ✅ | ✅✅ | ✅✅ | ✅✅✅ |
| Confidence levels | ❌ | ⚠️ | ✅ | ⚠️ | ✅✅ |
| Ranking options | ⚠️ | ✅ | ✅✅ | ✅✅ | ✅✅✅ |
| Continuous values | ❌ | ❌ | ⚠️ | ✅✅ | ✅✅ |

**Conclusion:** ISMCTS or Neural+MCTS are ideal for teaching features.

### Feature 1: Card Play Analysis Overlay

When it's the player's turn, show analysis for each card:

```typescript
interface CardAnalysis {
  card: Card;
  winProbability: number;      // 0.68 = 68% chance to win game
  expectedTricks: number;       // 3.2 expected tricks
  expectedScore: number;        // -2.5 expected score change
  ranking: number;              // 1st best, 2nd best, etc.
  confidence: number;           // 0.95 = high confidence
  reasoning: string[];          // Human-readable explanations
}

async function analyzeCardPlay(
  gameState: GameState,
  playerPosition: PlayerPosition
): Promise<CardAnalysis[]> {
  const ismcts = new ISMCTSEngine();
  const analysis = await ismcts.analyzeAllActions(
    gameState,
    playerPosition,
    { simulations: 2000, returnFullStats: true }
  );

  return analysis.actions.map(a => ({
    card: a.action.card,
    winProbability: a.winRate,
    expectedTricks: a.avgTricks,
    expectedScore: a.avgScore,
    ranking: a.rank,
    confidence: a.visits / analysis.totalSimulations,
    reasoning: generateReasoning(a, gameState)
  }));
}

function generateReasoning(
  action: ActionStats,
  gameState: GameState
): string[] {
  const reasons: string[] = [];

  // Why this card is good/bad
  if (action.winRate > 0.6) {
    reasons.push(`Strong play: ${(action.winRate * 100).toFixed(0)}% win rate`);
  }

  if (willWinTrick(action.action.card, gameState)) {
    reasons.push('Wins current trick');
  }

  if (maintainsControl(action.action.card, gameState)) {
    reasons.push('Maintains trump control');
  }

  if (givesUpControl(action.action.card, gameState)) {
    reasons.push('⚠️ Gives up trump control');
  }

  return reasons;
}
```

**UI Mock:**
```
┌─────────────────── Your Hand ───────────────────┐
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  A♠      │  │  K♥      │  │  10♣     │      │
│  │          │  │          │  │          │      │
│  │ ⭐ BEST  │  │  2nd     │  │  3rd     │      │
│  │ Win: 68% │  │ Win: 52% │  │ Win: 45% │      │
│  │ Tricks:  │  │ Tricks:  │  │ Tricks:  │      │
│  │  3.2     │  │  2.8     │  │  2.5     │      │
│  │          │  │          │  │          │      │
│  │ Reasoning:│  │ Reasoning:│  │ Reasoning:│     │
│  │ • Wins   │  │ • Safer  │  │ • Gives  │      │
│  │   trick  │  │   option │  │   up     │      │
│  │ • Keeps  │  │ • Decent │  │   tempo  │      │
│  │   control│  │   tricks │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  [Show More Details] [Hide Analysis]            │
└──────────────────────────────────────────────────┘
```

### Feature 2: Bidding Probability Table

```typescript
interface BidAnalysis {
  bid: number | 'PASS';
  makeProbability: number;      // P(make this bid)
  expectedTricks: number;        // E[tricks if we bid this]
  expectedScoreChange: number;  // E[score change]
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  recommendation: number;        // 0.0 to 1.0 (how recommended)
  evComparison: number;          // Expected value vs PASS
}

async function analyzeBidding(
  hand: Card[],
  turnUpCard: Card,
  currentBid: number | null,
  gameState: GameState
): Promise<BidAnalysis[]> {
  const analyses: BidAnalysis[] = [];

  // Analyze PASS
  const passAnalysis = await simulateBid('PASS', hand, gameState);
  analyses.push(passAnalysis);

  // Analyze each possible bid
  for (const bid of [2, 3, 4, 5]) {
    if (currentBid !== null && bid <= currentBid) continue;

    const analysis = await simulateBid(bid, hand, gameState);
    analyses.push(analysis);
  }

  return analyses;
}

async function simulateBid(
  bid: BidAmount,
  hand: Card[],
  gameState: GameState
): Promise<BidAnalysis> {
  const simulations = 1000;
  let madeCount = 0;
  let totalTricks = 0;
  let totalScore = 0;

  for (let i = 0; i < simulations; i++) {
    // Sample opponent hands
    const scenario = sampleOpponentHands(gameState, hand);

    // Simulate game with this bid
    const outcome = await simulateGameWithBid(scenario, bid);

    if (outcome.tricksTaken >= bid) madeCount++;
    totalTricks += outcome.tricksTaken;
    totalScore += outcome.scoreChange;
  }

  const makeProbability = madeCount / simulations;
  const expectedTricks = totalTricks / simulations;
  const expectedScore = totalScore / simulations;

  return {
    bid,
    makeProbability,
    expectedTricks,
    expectedScore: expectedScore,
    risk: calculateRisk(makeProbability, bid),
    recommendation: calculateRecommendation(expectedScore, makeProbability),
    evComparison: expectedScore - passExpectedValue
  };
}

function calculateRisk(
  makeProbability: number,
  bid: BidAmount
): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  if (bid === 'PASS') return 'LOW';

  if (makeProbability >= 0.8) return 'LOW';
  if (makeProbability >= 0.6) return 'MEDIUM';
  if (makeProbability >= 0.4) return 'HIGH';
  return 'EXTREME';
}
```

**UI Mock:**
```
┌─────────────── Bidding Decision ───────────────┐
│                                                 │
│  Current bid: 2 (by Player 2)                  │
│  Your hand strength: 7.5/10                    │
│                                                 │
│  ┌──────┬─────────┬─────────┬────────┬────────┐ │
│  │ Bid  │ Make %  │Expected │Score Δ │ Rating │ │
│  │      │         │ Tricks  │        │        │ │
│  ├──────┼─────────┼─────────┼────────┼────────┤ │
│  │ PASS │   -     │  -1.5   │  +1.5  │ ⭐⭐   │ │
│  │  3   │  78%    │  3.8    │  -3.2  │ ⭐⭐⭐⭐│ │←
│  │  4   │  45%    │  3.8    │  -0.5  │ ⭐     │ │
│  │  5   │  12%    │  3.8    │  +3.8  │ ☠️     │ │
│  └──────┴─────────┴─────────┴────────┴────────┘ │
│                                                 │
│  💡 Recommendation: Bid 3                       │
│                                                 │
│  Why?                                           │
│  • 78% chance to make it (good odds)           │
│  • Expected to take 3.8 tricks                 │
│  • Best expected value (-3.2 vs +1.5 passing) │
│  • Bidding 4 is too risky (only 45% chance)   │
│                                                 │
│  [Show Detailed Math] [Bid 3] [Pass]           │
└─────────────────────────────────────────────────┘
```

### Feature 3: Post-Hand Review

```typescript
interface MoveReview {
  trickNumber: number;
  actualMove: Card;
  optimalMove: Card;
  actualWinRate: number;
  optimalWinRate: number;
  mistakeCost: number;           // Win rate difference
  severity: 'PERFECT' | 'GOOD' | 'MINOR' | 'MAJOR' | 'BLUNDER';
  learningPoint: string;
}

async function reviewHand(
  gameHistory: GameHistory,
  playerPosition: PlayerPosition
): Promise<{
  moves: MoveReview[];
  overallRating: number;
  summary: string;
}> {
  const reviews: MoveReview[] = [];
  const ismcts = new ISMCTSEngine();

  for (let i = 0; i < gameHistory.playerMoves.length; i++) {
    const move = gameHistory.playerMoves[i];
    const state = gameHistory.stateAtMove[i];

    // Analyze what player did
    const actualAnalysis = await ismcts.analyzeAction(
      state,
      playerPosition,
      move.card,
      { simulations: 500 }
    );

    // Find optimal move
    const allAnalysis = await ismcts.analyzeAllActions(
      state,
      playerPosition,
      { simulations: 2000 }
    );

    const optimal = allAnalysis.actions[0];  // Highest ranked

    reviews.push({
      trickNumber: i + 1,
      actualMove: move.card,
      optimalMove: optimal.action.card,
      actualWinRate: actualAnalysis.winRate,
      optimalWinRate: optimal.winRate,
      mistakeCost: optimal.winRate - actualAnalysis.winRate,
      severity: categorizeMistake(optimal.winRate - actualAnalysis.winRate),
      learningPoint: generateLearningPoint(state, move.card, optimal.action.card)
    });
  }

  const overallRating = calculateRating(reviews);
  const summary = generateSummary(reviews);

  return { moves: reviews, overallRating, summary };
}

function categorizeMistake(winRateDiff: number): Severity {
  if (winRateDiff <= 0.02) return 'PERFECT';
  if (winRateDiff <= 0.05) return 'GOOD';
  if (winRateDiff <= 0.10) return 'MINOR';
  if (winRateDiff <= 0.20) return 'MAJOR';
  return 'BLUNDER';
}
```

**UI Mock:**
```
┌─────────────── Hand Review ────────────────────┐
│                                                 │
│  Overall Rating: 8/10 (Very Good!)             │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Trick 1 - Your lead              ✓      │   │
│  │ You played:     K♥                      │   │
│  │ AI suggests:    A♠  ⭐                  │   │
│  │ Impact:         -8% win rate            │   │
│  │ Severity:       MINOR MISTAKE           │   │
│  │                                         │   │
│  │ 💡 Why A♠ is better:                   │   │
│  │ Leading trump removes opponent trump   │   │
│  │ advantage and you have trump control.  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Trick 2 - Following suit          ✓✓   │   │
│  │ You played:     10♣                     │   │
│  │ AI suggests:    10♣  ✓                  │   │
│  │ Impact:         0% (optimal play!)      │   │
│  │ Severity:       PERFECT                 │   │
│  │                                         │   │
│  │ 💡 Great job!                          │   │
│  │ Playing lowest card correctly dumped   │   │
│  │ when you couldn't win.                 │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Trick 3 - Following trump         ✓✓✓  │   │
│  │ You played:     Right Bower             │   │
│  │ AI suggests:    Right Bower  ✓          │   │
│  │ Impact:         0% (optimal!)           │   │
│  │ Severity:       PERFECT                 │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Summary:                                       │
│  • You played well overall!                    │
│  • One small mistake in trick 1 (-8% win rate)│
│  • Consider leading trump when you have control│
│  • Perfect play in tricks 2-5                  │
│                                                 │
│  [Review Another Hand] [Practice This Scenario]│
└─────────────────────────────────────────────────┘
```

### Feature 4: Adjustable Hint System

```typescript
enum HintLevel {
  NONE = 0,
  BASIC = 1,        // "This looks like a strong play"
  INTERMEDIATE = 2,  // "65% win rate vs 52%"
  ADVANCED = 3,      // Full analysis with reasoning
  OPTIMAL = 4        // Show exact probabilities and math
}

interface Hint {
  level: HintLevel;
  message: string;
  details?: HintDetails;
}

function generateHint(
  analysis: CardAnalysis,
  level: HintLevel
): Hint {
  const best = analysis.actions[0];

  switch (level) {
    case HintLevel.BASIC:
      return {
        level,
        message: `Consider playing ${best.card.rank} of ${best.card.suit}`
      };

    case HintLevel.INTERMEDIATE:
      const second = analysis.actions[1];
      return {
        level,
        message: `${best.card.rank}${best.card.suit} has ${(best.winRate * 100).toFixed(0)}% win rate vs ${second.card.rank}${second.card.suit} at ${(second.winRate * 100).toFixed(0)}%`
      };

    case HintLevel.ADVANCED:
      return {
        level,
        message: `${best.card.rank}${best.card.suit} is optimal`,
        details: {
          winRate: best.winRate,
          expectedTricks: best.avgTricks,
          reasoning: best.reasoning,
          alternatives: analysis.actions.slice(1, 3)
        }
      };

    case HintLevel.OPTIMAL:
      return {
        level,
        message: 'Full analysis available',
        details: {
          fullAnalysis: analysis,
          simulations: analysis.totalSimulations,
          confidence: analysis.explorationComplete
        }
      };

    default:
      return { level: HintLevel.NONE, message: '' };
  }
}
```

**User Settings:**
```typescript
interface TeachingSettings {
  hintLevel: HintLevel;
  showWinProbabilities: boolean;
  showExpectedTricks: boolean;
  highlightBestCard: boolean;
  showPostGameReview: boolean;
  aiThinkingVisible: boolean;
}
```

### Implementation Priority

**Phase 1: Basic Teaching (Week 1)**
- Card win probabilities
- Best card highlighting
- Simple hints

**Phase 2: Advanced Analysis (Week 2)**
- Bid analysis table
- Expected tricks display
- Detailed reasoning

**Phase 3: Review System (Week 3)**
- Post-game review
- Mistake categorization
- Learning points

**Phase 4: Polish (Week 4)**
- Adjustable hint levels
- "What if" simulator
- Practice specific scenarios

---

## AI Research Platform

### Motivation

To develop, test, and compare AI approaches, we need:
- **Fast iteration**: Run thousands of games quickly
- **Statistical validation**: Proper ELO ratings and confidence intervals
- **Reproducibility**: Consistent testing environment
- **Export capability**: Deploy winning AI to production

The production backend is **NOT suitable** for this:
- Too slow (artificial delays, WebSocket overhead, DB writes)
- Wrong abstraction (designed for human play)
- Can't parallelize effectively
- No evaluation metrics

### Architecture

```
┌───────────────────────────────────────────────┐
│           Shared Game Logic                   │
│        @buck-euchre/shared (TS)              │
│    cards.ts, state.ts, validation.ts          │
└──────────────┬────────────────────────────────┘
               │
               ├──────────────┬─────────────────┐
               │              │                 │
         ┌─────▼──────┐ ┌────▼──────┐  ┌──────▼────────┐
         │ Production │ │  Frontend │  │ AI Research   │
         │  Backend   │ │    PWA    │  │   Platform    │
         │            │ │           │  │               │
         │ Real games │ │   UI      │  │ Fast sim      │
         │ Humans +AI │ │ Teaching  │  │ Tournaments   │
         │ WebSocket  │ │ Practice  │  │ Training      │
         └────────────┘ └───────────┘  └───────────────┘
```

### Project Structure

```
ai-research/
├── README.md
├── requirements.txt          # Python dependencies
├── pyproject.toml
│
├── src/
│   ├── simulator/            # Fast game simulation
│   │   ├── __init__.py
│   │   ├── engine.py         # Core game engine
│   │   ├── fast_sim.py       # Optimized simulation
│   │   └── bridge.py         # TS->Python bridge
│   │
│   ├── agents/               # AI implementations
│   │   ├── __init__.py
│   │   ├── base.py           # Base agent interface
│   │   ├── random_agent.py   # Random baseline
│   │   ├── rule_based.py     # Rule-based AI
│   │   ├── pimc.py           # PIMC implementation
│   │   ├── ismcts.py         # ISMCTS implementation
│   │   ├── neural/
│   │   │   ├── __init__.py
│   │   │   ├── network.py    # Neural network architecture
│   │   │   ├── train.py      # Training pipeline
│   │   │   └── mcts_neural.py # Neural + MCTS
│   │   └── export.py         # Export to prod formats
│   │
│   ├── arena/                # Battle management
│   │   ├── __init__.py
│   │   ├── match.py          # Single match runner
│   │   ├── tournament.py     # Tournament system
│   │   ├── parallel.py       # Parallel execution
│   │   └── elo.py            # ELO rating system
│   │
│   ├── evaluation/           # Analysis tools
│   │   ├── __init__.py
│   │   ├── metrics.py        # Win rates, confidence
│   │   ├── visualization.py  # Plots and charts
│   │   └── reports.py        # Generate reports
│   │
│   └── training/             # Neural network training
│       ├── __init__.py
│       ├── self_play.py      # Self-play data generation
│       ├── dataset.py        # Dataset management
│       └── trainer.py        # Training orchestration
│
├── configs/                  # Experiment configurations
│   ├── baseline.yaml
│   ├── ismcts_tuning.yaml
│   └── neural_training.yaml
│
├── experiments/              # Experiment results
│   ├── 2025-11-04_baseline/
│   │   ├── config.yaml
│   │   ├── results.json
│   │   └── plots/
│   └── 2025-11-05_ismcts/
│
├── scripts/                  # Utility scripts
│   ├── run_tournament.py
│   ├── train_neural.py
│   ├── export_to_prod.py
│   ├── visualize_results.py
│   └── compare_agents.py
│
└── tests/
    ├── test_simulator.py
    ├── test_agents.py
    └── test_tournament.py
```

### Core Components

#### 1. Fast Simulator

```python
# ai-research/src/simulator/engine.py
from buck_euchre_shared import GameState, applyAction, initializeGame

class FastSimulator:
    """
    Fast game simulator with no delays or I/O.

    Performance: ~10-50ms per game (vs 80+ seconds in production)
    """

    def play_game(
        self,
        agents: list[Agent],
        seed: int | None = None
    ) -> GameResult:
        """Play a complete game"""

        start_time = time.time()
        state = initializeGame([a.id for a in agents], seed=seed)
        move_count = 0

        while not state['gameOver']:
            # Get current player
            current_pos = self.get_current_player(state)
            current_agent = agents[current_pos]

            # Get action (no delay!)
            action = current_agent.decide(state, current_pos)

            # Validate
            if not is_valid_action(state, action, current_pos):
                raise ValueError(f"Invalid action: {action}")

            # Apply
            state = applyAction(state, action)
            move_count += 1

        elapsed = time.time() - start_time

        return GameResult(
            winner=state['winner'],
            scores=[p['score'] for p in state['players']],
            rounds=state['round'],
            moves=move_count,
            duration_ms=elapsed * 1000
        )
```

**Performance comparison:**

```python
# Production backend (with delays, WebSocket, DB)
# ~80-200 seconds per game
# ~18-45 games/hour
# 230 days for 10,000 games

# Fast simulator
# ~10-50ms per game
# ~72,000-360,000 games/hour
# 2-10 minutes for 10,000 games

# Speed improvement: 10,000x faster!
```

#### 2. Agent Interface

```python
# ai-research/src/agents/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class AnalysisResult:
    """Rich analysis for teaching features"""
    best_action: Action
    action_probabilities: dict[Action, float]
    expected_values: dict[Action, float]
    visit_counts: dict[Action, int]
    reasoning: list[str]

class Agent(ABC):
    """Base interface for all AI agents"""

    def __init__(self, player_id: str, name: str):
        self.player_id = player_id
        self.name = name

    @abstractmethod
    def decide_bid(self, state: GameState, position: int) -> BidAmount:
        """Decide what to bid"""
        pass

    @abstractmethod
    def decide_trump(self, state: GameState, position: int) -> Suit:
        """Declare trump suit"""
        pass

    @abstractmethod
    def decide_fold(self, state: GameState, position: int) -> bool:
        """Decide whether to fold"""
        pass

    @abstractmethod
    def decide_card(self, state: GameState, position: int) -> Card:
        """Choose which card to play"""
        pass

    def decide(self, state: GameState, position: int) -> Action:
        """Main decision entry point (calls appropriate method)"""
        phase = state['phase']

        if phase == 'BIDDING':
            return BidAction(self.decide_bid(state, position))
        elif phase == 'DECLARING_TRUMP':
            return TrumpAction(self.decide_trump(state, position))
        elif phase == 'FOLDING_DECISION':
            return FoldAction(self.decide_fold(state, position))
        elif phase == 'PLAYING':
            return CardAction(self.decide_card(state, position))
        else:
            raise ValueError(f"Unknown phase: {phase}")

    def analyze(
        self,
        state: GameState,
        position: int
    ) -> AnalysisResult:
        """
        Provide detailed analysis for teaching.

        Base implementation just returns best action.
        Override in sophisticated agents (ISMCTS, Neural).
        """
        action = self.decide(state, position)
        return AnalysisResult(
            best_action=action,
            action_probabilities={action: 1.0},
            expected_values={action: 0.0},
            visit_counts={action: 1},
            reasoning=['Rule-based decision']
        )
```

Example implementation:

```python
# ai-research/src/agents/ismcts.py
class ISMCTSAgent(Agent):
    def __init__(
        self,
        player_id: str,
        name: str,
        simulations: int = 2000,
        exploration_constant: float = 1.41
    ):
        super().__init__(player_id, name)
        self.simulations = simulations
        self.c = exploration_constant

    def decide_card(self, state: GameState, position: int) -> Card:
        # Run ISMCTS
        tree = self.run_ismcts(state, position)
        return tree.get_best_action()

    def analyze(self, state: GameState, position: int) -> AnalysisResult:
        # Run ISMCTS and return full statistics
        tree = self.run_ismcts(state, position)

        return AnalysisResult(
            best_action=tree.get_best_action(),
            action_probabilities=tree.get_visit_distribution(),
            expected_values=tree.get_average_values(),
            visit_counts=tree.get_visit_counts(),
            reasoning=tree.get_reasoning()
        )
```

#### 3. Tournament System

```python
# ai-research/src/arena/tournament.py
from itertools import combinations
import multiprocessing as mp

class Tournament:
    def __init__(
        self,
        agents: list[Agent],
        games_per_matchup: int = 1000,
        parallel: int = 8
    ):
        self.agents = agents
        self.games_per_matchup = games_per_matchup
        self.parallel = parallel
        self.simulator = FastSimulator()

    def run_round_robin(self) -> TournamentResults:
        """
        Run round-robin tournament.

        Each combination of 4 agents plays games_per_matchup games
        with different seat positions.
        """

        print(f"Running tournament with {len(self.agents)} agents")
        print(f"{self.games_per_matchup} games per matchup")
        print(f"Using {self.parallel} parallel workers")

        matchups = list(combinations(self.agents, 4))
        print(f"Total matchups: {len(matchups)}")

        all_results = []

        with mp.Pool(self.parallel) as pool:
            for matchup in tqdm(matchups, desc="Matchups"):
                # Run games for this matchup in parallel
                results = pool.map(
                    self._play_game,
                    [(matchup, i) for i in range(self.games_per_matchup)]
                )
                all_results.extend(results)

        return self.compute_statistics(all_results)

    def _play_game(self, args):
        matchup, seed = args
        return self.simulator.play_game(matchup, seed=seed)

    def compute_statistics(self, results: list[GameResult]) -> TournamentResults:
        """Compute ELO ratings and win rates"""

        # Count wins per agent
        win_counts = defaultdict(int)
        game_counts = defaultdict(int)

        for result in results:
            for i, agent in enumerate(self.agents):
                if result.winner == i:
                    win_counts[agent.name] += 1
                game_counts[agent.name] += 1

        # Compute ELO ratings
        elo_ratings = self.compute_elo(results)

        # Compute confidence intervals
        confidence_intervals = self.compute_confidence_intervals(
            win_counts,
            game_counts
        )

        return TournamentResults(
            agents=self.agents,
            elo_ratings=elo_ratings,
            win_counts=win_counts,
            game_counts=game_counts,
            confidence_intervals=confidence_intervals,
            all_results=results
        )

    def compute_elo(
        self,
        results: list[GameResult],
        initial_elo: float = 1500,
        k_factor: float = 32
    ) -> dict[str, float]:
        """Compute ELO ratings from game results"""

        elo = {agent.name: initial_elo for agent in self.agents}

        for result in results:
            # Update ELO for all players
            for i, agent_i in enumerate(self.agents):
                for j, agent_j in enumerate(self.agents):
                    if i == j:
                        continue

                    # Expected score
                    expected = 1 / (1 + 10 ** ((elo[agent_j.name] - elo[agent_i.name]) / 400))

                    # Actual score (1 if i won, 0 if j won, 0.5 otherwise)
                    if result.winner == i:
                        actual = 1.0
                    elif result.winner == j:
                        actual = 0.0
                    else:
                        actual = 0.5

                    # Update
                    elo[agent_i.name] += k_factor * (actual - expected)

        return elo
```

**Example usage:**

```python
# scripts/run_tournament.py
from src.agents import RuleBasedAgent, PIMCAgent, ISMCTSAgent
from src.arena import Tournament

# Create agents
agents = [
    RuleBasedAgent("agent1", "Rule-Based"),
    PIMCAgent("agent2", "PIMC-100", simulations=100),
    PIMCAgent("agent3", "PIMC-500", simulations=500),
    ISMCTSAgent("agent4", "ISMCTS-1000", simulations=1000),
    ISMCTSAgent("agent5", "ISMCTS-2000", simulations=2000),
]

# Run tournament
tournament = Tournament(
    agents=agents,
    games_per_matchup=1000,
    parallel=8
)

results = tournament.run_round_robin()

# Print results
results.print_summary()

# Save results
results.save('experiments/2025-11-04_baseline/')
```

**Example output:**

```
Tournament Results (10,000 games):
┌────────────────┬──────┬──────────┬────────────┐
│ Agent          │ ELO  │ Win Rate │ Confidence │
├────────────────┼──────┼──────────┼────────────┤
│ ISMCTS-2000    │ 1847 │  34.2%   │  ±1.2%     │
│ ISMCTS-1000    │ 1756 │  28.5%   │  ±1.1%     │
│ PIMC-500       │ 1621 │  21.8%   │  ±1.0%     │
│ PIMC-100       │ 1512 │  16.3%   │  ±0.9%     │
│ Rule-Based     │ 1401 │  15.5%   │  ±0.9%     │
└────────────────┴──────┴──────────┴────────────┘

Statistical Significance Tests:
ISMCTS-2000 > ISMCTS-1000: p < 0.001 ✅ (highly significant)
ISMCTS-1000 > PIMC-500:    p < 0.001 ✅ (highly significant)
PIMC-500 > PIMC-100:       p < 0.01  ✅ (significant)
PIMC-100 > Rule-Based:     p < 0.05  ✅ (significant)

Key Findings:
• More ISMCTS simulations significantly improves play
• ISMCTS clearly outperforms PIMC
• PIMC beats rule-based AI
• 2000 simulations appears to have diminishing returns vs 1000
```

#### 4. Export to Production

```python
# ai-research/src/agents/export.py
import json
import tensorflowjs as tfjs

class AgentExporter:
    def export_to_typescript(
        self,
        agent: Agent,
        output_path: str,
        format: str = 'tfjs'
    ):
        """
        Export agent for use in production PWA.

        Supports:
        - Rule-based: Generate TypeScript code
        - ISMCTS: Generate TypeScript implementation
        - Neural: Export to TensorFlow.js
        """

        if isinstance(agent, RuleBasedAgent):
            self._export_rules_to_ts(agent, output_path)

        elif isinstance(agent, ISMCTSAgent):
            self._export_ismcts_to_ts(agent, output_path)

        elif isinstance(agent, NeuralAgent):
            if format == 'tfjs':
                self._export_neural_to_tfjs(agent, output_path)
            elif format == 'coreml':
                self._export_neural_to_coreml(agent, output_path)
            else:
                raise ValueError(f"Unknown format: {format}")

        print(f"Agent exported to {output_path}")

    def _export_neural_to_tfjs(self, agent: NeuralAgent, path: str):
        """Export PyTorch model to TensorFlow.js"""

        # Convert PyTorch to ONNX
        import torch
        dummy_input = torch.randn(1, agent.model.input_size)
        torch.onnx.export(
            agent.model,
            dummy_input,
            f"{path}/model.onnx"
        )

        # Convert ONNX to TensorFlow
        import onnx
        from onnx_tf.backend import prepare

        onnx_model = onnx.load(f"{path}/model.onnx")
        tf_rep = prepare(onnx_model)
        tf_rep.export_graph(f"{path}/model_tf")

        # Convert TensorFlow to TensorFlow.js
        tfjs.converters.convert_tf_saved_model(
            f"{path}/model_tf",
            path,
            quantization_bytes=2  # Quantize to reduce size
        )

        # Generate TypeScript wrapper
        self._generate_neural_wrapper(agent, path)

    def _generate_neural_wrapper(self, agent: NeuralAgent, path: str):
        """Generate TypeScript wrapper code"""

        wrapper_code = f"""
// Auto-generated by AI Research Platform
import * as tf from '@tensorflow/tfjs';

export class {agent.name}Agent {{
  private model: tf.GraphModel | null = null;

  async loadModel() {{
    this.model = await tf.loadGraphModel('./models/{agent.name}/model.json');
    console.log('Model loaded: {agent.name}');
  }}

  async evaluate(gameState: GameState): Promise<{{
    policy: Map<Action, number>;
    value: number;
  }}> {{
    // Encode state
    const stateTensor = this.encodeState(gameState);

    // Run inference
    const [policyTensor, valueTensor] = this.model!.predict(stateTensor);

    // Decode outputs
    const policy = await this.decodePolicy(policyTensor, gameState);
    const value = (await valueTensor.data())[0];

    return {{ policy, value }};
  }}

  // ... (encoding/decoding methods)
}}
"""

        with open(f"{path}/{agent.name}Agent.ts", 'w') as f:
            f.write(wrapper_code)
```

**Workflow:**

```bash
# 1. Train a neural network in research platform
cd ai-research
python scripts/train_neural.py --config configs/alpha_net_v1.yaml

# Output: Trained model saved to experiments/alpha_net_v1/

# 2. Run tournament to validate
python scripts/run_tournament.py \
  --agents rule-based,ismcts-1000,alpha_net_v1 \
  --games 10000

# Output: alpha_net_v1 wins with ELO 1875

# 3. Export to production
python scripts/export_to_prod.py \
  --agent alpha_net_v1 \
  --format tfjs \
  --target ../frontend/src/ai/models/alpha_net_v1

# Output: Model exported to frontend/src/ai/models/alpha_net_v1/

# 4. Use in production PWA
# Edit frontend/src/ai/index.ts to load new model
```

### Benefits of This Architecture

1. **10,000x faster experimentation**
   - 10,000 games in minutes vs months
   - Rapid iteration on AI approaches
   - Statistical validation

2. **Single source of truth**
   - Shared game rules
   - Consistency between research and production
   - No rule duplication

3. **Professional workflow**
   - Version control for experiments
   - Reproducible results
   - Clear export path to production

4. **Continuous improvement**
   - Keep training new AIs
   - Always battle test before deployment
   - Track ELO over time

5. **Research potential**
   - Publish papers on Buck Euchre AI
   - Community competitions
   - Open source research platform

---

## Implementation Roadmap

### Overview

Incremental delivery with value at each stage.

**Total timeline: 8-12 weeks**

### Phase 1: Foundation (Week 1-2)

**Goal:** Refactor shared code, improve server AI

**Tasks:**
1. Move game logic to `shared/src/game/`
2. Update backend imports
3. Update frontend imports
4. Verify all tests pass
5. Improve rule-based AI (card counting, better heuristics)
6. Implement difficulty levels (easy/medium/hard)

**Deliverables:**
- ✅ Shared game logic package
- ✅ Better server AI (all difficulty levels)
- ✅ No breaking changes

**Effort:** 5-10 days

**Technical details:**

```bash
# Create shared package structure
mkdir -p shared/src/game
mkdir -p shared/src/types
mkdir -p shared/src/utils

# Move files
mv backend/src/game/*.ts shared/src/game/
mv backend/src/types/game.ts shared/src/types/
mv backend/src/utils/cards.ts shared/src/utils/

# Update package.json
# shared/package.json
{
  "name": "@buck-euchre/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}

# Update backend imports
# Before: import { applyAction } from './game/state';
# After:  import { applyAction } from '@buck-euchre/shared';
```

**Rule-based AI improvements:**

```typescript
// backend/src/ai/decision-engine-v2.ts

class EnhancedRuleBasedAI {
  private cardTracker: CardTracker;

  constructor() {
    this.cardTracker = new CardTracker();
  }

  decideBid(hand: Card[], turnUpCard: Card, currentBid: number | null): BidAmount {
    // Much better hand evaluation
    const strength = this.evaluateHand(hand, turnUpCard.suit);

    if (strength.score >= 8) return 5;
    if (strength.score >= 7) return 4;
    if (strength.score >= 6) return 3;
    if (strength.score >= 5 && currentBid === null) return 2;
    return 'PASS';
  }

  decideCard(gameState: GameState, position: PlayerPosition): Card {
    // Track what's been played
    this.cardTracker.update(gameState);

    const legal = getLegalCards(hand, currentTrick, trumpSuit);

    // Much smarter play selection
    if (isLeading(currentTrick)) {
      return this.selectLeadCard(legal, gameState);
    } else {
      return this.selectFollowCard(legal, gameState);
    }
  }

  private evaluateHand(hand: Card[], trumpSuit: Suit): HandStrength {
    let score = 0;

    // Trump strength
    const trumps = hand.filter(c => getEffectiveSuit(c, trumpSuit) === trumpSuit);
    score += trumps.length * 2;

    // High trump bonuses
    if (hasRightBower(trumps, trumpSuit)) score += 5;
    if (hasLeftBower(trumps, trumpSuit)) score += 4;
    if (hasAce(trumps, trumpSuit)) score += 3;

    // Control cards in side suits
    for (const suit of getSuits().filter(s => s !== trumpSuit)) {
      const suitCards = hand.filter(c => c.suit === suit);
      if (hasAce(suitCards)) score += 2;
      if (suitCards.length === 0) score += 1.5; // Void
    }

    return { score, trumps: trumps.length };
  }
}
```

### Phase 2: AI Research Platform (Week 3-4)

**Goal:** Build infrastructure for AI experimentation

**Tasks:**
1. Create `ai-research/` project
2. Implement fast simulator
3. Create agent interface
4. Port rule-based AI to Python
5. Implement tournament system
6. Run baseline experiments

**Deliverables:**
- ✅ AI research platform
- ✅ Fast simulator (10,000 games in minutes)
- ✅ Tournament system with ELO ratings
- ✅ Baseline results (rule-based AI benchmarks)

**Effort:** 10-14 days

**Key files to create:**

```python
# ai-research/src/simulator/engine.py
class FastSimulator:
    def play_game(self, agents: list[Agent]) -> GameResult:
        # ~10-50ms per game
        pass

# ai-research/src/agents/base.py
class Agent(ABC):
    @abstractmethod
    def decide(self, state, position) -> Action:
        pass

# ai-research/src/arena/tournament.py
class Tournament:
    def run_round_robin(self, agents, games=1000) -> Results:
        # Parallel execution
        pass
```

**Validation:**

```bash
# Should complete in ~2-10 minutes
python scripts/run_tournament.py \
  --agents random,rule-based \
  --games 10000 \
  --parallel 8

# Expected output:
# - Rule-based beats random with >95% confidence
# - ELO difference: ~400 points
```

### Phase 3: ISMCTS Implementation (Week 5-6)

**Goal:** Implement strong AI using ISMCTS

**Tasks:**
1. Implement PIMC in Python (research platform)
2. Implement ISMCTS in Python (research platform)
3. Run tournaments to tune simulation counts
4. Port ISMCTS to TypeScript (for PWA)
5. Integrate with practice mode

**Deliverables:**
- ✅ PIMC agent (baseline)
- ✅ ISMCTS agent (strong play)
- ✅ TypeScript implementation for PWA
- ✅ Practice mode with offline AI

**Effort:** 10-14 days

**Implementation milestones:**

Week 5:
- Day 1-2: PIMC in Python
- Day 3-5: ISMCTS in Python
- Day 5-7: Tournament and tuning

Week 6:
- Day 1-3: TypeScript port
- Day 4-5: Practice mode UI
- Day 6-7: Testing and polish

**Expected performance:**

```
Tournament Results (10,000 games):
┌──────────────┬──────┬──────────┐
│ Agent        │ ELO  │ Win Rate │
├──────────────┼──────┼──────────┤
│ ISMCTS-2000  │ 1756 │  32.5%   │
│ ISMCTS-1000  │ 1689 │  29.2%   │
│ PIMC-500     │ 1621 │  24.8%   │
│ PIMC-200     │ 1568 │  21.1%   │
│ Rule-Based   │ 1401 │  15.5%   │
│ Random       │  986 │   0.0%   │
└──────────────┴──────┴──────────┘
```

**PWA integration:**

```typescript
// frontend/src/ai/ismcts/engine.ts
export class ISMCTSEngine {
  async decide(
    gameState: GameState,
    myPosition: PlayerPosition,
    simulations: number = 2000
  ): Promise<Action> {
    // Run in Web Worker to avoid blocking UI
    return await this.worker.run({ gameState, myPosition, simulations });
  }
}

// frontend/src/game/practice-mode.ts
class PracticeGame {
  private ai: ISMCTSEngine;

  constructor(difficulty: 'easy' | 'medium' | 'hard') {
    const sims = difficulty === 'easy' ? 200 : difficulty === 'medium' ? 1000 : 2000;
    this.ai = new ISMCTSEngine(sims);
  }
}
```

### Phase 4: Teaching Features (Week 7-8)

**Goal:** Add analysis and teaching capabilities

**Tasks:**
1. Implement analysis mode in ISMCTS
2. Build card analysis overlay
3. Build bid analysis table
4. Implement post-game review
5. Add hint system
6. Polish UI/UX

**Deliverables:**
- ✅ Real-time card analysis with probabilities
- ✅ Bidding probability table
- ✅ Post-game review with mistakes
- ✅ Adjustable hint system

**Effort:** 10-14 days

**UI components to build:**

```typescript
// frontend/src/components/teaching/CardAnalysisOverlay.tsx
export function CardAnalysisOverlay({ gameState, onCardSelect }) {
  const [analysis, setAnalysis] = useState<CardAnalysis[]>([]);

  useEffect(() => {
    // Run analysis in background
    analyzeCurrentPosition(gameState).then(setAnalysis);
  }, [gameState]);

  return (
    <div className="card-analysis">
      {analysis.map(a => (
        <CardWithStats
          card={a.card}
          winRate={a.winProbability}
          expectedTricks={a.expectedTricks}
          ranking={a.ranking}
          reasoning={a.reasoning}
          onSelect={onCardSelect}
        />
      ))}
    </div>
  );
}

// frontend/src/components/teaching/BidAnalysisTable.tsx
export function BidAnalysisTable({ hand, turnUpCard }) {
  const analysis = useBidAnalysis(hand, turnUpCard);

  return (
    <table className="bid-analysis">
      <thead>
        <tr>
          <th>Bid</th>
          <th>Make %</th>
          <th>Expected Tricks</th>
          <th>Score Δ</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        {analysis.map(a => (
          <BidRow key={a.bid} analysis={a} />
        ))}
      </tbody>
    </table>
  );
}
```

### Phase 5: Neural Network (Week 9-12) [Optional]

**Goal:** Train and deploy neural network for ultimate AI strength

**Tasks:**
1. Design network architecture
2. Generate training data (self-play)
3. Train supervised model
4. Train with reinforcement learning
5. Export to TensorFlow.js
6. Integrate with PWA
7. Battle test vs ISMCTS

**Deliverables:**
- ✅ Trained policy-value network
- ✅ TensorFlow.js model for PWA
- ✅ Neural + MCTS hybrid
- ✅ Expert difficulty level

**Effort:** 15-20 days

**Training pipeline:**

```python
# Week 9: Data generation
python scripts/generate_training_data.py \
  --agent ismcts-2000 \
  --games 50000 \
  --output data/self_play_v1.pkl

# Week 10: Supervised training
python scripts/train_neural.py \
  --data data/self_play_v1.pkl \
  --epochs 100 \
  --output models/supervised_v1.pt

# Week 11: Reinforcement learning
python scripts/train_rl.py \
  --initial-model models/supervised_v1.pt \
  --iterations 10 \
  --games-per-iter 5000 \
  --output models/rl_v1.pt

# Week 12: Export and integrate
python scripts/export_to_prod.py \
  --model models/rl_v1.pt \
  --format tfjs \
  --target ../frontend/src/ai/models/rl_v1
```

**Expected results:**

```
Final Tournament (20,000 games):
┌──────────────────┬──────┬──────────┐
│ Agent            │ ELO  │ Win Rate │
├──────────────────┼──────┼──────────┤
│ Neural+MCTS-1000 │ 1912 │  38.2%   │
│ ISMCTS-2000      │ 1756 │  28.5%   │
│ PIMC-500         │ 1621 │  18.8%   │
│ Rule-Based       │ 1401 │  12.5%   │
│ Random           │  986 │   2.0%   │
└──────────────────┴──────┴──────────┘

Improvement: Neural+MCTS gains ~150 ELO over pure ISMCTS
```

### Timeline Summary

```
Week 1-2:   Foundation & Shared Code         ████████░░░░░░░░░░░░
Week 3-4:   AI Research Platform             ░░░░░░░░████████░░░░
Week 5-6:   ISMCTS Implementation            ░░░░░░░░░░░░░░░░████
Week 7-8:   Teaching Features                ░░░░░░░░░░░░░░░░░░░░████
Week 9-12:  Neural Network (Optional)        ░░░░░░░░░░░░░░░░░░░░░░░░████████

Minimum viable: 8 weeks (through teaching features)
Full implementation: 12 weeks (including neural network)
```

### Risk Mitigation

**Risks:**

1. **ISMCTS slower than expected on weak devices**
   - Mitigation: Adjustable simulation counts, start with fewer sims
   - Fallback: Keep rule-based for easy/medium

2. **Neural network training doesn't improve over ISMCTS**
   - Mitigation: Start with supervised learning from ISMCTS games
   - Fallback: Ship ISMCTS-only, neural is optional enhancement

3. **Teaching features too slow**
   - Mitigation: Cache analysis, progressive computation
   - Fallback: Make teaching opt-in, disable on slow devices

4. **Shared code refactor breaks production**
   - Mitigation: Comprehensive test suite, gradual migration
   - Fallback: Keep both copies temporarily

### Success Metrics

**Week 2:**
- ✅ All tests pass with shared code
- ✅ Server AI beats previous version in blind tests

**Week 4:**
- ✅ 10,000 game tournament completes in <10 minutes
- ✅ Rule-based AI has statistically significant ELO

**Week 6:**
- ✅ ISMCTS beats rule-based with p < 0.001
- ✅ Practice mode works offline on iPhone 16 Pro Max
- ✅ 2000 simulations complete in <500ms on device

**Week 8:**
- ✅ Users can see win probabilities for all cards
- ✅ Bid analysis shows make percentages
- ✅ Post-game review highlights mistakes

**Week 12 (if doing neural):**
- ✅ Neural network beats ISMCTS with p < 0.01
- ✅ Model loads and runs in PWA (<50ms inference)
- ✅ ELO improvement of 100+ points

---

## Technical Specifications

### Performance Requirements

**Server (Multiplayer):**
- Decision time: <500ms (target <200ms)
- Memory per game: <20MB
- Concurrent games: 10+
- Server: 2GB RAM, 2 CPU cores @ 20%

**Client (Practice Mode):**
- Decision time: <1000ms (target <500ms)
- Memory: <100MB for AI
- Works on: iPhone 12+, modern Android, desktop
- Offline capability: Full game + AI

**AI Research Platform:**
- Game simulation: <50ms per game
- 10,000 games: <10 minutes
- Parallelization: 8+ cores
- Training: RTX 3070 (8GB VRAM)

### Bundle Sizes

**Production PWA:**
```
Core app:                 ~500 KB gzipped
Shared game logic:        ~100 KB
Rule-based AI:            ~50 KB
ISMCTS AI:                ~200 KB
TensorFlow.js (optional): ~500 KB
Neural model (optional):  ~30-80 MB (cached in IndexedDB)
----------------------------------------------
Total without neural:     ~850 KB ✅
Total with neural:        ~1.4 MB + model cache ✅
```

**Server:**
```
Node.js runtime:          ~50 MB
Application code:         ~10 MB
Dependencies:            ~100 MB
AI logic:                 ~5 MB
Per-game state:           ~10-20 MB
----------------------------------------------
Total:                    ~165 MB + (games * 15MB) ✅
```

### Browser Compatibility

**Required Features:**
- ✅ ES2020+ (modern JavaScript)
- ✅ WebAssembly (for potential optimization)
- ✅ Web Workers (for background AI)
- ✅ IndexedDB (for offline storage)
- ✅ Service Workers (for PWA offline)

**Optional Features:**
- ⚠️ WebGL (for TensorFlow.js acceleration)
- ⚠️ WebGPU (for future ML optimization)

**Target Browsers:**
- Safari 14+ (iOS 14+)
- Chrome 90+
- Firefox 88+
- Edge 90+

### Data Formats

**Game State (shared):**
```typescript
interface GameState {
  gameId: string;
  phase: GamePhase;
  players: [Player, Player, Player, Player];
  round: number;
  dealerPosition: 0 | 1 | 2 | 3;
  blind: Card[];
  turnUpCard: Card | null;
  bids: Bid[];
  trumpSuit: Suit | null;
  currentTrick: Trick;
  tricks: Trick[];
  // ... etc
}
```

**AI Analysis Output:**
```typescript
interface AnalysisResult {
  actions: Array<{
    action: Action;
    visits: number;
    winRate: number;
    avgTricks: number;
    avgScore: number;
    confidence: number;
    reasoning: string[];
  }>;
  totalSimulations: number;
  bestAction: Action;
  alternatives: Action[];
}
```

**Neural Network Input:**
```python
# State encoding: 75-dimensional vector
features = [
  # My hand (24 binary)
  *one_hot_cards(my_hand),

  # Cards played (24 binary)
  *one_hot_cards(played_cards),

  # Trump suit (4 one-hot)
  *one_hot_suit(trump_suit),

  # Position (4 one-hot)
  *one_hot_position(my_position),

  # Scores (4 floats, normalized)
  *normalize_scores(scores),

  # Phase (5 one-hot)
  *one_hot_phase(phase),

  # Bid info (~10 floats)
  highest_bid / 5,
  i_am_bidder,
  # ... etc
]
```

### API Specifications

**Practice Mode (Local):**
```typescript
// No server API - all local
class PracticeGame {
  async makeMove(action: Action): Promise<void>;
  async getAIAnalysis(): Promise<AnalysisResult>;
  async getHint(level: HintLevel): Promise<Hint>;
  async reviewGame(): Promise<GameReview>;
}
```

**Multiplayer (Server):**
```typescript
// Existing WebSocket API - no changes needed
socket.on('GAME_STATE_UPDATE', (data) => { ... });
socket.emit('GAME_ACTION', { action });
```

**AI Research Platform:**
```python
# Python API
class Tournament:
    def run_round_robin(
        agents: list[Agent],
        games: int,
        parallel: int
    ) -> TournamentResults

class Agent:
    def decide(state: dict, position: int) -> Action
    def analyze(state: dict, position: int) -> AnalysisResult
```

---

## Performance Benchmarks

### AI Decision Speed

Based on expected performance on target hardware:

**iPhone 16 Pro Max (A18 Pro):**
```
Rule-based AI:              <5ms       ✅✅✅
PIMC (200 sims):            50ms       ✅✅✅
ISMCTS (1000 sims):         180ms      ✅✅
ISMCTS (2000 sims):         250ms      ✅✅
ISMCTS (5000 sims):         600ms      ✅
Neural inference (TF.js):   10-20ms    ✅✅✅
Neural + MCTS (1000 sims):  300ms      ✅✅
```

**AWS Lightsail $12/month (2GB RAM, 2 vCPU @ 20%):**
```
Rule-based AI:              <5ms       ✅✅✅
PIMC (100 sims):            100ms      ✅✅
ISMCTS (300 sims):          200ms      ✅
ISMCTS (1000 sims):         600ms      ⚠️
Neural inference:           N/A        ❌ (can't fit in 2GB)
```

**Desktop (MacBook Pro M1):**
```
Rule-based AI:              <2ms       ✅✅✅
PIMC (500 sims):            40ms       ✅✅✅
ISMCTS (2000 sims):         120ms      ✅✅✅
ISMCTS (5000 sims):         280ms      ✅✅
Neural inference (TF.js):   5-10ms     ✅✅✅
Neural + MCTS (2000 sims):  180ms      ✅✅✅
```

**RTX 3070 (Training):**
```
Neural training (supervised):   4-8 hours
Neural training (RL, 10 iter):  20-40 hours
Self-play game generation:      10,000 games in 5-10 mins
Tournament (10k games):         2-5 minutes (8 parallel)
```

### Memory Usage

**Per-game memory:**
```
Game state:                 ~10 KB
Rule-based AI:              ~1 MB (logic)
PIMC AI:                    ~10 MB (simulation trees)
ISMCTS AI:                  ~20 MB (search tree)
Neural model (loaded):      ~50-80 MB (shared across games)
Neural + MCTS:              ~70-100 MB
```

**Total memory budget:**
```
iPhone 16 Pro Max (8GB RAM):
  System:                   ~2 GB
  Browser:                  ~1 GB
  App:                      ~500 MB
  AI (practice mode):       ~100 MB
  Headroom:                 ~4.4 GB ✅✅✅

AWS Lightsail (2GB RAM):
  System:                   ~500 MB
  Node.js:                  ~200 MB
  App:                      ~300 MB
  10 concurrent games:      ~200 MB (20MB each)
  Headroom:                 ~800 MB ✅
```

### Network Usage

**Multiplayer (current):**
```
Game state updates:         ~5 KB per update
Updates per game:           ~50-100 updates
Total per game:             ~250-500 KB ✅

WebSocket overhead:         ~1 KB/s keepalive
Total bandwidth:            ~50-100 KB/s per active game ✅
```

**Practice Mode:**
```
Initial PWA download:       ~850 KB (without neural)
                           ~1.4 MB (with neural, code only)
Neural model (one-time):    ~30-80 MB (cached)
Offline usage:              0 KB ✅✅✅
```

### Battery Impact

**Practice Mode AI (1 hour of play):**
```
Rule-based:                 <1% battery ✅✅✅
ISMCTS (2000 sims):         ~5-8% battery ✅
Neural + MCTS:              ~8-12% battery ✅
```

Comparable to:
- Web browsing: ~5-10%/hour
- Video streaming: ~15-20%/hour
- Mobile games: ~10-20%/hour

---

## References & Further Reading

### Imperfect Information Game AI

**Papers:**
- "Monte Carlo Tree Search in Imperfect Information Games" (Cowling et al., 2012)
- "Information Set Monte Carlo Tree Search" (Cowling et al., 2012)
- "Solving Imperfect Information Games Using Decomposition" (Brown & Sandholm, 2014)
- "Superhuman AI for multiplayer poker" - Pluribus (Brown & Sandholm, 2019)
- "DeepStack: Expert-level artificial intelligence in heads-up no-limit poker" (Moravčík et al., 2017)

**Relevant Games:**
- Skat (uses ISMCTS successfully)
- Hearts (PIMC and ISMCTS)
- Bridge (GIB uses Monte Carlo sampling)
- Poker (CFR and deep learning)

### AlphaZero-Style Approaches

**Papers:**
- "Mastering the game of Go with deep neural networks and tree search" - AlphaGo (Silver et al., 2016)
- "Mastering the game of Go without human knowledge" - AlphaGo Zero (Silver et al., 2017)
- "A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play" - AlphaZero (Silver et al., 2018)
- "Mastering Atari, Go, chess and shogi by planning with a learned model" - MuZero (Schrittwieser et al., 2020)

### Counterfactual Regret Minimization

**Papers:**
- "Regret Minimization in Games with Incomplete Information" (Zinkevich et al., 2007)
- "Monte Carlo Sampling for Regret Minimization in Extensive Games" (Lanctot et al., 2009)
- "Deep Counterfactual Regret Minimization" (Brown et al., 2019)

### Implementation Resources

**MCTS:**
- http://mcts.ai/ - MCTS survey and resources
- https://github.com/topics/mcts - Open source implementations

**Neural Networks for Game AI:**
- https://www.tensorflow.org/js - TensorFlow.js documentation
- https://pytorch.org/ - PyTorch documentation
- https://github.com/AppliedDataSciencePartners/DeepReinforcementLearning - AlphaZero implementation

**ELO Rating Systems:**
- "The Elo Rating System" (Wikipedia)
- "Elo Rating System for Multiplayer Games" (Herbrich et al., 2006)

### Tools and Frameworks

**ML Frameworks:**
- PyTorch (training)
- TensorFlow.js (inference in browser)
- ONNX (model conversion)
- Core ML (iOS native inference)

**Parallel Computing:**
- Python multiprocessing
- Joblib
- Ray (distributed computing)

**Visualization:**
- Matplotlib (Python plots)
- Plotly (interactive charts)
- D3.js (web visualizations)

---

## Appendix: Code Samples

See implementation in:
- `/backend/src/ai/` - Current AI implementation
- `/shared/src/game/` - Shared game logic (to be created)
- `/frontend/src/ai/` - Client-side AI (to be created)
- `/ai-research/` - AI research platform (to be created)

---

## Document History

- **v1.0** (2025-11-04): Initial comprehensive strategy document
  - Current state analysis
  - AI approaches overview
  - Architecture recommendations
  - Teaching features design
  - Research platform architecture
  - Implementation roadmap
  - Performance benchmarks

---

**Next Steps:**

1. Review and approve this strategy
2. Decide on scope (minimum 8 weeks vs full 12 weeks)
3. Begin Phase 1: Foundation & Shared Code
4. Set up AI research platform
5. Start experimenting with ISMCTS

**Questions or feedback?** This is a living document and should be updated as we learn from implementation.
