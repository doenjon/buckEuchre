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
  }));
  
  const players = playersArray as unknown as [Player, Player, Player, Player];

  // Randomly choose initial dealer
  const dealerPosition = Math.floor(Math.random() * 4) as PlayerPosition;

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
  const deck = shuffleDeck(createDeck());
  const { hands, blind } = dealCards(deck);
  
  const turnUpCard = blind[0];
  const isClubsTurnUp = turnUpCard.suit === 'CLUBS';
  
  // Reset player states for new round
  const players = state.players.map((p, i) => ({
    ...p,
    hand: hands[i],
    tricksTaken: 0,
    folded: false,
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
  
  // Find next bidder (skip players who have passed)
  const passedPlayers = new Set(
    newBids.filter(b => b.amount === 'PASS').map(b => b.playerPosition)
  );
  
  let nextBidder: PlayerPosition | null = null;
  for (let i = 1; i <= 4; i++) {
    const candidatePosition = ((playerPosition + i) % 4) as PlayerPosition;
    if (!passedPlayers.has(candidatePosition)) {
      nextBidder = candidatePosition;
      break;
    }
  }
  
  // Check if bidding is complete
  let newPhase = state.phase;
  if (passedPlayers.size === 4) {
    // All players passed - deal passes to next dealer
    newPhase = 'DEALING';
  } else if (passedPlayers.size === 3 && newWinningBidderPosition !== null) {
    // One winner, three passed - bidding complete
    newPhase = 'DECLARING_TRUMP';
    nextBidder = null;
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
  // If clubs are turned up (dirty clubs), skip folding and go straight to playing
  const nextPhase = state.isClubsTurnUp ? 'PLAYING' : 'FOLDING_DECISION';
  
  const updates: Partial<GameState> = {
    phase: nextPhase,
    updatedAt: Date.now(),
    trumpSuit,
  };
  
  // If going straight to playing (dirty clubs), set up the first trick
  if (nextPhase === 'PLAYING') {
    updates.currentPlayerPosition = state.winningBidderPosition;
    updates.currentTrick = {
      number: 1,
      leadPlayerPosition: state.winningBidderPosition!,
      cards: [],
      winner: null,
    };
  }
  
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
  const players = state.players.map((p, i) =>
    i === playerPosition ? { ...p, folded } : p
  ) as [Player, Player, Player, Player];
  
  // Check if all non-bidders have decided
  const nonBidders = state.players.filter(
    (_, i) => i !== state.winningBidderPosition
  );
  const allDecided = nonBidders.every(p => players[p.position].folded !== false || players[p.position].folded === false);
  
  let newPhase = state.phase;
  let newCurrentPlayerPosition = state.currentPlayerPosition;
  let newCurrentTrick = state.currentTrick;
  
  if (allDecided) {
    // Start playing phase
    newPhase = 'PLAYING';
    newCurrentPlayerPosition = state.winningBidderPosition;
    newCurrentTrick = {
      number: 1,
      leadPlayerPosition: state.winningBidderPosition!,
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
  
  // Find the card
  const card = state.players[playerPosition].hand.find(c => c.id === cardId);
  if (!card) {
    throw new Error(`Card ${cardId} not found in player ${playerPosition}'s hand`);
  }
  
  // Add card to current trick
  const newCurrentTrick = {
    ...state.currentTrick,
    cards: [...state.currentTrick.cards, { card, playerPosition }],
  };
  
  // Get active (non-folded) players
  const activePlayers = state.players
    .filter(p => !p.folded)
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
  while (state.players[nextPlayer].folded) {
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
  
  // Rotate dealer for next round
  const newDealerPosition = ((state.dealerPosition + 1) % 4) as PlayerPosition;
  
  return withVersion(state, {
    phase: 'DEALING',
    players,
    dealerPosition: newDealerPosition,
  });
}
