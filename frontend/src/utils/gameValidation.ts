/**
 * @module utils/gameValidation
 * @description Client-side validation utilities for instant feedback
 * 
 * Note: Server still validates all actions (server is authority)
 * These are for UI feedback only
 */

import { getEffectiveSuit } from '@buck-euchre/shared';
import type { GameState, Card, PlayerPosition, BidAmount, Suit } from '@buck-euchre/shared';

/**
 * Result of a validation check
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Get playable cards for a player
 * Applies follow-suit rules and folded status
 */
export function getPlayableCards(
  gameState: GameState,
  playerPosition: PlayerPosition
): Card[] {
  // Check if game is in playing phase
  if (gameState.phase !== 'PLAYING') {
    return [];
  }

  // Check if it's player's turn
  if (gameState.currentPlayerPosition !== playerPosition) {
    return [];
  }

  const player = gameState.players[playerPosition];

  // Check if player has folded
  if (player.folded) {
    return [];
  }

  const hand = player.hand;
  const currentTrick = gameState.currentTrick;

  // Check if player has already played in this trick
  const playerHasPlayedInTrick = currentTrick.cards.some(
    pc => pc.playerPosition === playerPosition
  );

  // If player is leading the trick (hasn't played yet), all cards are playable
  // This handles both empty tricks and display states showing completed tricks
  if (currentTrick.cards.length === 0 || !playerHasPlayedInTrick) {
    return hand;
  }

  // Follow suit rules apply (player hasn't played yet but others have)
  const trumpSuit = gameState.trumpSuit;
  const ledCard = currentTrick.cards[0].card;
  const ledSuit: Suit = trumpSuit ? getEffectiveSuit(ledCard, trumpSuit) : ledCard.suit;
  const cardsOfLeadSuit = hand.filter(card =>
    trumpSuit ? getEffectiveSuit(card, trumpSuit) === ledSuit : card.suit === ledSuit
  );

  // If player has cards of lead suit, they must play one
  if (cardsOfLeadSuit.length > 0) {
    return cardsOfLeadSuit;
  }

  // Otherwise, any card is playable
  return hand;
}

/**
 * Check if a specific card can be played
 */
export function canPlayCard(
  gameState: GameState,
  playerPosition: PlayerPosition,
  cardId: string
): ValidationResult {
  const playableCards = getPlayableCards(gameState, playerPosition);
  const card = playableCards.find(c => c.id === cardId);

  if (!card) {
    const player = gameState.players[playerPosition];
    
    // Provide specific reason
    if (gameState.phase !== 'PLAYING') {
      return { valid: false, reason: 'Not in playing phase' };
    }
    
    if (gameState.currentPlayerPosition !== playerPosition) {
      return { valid: false, reason: 'Not your turn' };
    }
    
    if (player.folded) {
      return { valid: false, reason: 'You have folded' };
    }
    
    // Must be a follow-suit violation
    const currentTrick = gameState.currentTrick;
    if (currentTrick.cards.length > 0) {
      const trumpSuit = gameState.trumpSuit;
      const ledCard = currentTrick.cards[0].card;
      const ledSuit: Suit = trumpSuit ? getEffectiveSuit(ledCard, trumpSuit) : ledCard.suit;
      return { valid: false, reason: `Must follow suit (${ledSuit})` };
    }
    
    return { valid: false, reason: 'Cannot play this card' };
  }

  return { valid: true };
}

/**
 * Check if a player can place a bid
 */
export function canPlaceBid(
  amount: BidAmount,
  gameState: GameState,
  playerPosition: PlayerPosition
): ValidationResult {
  // Check if game is in bidding phase
  if (gameState.phase !== 'BIDDING') {
    return { valid: false, reason: 'Not in bidding phase' };
  }

  // Check if it's player's turn
  if (gameState.currentBidder !== playerPosition) {
    return { valid: false, reason: 'Not your turn to bid' };
  }

  // Check if player already bid
  const alreadyBid = gameState.bids.some(b => b.playerPosition === playerPosition);
  if (alreadyBid) {
    return { valid: false, reason: 'You already placed a bid' };
  }

  // Pass is always valid
  if (amount === 'PASS') {
    return { valid: true };
  }

  // Check if bid is higher than current highest
  if (gameState.highestBid !== null && amount <= gameState.highestBid) {
    return { 
      valid: false, 
      reason: `Bid must be higher than ${gameState.highestBid}` 
    };
  }

  // Bid must be between 2 and 5
  if (amount < 2 || amount > 5) {
    return { valid: false, reason: 'Bid must be between 2 and 5' };
  }

  return { valid: true };
}

/**
 * Check if a player can fold
 */
export function canFold(
  gameState: GameState,
  playerPosition: PlayerPosition
): ValidationResult {
  // Check if game is in folding decision phase
  if (gameState.phase !== 'FOLDING_DECISION') {
    return { valid: false, reason: 'Not in folding decision phase' };
  }

  // Check if player is the winning bidder
  if (gameState.winningBidderPosition === playerPosition) {
    return { valid: false, reason: 'Winning bidder cannot fold' };
  }

  // Check if clubs are turned up (dirty clubs - no folding)
  if (gameState.isClubsTurnUp) {
    return { valid: false, reason: 'Cannot fold when clubs are turned up' };
  }

  const player = gameState.players[playerPosition];

  // Check if player already made a decision
  if (player.foldDecision !== 'UNDECIDED') {
    return { valid: false, reason: 'You already made your decision' };
  }

  return { valid: true };
}

/**
 * Check if a player can declare trump
 */
export function canDeclareTrump(
  gameState: GameState,
  playerPosition: PlayerPosition
): ValidationResult {
  // Check if game is in declaring trump phase
  if (gameState.phase !== 'DECLARING_TRUMP') {
    return { valid: false, reason: 'Not in trump declaration phase' };
  }

  // Check if player is the winning bidder
  if (gameState.winningBidderPosition !== playerPosition) {
    return { valid: false, reason: 'Only winning bidder can declare trump' };
  }

  return { valid: true };
}

/**
 * Get available bid amounts for a player
 */
export function getAvailableBids(
  gameState: GameState,
  playerPosition: PlayerPosition
): BidAmount[] {
  const validation = canPlaceBid('PASS', gameState, playerPosition);
  
  if (!validation.valid) {
    return [];
  }

  const bids: BidAmount[] = ['PASS'];
  const minBid = gameState.highestBid ? (gameState.highestBid + 1) : 2;

  for (let bid = minBid; bid <= 5; bid++) {
    bids.push(bid as BidAmount);
  }

  return bids;
}

/**
 * Check if player is current player for any action
 */
export function isPlayerTurn(
  gameState: GameState,
  playerPosition: PlayerPosition
): boolean {
  switch (gameState.phase) {
    case 'BIDDING':
      return gameState.currentBidder === playerPosition;
    
    case 'DECLARING_TRUMP':
      return gameState.winningBidderPosition === playerPosition;
    
    case 'FOLDING_DECISION':
      // All non-bidders need to make a decision
      return (
        gameState.winningBidderPosition !== playerPosition &&
        gameState.players[playerPosition].foldDecision === 'UNDECIDED'
      );
    
    case 'PLAYING':
      return gameState.currentPlayerPosition === playerPosition;
    
    default:
      return false;
  }
}
