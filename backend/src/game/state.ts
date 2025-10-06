/**
 * @module game/state
 * @description Pure state transition functions for Buck Euchre
 * 
 * All functions in this module are pure (no I/O, no mutations, no side effects)
 * Each function returns a new GameState object
 */

import { GameState, Player, PlayerPosition, Suit, Card, BidAmount } from '../../../shared/src/types/game';
import { STARTING_SCORE } from '../../../shared/src/constants/rules';
import { createDeck, shuffleDeck, dealCards } from './deck';
import { consumeCustomDeck, consumeDealerOverride } from './random';
import { determineTrickWinner } from './trick';
import { calculateRoundScores, checkWinCondition } from './scoring';

/**
 * Helper function to increment version and updatedAt timestamp
 */
function withVersion(state: GameState, updates: Partial<GameState>): GameState {
  return {
    ...state,
    ...updates,
    version: (state.version || 0) + 1,
    updatedAt: Date.now(),
  };
}

/**
 * Initializes a new game with given player IDs
 * @param playerIds - Array of 4 player IDs
 * @returns Initial game state
 */
export function initializeGame(playerIds: [string, string, string, string]): GameState {
  const playersArray = playerIds.map((id, index) => ({
    id,
    name: `Player ${index + 1}`, // Will be updated when players join
    position: index as PlayerPosition,
    score: STARTING_SCORE,
    connected: true,
    hand: [],
    tricksTaken: 0,
    folded: false,
    foldDecision: 'UNDECIDED',
  }));
  
  const players = playersArray as unknown as [Player, Player, Player, Player];

  // Randomly choose initial dealer
  const override = consumeDealerOverride();
  const dealerPosition = override !== null
    ? (override % 4 + 4) % 4 as PlayerPosition
    : Math.floor(Math.random() * 4) as PlayerPosition;

  return {
    gameId: '', // Will be set by caller
    phase: 'DEALING',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    
    players,
    
    round: 0,
    dealerPosition,
    
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
      leadPlayerPosition: 0 as PlayerPosition,
      cards: [],
      winner: null,
    },
    currentPlayerPosition: null,
    
    winner: null,
    gameOver: false,
  };
}

/**
 * Deals a new round
 * @param state - Current game state
 * @returns New game state with cards dealt
 */
export function dealNewRound(state: GameState): GameState {
  const overrideDeck = consumeCustomDeck();
  const deck = overrideDeck ?? shuffleDeck(createDeck());
  const { hands, blind } = dealCards(deck);
  
  const turnUpCard = blind[0];
  const isClubsTurnUp = turnUpCard.suit === 'CLUBS';
  
  // Reset player states for new round
  const players = state.players.map((p, i) => ({
    ...p,
    hand: hands[i],
    tricksTaken: 0,
    folded: false,
    foldDecision: 'UNDECIDED',
  })) as [Player, Player, Player, Player];

  // Automatically transition to BIDDING phase and set currentBidder
  const currentBidder = ((state.dealerPosition + 1) % 4) as PlayerPosition;

  return withVersion(state, {
    phase: 'BIDDING',
    round: state.round + 1,
    
    players,
    
    blind,
    turnUpCard,
    isClubsTurnUp,
    
    bids: [],
    currentBidder,
    highestBid: null,
    winningBidderPosition: null,
    trumpSuit: null,
    
    tricks: [],
    currentTrick: {
      number: 1,
      leadPlayerPosition: 0 as PlayerPosition,
      cards: [],
      winner: null,
    },
    currentPlayerPosition: null,
  });
}

/**
 * Transitions from DEALING to BIDDING phase
 * @param state - Current game state in DEALING phase
 * @returns New game state in BIDDING phase
 */
export function startBidding(state: GameState): GameState {
  if (state.phase !== 'DEALING') {
    throw new Error(`Cannot start bidding from phase: ${state.phase}`);
  }
  
  return withVersion(state, {
    phase: 'BIDDING',
    currentBidder: ((state.dealerPosition + 1) % 4) as PlayerPosition,
  });
}

/**
 * Applies a bid to the game state
 * @param state - Current game state
 * @param playerPosition - Position of player placing bid
 * @param amount - Bid amount
 * @returns New game state with bid applied
 */
