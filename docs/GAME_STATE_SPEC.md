# Game State Specification

## Overview

This document defines the complete game state structure, state transitions, and all valid actions for Buck Euchre. This serves as the contract for both frontend and backend implementation.

## Core Data Types

### Card
```typescript
interface Card {
  suit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
  rank: '9' | '10' | 'JACK' | 'QUEEN' | 'KING' | 'ACE';
  id: string; // Unique identifier: e.g., "SPADES_ACE"
}
```

### Player
```typescript
interface Player {
  id: string;              // Unique player identifier
  name: string;            // Display name
  position: 0 | 1 | 2 | 3; // Seat position (0 = dealer for first hand)
  score: number;           // Current score (starts at 15, race to 0)
  connected: boolean;      // Connection status
  hand: Card[];           // Cards in player's hand (5 cards)
  tricksTaken: number;    // Tricks won this round
  folded: boolean;        // Whether player folded this round
}
```

### Trick
```typescript
interface Trick {
  number: number;         // Trick number (1-5)
  leadPlayerPosition: number; // Who led this trick
  cards: PlayedCard[];    // Cards played in this trick
  winner: number | null;  // Position of winner (null if incomplete)
}

interface PlayedCard {
  card: Card;
  playerPosition: number;
}
```

### Bid
```typescript
interface Bid {
  playerPosition: number;
  amount: 'PASS' | 2 | 3 | 4 | 5;
}
```

## Complete Game State

```typescript
interface GameState {
  // Game Metadata
  gameId: string;
  phase: GamePhase;
  createdAt: number;      // Unix timestamp
  updatedAt: number;      // Unix timestamp
  
  // Players
  players: Player[];      // Always 4 players, positions 0-3
  
  // Round State
  round: number;          // Current round number (starts at 1)
  dealerPosition: number; // Current dealer (0-3)
  
  // Blind/Kitty State (for information only - not used in play)
  blind: Card[];          // 4 cards in the blind (turnUpCard is blind[0])
  turnUpCard: Card | null; // Same as blind[0], revealed face-up (for info only)
  isClubsTurnUp: boolean; // If turnUpCard is a Club (no folding allowed)
  
  // Bidding State
  bids: Bid[];            // All bids made this round
  currentBidder: number | null;  // Position of player whose turn to bid
  highestBid: number | null;     // Current highest bid (2-5)
  winningBidderPosition: number | null; // Who won the bidding
  trumpSuit: Card['suit'] | null;       // Declared trump suit
  
  // Playing State
  tricks: Trick[];        // All tricks this round (max 5)
  currentTrick: Trick;    // Trick currently being played
  currentPlayerPosition: number | null; // Whose turn to play
  
  // Game End State
  winner: number | null;  // Position of player who reached 0 or below
  gameOver: boolean;
}

type GamePhase = 
  | 'WAITING_FOR_PLAYERS'  // Less than 4 players
  | 'DEALING'              // Cards being dealt
  | 'TRUMP_REVEAL'         // Revealing top card of blind
  | 'BIDDING'              // Bidding phase
  | 'DECLARING_TRUMP'      // Winning bidder declares trump
  | 'FOLDING_DECISION'     // Non-bidders decide to fold or stay
  | 'PLAYING'              // Playing tricks
  | 'ROUND_OVER'           // Scoring and showing results
  | 'GAME_OVER';           // Someone reached 0 or below
```

## State Transitions

### Game Initialization
```
Initial State:
  phase: WAITING_FOR_PLAYERS
  players: []
  round: 0
  dealerPosition: randomly chosen
  gameOver: false

Transition: Player joins
  Action: ADD_PLAYER
  Validation: players.length < 4
  Result: Add player to players array
  Next Phase: If players.length == 4 → DEALING

Transition: Player leaves
  Action: REMOVE_PLAYER
  Result: Remove player, set phase back to WAITING_FOR_PLAYERS
```

### Dealing Phase
```
Entry Condition: players.length == 4

Actions:
  1. Increment round number
  2. Clear previous round state (bids, tricks, hands, tricksTaken, folded)
  3. Reset all players.folded to false
  4. Shuffle deck
  5. Deal 5 cards to each player
  6. Put remaining 4 cards in blind array
  7. Set turnUpCard = blind[0] (reference to the top card)
  8. Set isClubsTurnUp = (turnUpCard.suit === 'CLUBS')
  
Note: The 4 blind cards (including the turned-up card) are never played or 
      added to anyone's hand. They remain set aside. The turnUpCard is visible 
      to all players for information purposes only.
  
Next Phase: BIDDING
```

