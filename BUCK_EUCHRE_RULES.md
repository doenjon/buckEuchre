# Buck Euchre Rules

## Overview

Buck Euchre is a trick-taking card game for 4 players, each playing individually (no partnerships). It uses a 24-card deck with a unique blind/kitty and "countdown" scoring system.

## Deck Composition

24 cards total:
- **Suits:** Spades (♠), Hearts (♥), Diamonds (♦), Clubs (♣)
- **Ranks per suit:** 9, 10, Jack, Queen, King, Ace

## Card Rankings

### In Trump Suit
When a suit is declared trump, cards rank as follows (highest to lowest):
1. **Right Bower** - Jack of trump suit
2. **Left Bower** - Jack of same color as trump
3. Ace of trump
4. King of trump
5. Queen of trump
6. 10 of trump
7. 9 of trump

**Important:** The Left Bower is considered part of the trump suit, NOT its original suit.

### In Non-Trump Suits
For suits that are not trump (highest to lowest):
1. Ace
2. King
3. Queen
4. Jack (unless it's the Left Bower)
5. 10
6. 9

### Same-Color Suits
- If **Spades** is trump → **Clubs** Jack becomes Left Bower
- If **Clubs** is trump → **Spades** Jack becomes Left Bower
- If **Hearts** is trump → **Diamonds** Jack becomes Left Bower
- If **Diamonds** is trump → **Hearts** Jack becomes Left Bower

## Game Flow

### 1. Setup
- 4 players sit in a circle
- **Each player starts with 15 points**
- Dealer is chosen randomly for first hand
- Dealer rotates clockwise after each hand

### 2. Dealing
- Dealer shuffles and deals **5 cards** to each player
- Cards are dealt in batches (typically 2-3 or 3-2)
- **4 cards remain in the "blind" (kitty)**
- The **top card of the blind is turned face-up** for all players to see
- **Important:** The 4 blind cards (including the turned-up card) are never played or added to anyone's hand - they remain set aside for the entire round. The turned-up card is visible only to provide information (specifically, to determine if the "Clubs rule" applies).

### 3. Trump Determination & Bidding Phase

**Trump Card Reveal:**
- The top card of the blind is revealed
- **If the card is a Club:** Clubs are automatically trump and **no one can fold** (everyone must stay in)
- **If any other suit:** Bidding proceeds

**Bidding Order:** Starts with player to dealer's left, proceeds clockwise.

**Bid Options:**
- **Pass** - Decline to bid
- **2** - Commit to taking at least 2 tricks
- **3** - Commit to taking at least 3 tricks
- **4** - Commit to taking at least 4 tricks
- **5** - Commit to taking all 5 tricks

**Bidding Rules:**
- Each bid must be higher than the previous bid
- Player can pass and cannot re-enter bidding
- **If all players pass:** Hand is over, deal passes to next player, no scoring
- Bidding ends when one player has highest bid and all others have passed

**Winning Bidder:**
- Player with highest bid becomes the "bidder" (maker)
- **Bidder declares trump suit** (can be any of the 4 suits)
- Bidder leads first trick

**Folding Phase (Non-Bidders Only):**
- After trump is declared, each non-bidder decides whether to **stay in** or **fold**
- **Folding** means you sit out this hand (won't play cards or score)
- Players fold if they don't like their hand for the chosen trump suit
- **Exception:** If the turned-up card was a Club, **no one can fold** (everyone must play)
- Folding is strategic: avoid the +5 penalty if you think you can't take any tricks

### 4. Playing Tricks

**Leading:**
- Bidder leads first trick
- Winner of each trick leads next trick

**Following Suit:**
- Players who stayed in must follow suit if able
- If cannot follow suit, may play any card
- Remember: Left Bower is considered trump suit, not its original suit
- Folded players do not play cards

**Winning a Trick:**
- Highest trump card wins
- If no trump played, highest card of led suit wins
- Winner takes the trick and leads next

### 5. Scoring

After all 5 tricks are played:

**For the Bidder:**
- **Made Contract** (took at least the number of tricks bid): Score **decreases by number of tricks taken**
- **Failed Contract** (took fewer tricks than bid): Score **increases by 5 points** (+5)

**For Non-Bidders Who Stayed In:**
- **Took 1+ tricks:** Score **decreases by number of tricks taken**
- **Took 0 tricks:** Score **increases by 5 points** (+5)

**For Players Who Folded:**
- No score change (0)

**Scoring Examples:**
- Bidder bid 3, took 4 tricks: Score -4
- Bidder bid 3, took 2 tricks: Score +5 (euchred)
- Non-bidder stayed in, took 2 tricks: Score -2
- Non-bidder stayed in, took 0 tricks: Score +5 (got set)
- Non-bidder folded: Score +0

### 6. Winning the Game

**Victory Condition:**
- **First player to reach 0 or below wins**
- This is a "countdown" game (start at 15, race to 0)
- Game ends immediately when a player reaches 0 or goes negative

**Score Range:**
- Scores can go negative (player still wins)
- Scores typically range from 0-20 during play

## Strategy Considerations

### Bidding Strategy
- **Bid 2:** Moderate hand, likely 2-3 tricks with trump support
- **Bid 3:** Strong hand with good trumps or multiple aces
- **Bid 4:** Very strong trump or multiple high cards
- **Bid 5:** Extremely rare - nearly perfect hand required

### Folding Strategy
- **Fold** if you have weak hand and think you'll take 0 tricks (+5 penalty vs. potential -1/-2)
- **Stay in** if you have decent chance at 1+ tricks
- **Can't fold** if turned card was a Club

### Trump Selection (for Bidder)
- Choose suit where you have strength (bowers, high cards)
- Avoid suit where opponents showed strength in bidding
- Consider the turned-up card suit

### For Non-Bidders
- Coordinate to prevent bidder from making contract (if you stayed in)
- Take tricks when safe to reduce your score
- Trump strategically

## Edge Cases

### All Players Pass
- Hand is over, no tricks played, no scoring
- Deal passes to next player (clockwise)
- New hand is dealt

### Clubs Turn-Up
- Clubs are automatically trump
- No one can fold (all 4 players must play)
- Bidding still proceeds normally

### All Non-Bidders Fold
- Only the bidder plays (essentially takes all 5 tricks)
- Bidder scores -5 points (took 5 tricks)
- Other players score 0 (folded)

### Multiple Players Reach 0 Same Round
- Player with lowest score wins
- If tied, play additional hand to break tie

## Variations NOT Implemented (for MVP)

- No partnerships
- No "go alone" option
- No kitty exchange (blind cards stay blind)
- No redeal/misdeal rules

## Implementation Notes for Developers

### Trick Evaluation Algorithm
```
function determineTrickWinner(trick, trumpSuit, ledSuit):
  1. Filter to only players who stayed in (didn't fold)
  2. Identify all trump cards in trick (including Left Bower)
  3. If trump cards exist:
     - Return player with highest trump
  4. Else:
     - Return player with highest card of led suit
```

### Left Bower Handling
```
function getEffectiveSuit(card, trumpSuit):
  if card is Jack and card.color == trumpSuit.color and card.suit != trumpSuit:
    return trumpSuit
  else:
    return card.suit
```

### Scoring Logic
```
function calculateRoundScores(players, bidderPosition, bid):
  scores = {}
  
  for each player:
    if player.folded:
      scores[player] = 0
    else if player == bidder:
      if player.tricksTaken >= bid:
        scores[player] = -player.tricksTaken  // Made contract
      else:
        scores[player] = +5  // Failed contract
    else:  // Non-bidder who stayed in
      if player.tricksTaken >= 1:
        scores[player] = -player.tricksTaken
      else:
        scores[player] = +5  // Got set (no tricks)
  
  return scores
```

### Win Condition Check
```
function checkWinCondition(players):
  for each player:
    if player.score <= 0:
      return { winner: player, gameOver: true }
  return { winner: null, gameOver: false }
```

## Game State Machine

```
START → DEALING → TRUMP_REVEAL → BIDDING → DECLARING_TRUMP → FOLDING_DECISION → PLAYING → SCORING → [GAME_OVER or DEALING]
```

Each state has specific valid actions and transitions defined in GAME_STATE_SPEC.md.