export function applyBid(
  state: GameState,
  playerPosition: PlayerPosition,
  amount: BidAmount
): GameState {
  const newBids = [...state.bids, { playerPosition, amount }];

  let newHighestBid = state.highestBid;
  let newWinningBidderPosition = state.winningBidderPosition;

  if (typeof amount === 'number') {
    newHighestBid = amount;
    newWinningBidderPosition = playerPosition;
  }

  const totalBids = newBids.length;
  const biddingComplete = totalBids >= 4;
  const allPlayersPassed = biddingComplete && newHighestBid === null;

  if (allPlayersPassed) {
    const nextDealerPosition = ((state.dealerPosition + 1) % 4) as PlayerPosition;

    return withVersion(state, {
      phase: 'DEALING',
      dealerPosition: nextDealerPosition,
      bids: [],
      currentBidder: null,
      highestBid: null,
      winningBidderPosition: null,
      trumpSuit: null,
    });
  }

  let nextBidder: PlayerPosition | null = null;
  let newPhase = state.phase;

  if (biddingComplete) {
    newPhase = 'DECLARING_TRUMP';
    nextBidder = null;
  } else {
    nextBidder = ((playerPosition + 1) % 4) as PlayerPosition;
  }

  return withVersion(state, {
    phase: newPhase,
    bids: newBids,
    currentBidder: nextBidder,
    highestBid: newHighestBid,
    winningBidderPosition: newWinningBidderPosition,
  });
}

/**
 * Handles the case when all players pass
 * Rotates dealer and prepares for new round
 * @param state - Current game state
 * @returns New game state ready for dealing
 */
export function handleAllPlayersPass(state: GameState): GameState {
  return withVersion(state, {
    phase: 'DEALING',
    dealerPosition: ((state.dealerPosition + 1) % 4) as PlayerPosition,
    bids: [],
    currentBidder: null,
    highestBid: null,
    winningBidderPosition: null,
    trumpSuit: null,
  });
}

/**
 * Applies trump declaration by winning bidder
 * @param state - Current game state
 * @param trumpSuit - Declared trump suit
 * @returns New game state with trump declared
 */
export function applyTrumpDeclaration(state: GameState, trumpSuit: Suit): GameState {
  const updates: Partial<GameState> = {
    phase: 'FOLDING_DECISION',
    updatedAt: Date.now(),
    trumpSuit,
  };

  return withVersion(state, updates);
}

/**
 * Applies a fold decision for a player
 * @param state - Current game state
 * @param playerPosition - Position of player making decision
 * @param folded - Whether player chose to fold
 * @returns New game state with fold decision applied
 */
export function applyFoldDecision(
  state: GameState,
  playerPosition: PlayerPosition,
  folded: boolean
): GameState {
  const currentPlayer = state.players[playerPosition];
  if (currentPlayer.foldDecision !== 'UNDECIDED') {
    throw new Error('Fold decision already recorded');
  }

  const players = state.players.map((p, i) => {
    if (i !== playerPosition) {
      return p;
    }

    return {
      ...p,
      folded,
      foldDecision: folded ? 'FOLD' : 'STAY',
    };
  }) as [Player, Player, Player, Player];

  const winningBidder = state.winningBidderPosition;

  // Only non-bidders need to make a decision. Bidder is always considered decided.
  const allDecided = players.every((player, position) => {
    if (position === winningBidder) {
      return true;
    }

    return player.foldDecision !== 'UNDECIDED';
  });
  let newPhase = state.phase;
  let newCurrentPlayerPosition = state.currentPlayerPosition;
  let newCurrentTrick = state.currentTrick;

  if (allDecided) {
    if (winningBidder === null) {
      throw new Error('Cannot start playing without a winning bidder');
    }

    // Start playing phase
    newPhase = 'PLAYING';
    newCurrentPlayerPosition = winningBidder;
    newCurrentTrick = {
      number: 1,
      leadPlayerPosition: winningBidder,
      cards: [],
      winner: null,
    };
  }

  return withVersion(state, {
    phase: newPhase,
    players,
    currentPlayerPosition: newCurrentPlayerPosition,
    currentTrick: newCurrentTrick,
  });
}