### Bidding Phase
```
Entry Condition: All players have 5 cards, turnUpCard revealed

State Tracking:
  - currentBidder: starts at (dealerPosition + 1) % 4, rotates clockwise
  - bids: array of all bids
  - highestBid: tracks current highest bid (2-5)
  - winningBidderPosition: player with highest bid

Valid Actions:
  Action: PLACE_BID
  Parameters: { playerPosition: number, amount: 'PASS' | 2 | 3 | 4 | 5 }
  
  Validation:
    - playerPosition == currentBidder
    - If amount is number: amount > highestBid (or highestBid == null)
    - If amount is number: amount >= 2 and amount <= 5
    - Player hasn't already passed this round
  
  Result:
    - Add bid to bids array
    - If bid is number: update highestBid and winningBidderPosition
    - Set currentBidder to next player who hasn't passed
  
  End Condition:
    - All players except one have passed → winning bidder declares trump
    - All players pass → hand is over, no scoring, deal passes to next player
  
Next Phase: 
  - If winner exists: DECLARING_TRUMP
  - If all passed: DEALING (new round, next dealer)
```

### Declaring Trump Phase
```
Entry Condition: Bidding complete, winningBidderPosition set

Valid Actions:
  Action: DECLARE_TRUMP
  Parameters: { trumpSuit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS' }
  
  Validation:
    - Only winningBidderPosition can declare
    - trumpSuit is valid
  
  Result:
    - Set trumpSuit
  
Next Phase: FOLDING_DECISION
```

### Folding Decision Phase
```
Entry Condition: Trump declared by winning bidder

State Tracking:
  - Each non-bidder must decide to fold or stay in
  - Bidder automatically stays in (cannot fold)

Valid Actions:
  Action: FOLD_DECISION
  Parameters: { playerPosition: number, folded: boolean }
  
  Validation:
    - playerPosition != winningBidderPosition (bidder can't fold)
    - Player hasn't already decided
    - If isClubsTurnUp: folded must be false (can't fold on Clubs)
  
  Result:
    - Set player.folded = folded
  
  End Condition:
    - All non-bidders have made their decision
  
  After All Decisions:
    - Set currentPlayerPosition = winningBidderPosition
    - Initialize first trick
  
Next Phase: PLAYING
```

### Playing Phase
```
Entry Condition: Fold decisions complete, currentPlayerPosition set to bidder

State Tracking:
  - currentTrick: tracks cards played in current trick
  - tricks: completed tricks
  - currentPlayerPosition: whose turn to play (only among players who didn't fold)

Valid Actions:
  Action: PLAY_CARD
  Parameters: { playerPosition: number, cardId: string }
  
  Validation:
    - playerPosition == currentPlayerPosition
    - Player has not folded (player.folded === false)
    - Card exists in player's hand
    - If not leading: must follow suit if able
      - Get led suit from currentTrick.cards[0]
      - Check if player has cards of that suit (considering Left Bower)
      - If yes, must play that suit
      - If no, can play any card
  
  Result:
    - Remove card from player's hand
    - Add card to currentTrick.cards
    - Set currentPlayerPosition to next active player (skip folded players)
  
  When Trick Complete (all active players have played):
    - Determine winner using trick evaluation algorithm (only among active players)
    - Set currentTrick.winner
    - Increment winner's tricksTaken
    - Move currentTrick to tricks array
    - Set currentPlayerPosition to winner
    - If tricks.length < 5: Initialize new trick
    - If tricks.length == 5: Go to ROUND_OVER

Next Phase: ROUND_OVER (after 5 tricks) or continue PLAYING
```

### Round Over Phase
```
Entry Condition: 5 tricks played

Actions:
  1. Calculate scores for all players (see scoring algorithm)
  2. Update player.score for each player
  3. Check if any player.score <= 0
  4. If yes: set winner to player with lowest score, gameOver = true
  5. Display results for 5 seconds (frontend concern)
  
Next Phase: 
  - If gameOver: GAME_OVER
  - Else: Update dealerPosition = (dealerPosition + 1) % 4, then DEALING
```