/**
 * Applies a card play to the game state
 * @param state - Current game state
 * @param playerPosition - Position of player playing card
 * @param cardId - ID of card being played
 * @returns New game state with card played
 */
export function applyCardPlay(
  state: GameState,
  playerPosition: PlayerPosition,
  cardId: string
): GameState {
  // Find the card FIRST (before removing it)
  const card = state.players[playerPosition].hand.find(c => c.id === cardId);
  if (!card) {
    throw new Error(`Card ${cardId} not found in player ${playerPosition}'s hand`);
  }
  
  // Remove card from player's hand
  const players = state.players.map((p, i) => {
    if (i === playerPosition) {
      return {
        ...p,
        hand: p.hand.filter(c => c.id !== cardId),
      };
    }
    return p;
  }) as [Player, Player, Player, Player];
  
  // Add card to current trick
  const newCurrentTrick = {
    ...state.currentTrick,
    cards: [...state.currentTrick.cards, { card, playerPosition }],
  };
  
  // Get active (non-folded) players
  const activePlayers = state.players
    .filter(p => p.folded !== true)
    .map(p => p.position);
  
  // Check if trick is complete
  const trickComplete = newCurrentTrick.cards.length === activePlayers.length;
  
  if (trickComplete) {
    // Determine winner
    const winner = determineTrickWinner(newCurrentTrick, state.trumpSuit!, activePlayers);
    newCurrentTrick.winner = winner;
    
    // Update tricks taken
    const updatedPlayers = players.map((p, i) => {
      if (i === winner) {
        return { ...p, tricksTaken: p.tricksTaken + 1 };
      }
      return p;
    }) as [Player, Player, Player, Player];
    
    // Move to completed tricks
    const newTricks = [...state.tricks, newCurrentTrick];
    
    // Check if round is over (5 tricks played)
    if (newTricks.length === 5) {
      return withVersion(state, {
        phase: 'ROUND_OVER',
        players: updatedPlayers,
        tricks: newTricks,
        currentTrick: newCurrentTrick,
        currentPlayerPosition: null,
      });
    }
    
    // Start next trick
    return withVersion(state, {
      players: updatedPlayers,
      tricks: newTricks,
      currentTrick: {
        number: newTricks.length + 1,
        leadPlayerPosition: winner,
        cards: [],
        winner: null,
      },
      currentPlayerPosition: winner,
    });
  }
  
  // Trick not complete - find next player
  let nextPlayer = ((playerPosition + 1) % 4) as PlayerPosition;
  while (state.players[nextPlayer].folded === true) {
    nextPlayer = ((nextPlayer + 1) % 4) as PlayerPosition;
  }
  
  return withVersion(state, {
    players,
    currentTrick: newCurrentTrick,
    currentPlayerPosition: nextPlayer,
  });
}

/**
 * Finishes the round, calculates scores, and checks for winner
 * @param state - Current game state
 * @returns New game state with scores updated
 */
export function finishRound(state: GameState): GameState {
  // Calculate score changes
  const scoreChanges = calculateRoundScores(
    state.players,
    state.winningBidderPosition!,
    state.highestBid!
  );
  
  // Apply score changes
  const players = state.players.map((p, i) => ({
    ...p,
    score: p.score + scoreChanges[i],
  })) as [Player, Player, Player, Player];
  
  // Check for winner
  const { winner, gameOver } = checkWinCondition(players);
  
  if (gameOver) {
    return withVersion(state, {
      phase: 'GAME_OVER',
      players,
      winner,
      gameOver: true,
    });
  }
  
  // Transition to ROUND_OVER to show scores
  // (Players will manually start next round via START_NEXT_ROUND event)
  return withVersion(state, {
    phase: 'ROUND_OVER',
    players,
  });
}

/**
 * Starts the next round from ROUND_OVER phase
 * @param state - Current game state in ROUND_OVER phase
 * @returns New game state ready for dealing
 */
export function startNextRound(state: GameState): GameState {
  if (state.phase !== 'ROUND_OVER') {
    throw new Error('Can only start next round from ROUND_OVER phase');
  }
  
  // Rotate dealer for next round
  const newDealerPosition = ((state.dealerPosition + 1) % 4) as PlayerPosition;
  
  return withVersion(state, {
    phase: 'DEALING',
    dealerPosition: newDealerPosition,
  });
}