### Game Over Phase
```
Entry Condition: player.score <= 0

State:
  - winner is set to player with lowest score
  - gameOver = true
  - phase = GAME_OVER

Actions:
  - Display final scores
  - Option to start new game (creates new GameState)
```

## Algorithms

### Trick Winner Determination

```typescript
function determineTrickWinner(trick: Trick, trumpSuit: Card['suit']): number {
  const ledSuit = getEffectiveSuit(trick.cards[0].card, trumpSuit);
  let winningIndex = 0;
  let winningCard = trick.cards[0].card;
  
  for (let i = 1; i < trick.cards.length; i++) {
    const card = trick.cards[i].card;
    
    if (isHigherCard(card, winningCard, trumpSuit, ledSuit)) {
      winningIndex = i;
      winningCard = card;
    }
  }
  
  return trick.cards[winningIndex].playerPosition;
}

function getEffectiveSuit(card: Card, trumpSuit: Card['suit']): Card['suit'] {
  // Handle Left Bower
  if (card.rank === 'JACK' && isSameColor(card.suit, trumpSuit) && card.suit !== trumpSuit) {
    return trumpSuit;
  }
  return card.suit;
}

function isSameColor(suit1: Card['suit'], suit2: Card['suit']): boolean {
  const black = ['SPADES', 'CLUBS'];
  const red = ['HEARTS', 'DIAMONDS'];
  return (black.includes(suit1) && black.includes(suit2)) || 
         (red.includes(suit1) && red.includes(suit2));
}

function isHigherCard(
  card: Card, 
  currentWinner: Card, 
  trumpSuit: Card['suit'], 
  ledSuit: Card['suit']
): boolean {
  const cardSuit = getEffectiveSuit(card, trumpSuit);
  const winnerSuit = getEffectiveSuit(currentWinner, trumpSuit);
  
  // Trump beats non-trump
  if (cardSuit === trumpSuit && winnerSuit !== trumpSuit) return true;
  if (cardSuit !== trumpSuit && winnerSuit === trumpSuit) return false;
  
  // Both trump or both same suit: compare ranks
  if (cardSuit === winnerSuit) {
    return getRankValue(card, trumpSuit, cardSuit) > 
           getRankValue(currentWinner, trumpSuit, winnerSuit);
  }
  
  // Different non-trump suits: led suit wins
  return cardSuit === ledSuit;
}

function getRankValue(card: Card, trumpSuit: Card['suit'], effectiveSuit: Card['suit']): number {
  if (effectiveSuit === trumpSuit) {
    // Trump suit rankings
    if (card.rank === 'JACK' && card.suit === trumpSuit) return 7; // Right Bower
    if (card.rank === 'JACK' && isSameColor(card.suit, trumpSuit)) return 6; // Left Bower
    if (card.rank === 'ACE') return 5;
    if (card.rank === 'KING') return 4;
    if (card.rank === 'QUEEN') return 3;
    if (card.rank === '10') return 2;
    if (card.rank === '9') return 1;
  } else {
    // Non-trump suit rankings
    if (card.rank === 'ACE') return 6;
    if (card.rank === 'KING') return 5;
    if (card.rank === 'QUEEN') return 4;
    if (card.rank === 'JACK') return 3;
    if (card.rank === '10') return 2;
    if (card.rank === '9') return 1;
  }
  return 0;
}
```

### Scoring Algorithm

```typescript
function calculateRoundScores(
  players: Player[], 
  winningBidderPosition: number, 
  bid: number
): Record<number, number> {
  const scores: Record<number, number> = {};
  const bidderTricks = players[winningBidderPosition].tricksTaken;
  
  for (let i = 0; i < 4; i++) {
    const player = players[i];
    
    if (player.folded) {
      // Folded players get 0 score change
      scores[i] = 0;
    } else if (i === winningBidderPosition) {
      // Bidder scoring
      if (bidderTricks >= bid) {
        // Made contract: score DECREASES (good)
        scores[i] = -bidderTricks;
      } else {
        // Failed contract: score INCREASES by 5 (bad)
        scores[i] = 5;
      }
    } else {
      // Non-bidder who stayed in
      if (player.tricksTaken >= 1) {
        // Took tricks: score DECREASES (good)
        scores[i] = -player.tricksTaken;
      } else {
        // Took no tricks: score INCREASES by 5 (bad - got set)
        scores[i] = 5;
      }
    }
  }
  
  return scores;
}

function checkWinCondition(players: Player[]): { 
  winner: number | null; 
  gameOver: boolean 
} {
  // Check if any player has reached 0 or below
  const playersAtOrBelowZero = players.filter(p => p.score <= 0);
  
  if (playersAtOrBelowZero.length === 0) {
    return { winner: null, gameOver: false };
  }
  
  // If multiple players at/below 0, lowest score wins
  const winner = playersAtOrBelowZero.reduce((lowest, player) => 
    player.score < lowest.score ? player : lowest
  );
  
  return { winner: winner.position, gameOver: true };
}
```

### Follow Suit Validation

```typescript
function canPlayCard(
  card: Card, 
  hand: Card[], 
  currentTrick: Trick, 
  trumpSuit: Card['suit']
): { valid: boolean; reason?: string } {
  // Leading a trick - can play any card
  if (currentTrick.cards.length === 0) {
    return { valid: true };
  }
  
  const ledCard = currentTrick.cards[0].card;
  const ledSuit = getEffectiveSuit(ledCard, trumpSuit);
  const cardSuit = getEffectiveSuit(card, trumpSuit);
  
  // Card matches led suit - always valid
  if (cardSuit === ledSuit) {
    return { valid: true };
  }
  
  // Check if player has any cards of led suit
  const hasLedSuit = hand.some(c => getEffectiveSuit(c, trumpSuit) === ledSuit);
  
  if (hasLedSuit) {
    return { valid: false, reason: 'Must follow suit' };
  }
  
  // No cards of led suit - can play anything
  return { valid: true };
}
```

## Initial State Template

```typescript
const INITIAL_GAME_STATE: GameState = {
  gameId: '',  // Generated on creation
  phase: 'WAITING_FOR_PLAYERS',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  
  players: [],  // Each player starts with score: 15, folded: false
  
  round: 0,
  dealerPosition: 0,  // Set randomly when 4 players join
  
  blind: [],
  turnUpCard: null,
  isClubsTurnUp: false,
  
  bids: [],
  currentBidder: null,
  highestBid: null,
  winningBidderPosition: null,
  trumpSuit: null,
  
  tricks: [],
  currentTrick: {
    number: 0,
    leadPlayerPosition: 0,
    cards: [],
    winner: null
  },
  currentPlayerPosition: null,
  
  winner: null,
  gameOver: false
};

const INITIAL_PLAYER: Player = {
  id: '',  // Generated
  name: '',
  position: 0,
  score: 15,  // Start at 15
  connected: true,
  hand: [],
  tricksTaken: 0,
  folded: false
};
```

## Validation Rules Summary

### Join Game
- Maximum 4 players
- Unique player names (optional, can allow duplicates)

### Place Bid
- Must be player's turn (currentBidder)
- Bid must be higher than highestBid
- Cannot bid after passing

### Declare Trump
- Only winning bidder can declare
- Must declare before first card played

### Play Card
- Must be player's turn (currentPlayerPosition)
- Card must be in player's hand
- Must follow suit if able (including Left Bower as trump)

### State Consistency
- Always exactly 4 players when past WAITING_FOR_PLAYERS
- Sum of all cards in play = 24 (5 per player + 4 in blind + cards in tricks)
- tricksTaken sum (among non-folded players) = tricks.length when trick complete
- Bidder's folded is always false
- If isClubsTurnUp is true, all players' folded must be false

## Client-Side Derived State

The following can be calculated from GameState and don't need to be stored:

```typescript
interface DerivedState {
  // Current player turn indicator
  isMyTurn: boolean;
  
  // Valid cards to play
  playableCards: Card[];
  
  // Tricks remaining
  tricksRemaining: number;
  
  // Leaderboard sorted by score
  leaderboard: Player[];
  
  // Bid constraints for current player
  minBidAmount: number | null;
  canPass: boolean;
}
```

This derived state should be computed on the client from the canonical GameState.

