/**
 * @module game/validation
 * @description Move validation logic for Buck Euchre
 * 
 * All functions in this module are pure (no I/O, no mutations, no side effects)
 */

import { Card, Trick, Suit, FoldDecision } from '../../../shared/src/types/game.js';
import { getEffectiveSuit } from './deck.js';

/**
 * Result of a validation check
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates if a card can be played in the current trick
 * 
 * Rules:
 * 1. Leading a trick: can play any card
 * 2. Following suit: must follow led suit if able
 * 3. If no cards of led suit: can play any card
 * 4. Left Bower counts as trump suit, not its original suit
 * 
 * @param card - The card player wants to play
 * @param hand - All cards in player's hand
 * @param currentTrick - The current trick being played
 * @param trumpSuit - The trump suit for this round
 * @param playerFolded - Whether the player has folded
 * @returns Validation result with reason if invalid
 */
export function canPlayCard(
  card: Card,
  hand: Card[],
  currentTrick: Trick,
  trumpSuit: Suit,
  playerFolded: boolean
): ValidationResult {
  // Folded players cannot play cards
  if (playerFolded) {
    return { valid: false, reason: 'Player has folded' };
  }

  // Card must be in player's hand
  if (!hand.some(c => c.id === card.id)) {
    return { valid: false, reason: 'Card not in hand' };
  }

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

/**
 * Validates if a bid can be placed
 * 
 * Buck Euchre Rules:
 * 1. Bid must be higher than current highest bid
 * 2. Cannot bid after passing
 * 3. All players CAN pass - hand is over, deal passes to next player
 * 
 * @param amount - The bid amount ('PASS' or 2-5)
 * @param currentHighestBid - Current highest bid (null if none yet)
 * @param playerHasPassed - Whether this player already passed
 * @param allOthersPassed - Whether all other players have passed (unused in Buck Euchre)
 * @returns Validation result with reason if invalid
 */
export function canPlaceBid(
  amount: 'PASS' | number,
  currentHighestBid: number | null,
  playerHasPassed: boolean,
  allOthersPassed: boolean,
  playerHasBid = false
): ValidationResult {
  if (playerHasBid) {
    return { valid: false, reason: 'Already acted in bidding round' };
  }

  // Cannot bid after passing
  if (playerHasPassed) {
    return { valid: false, reason: 'Already passed this round' };
  }

  // In Buck Euchre, all players can pass (unlike standard Euchre)
  // Passing is always valid
  if (amount === 'PASS') {
    return { valid: true };
  }

  // Bid must be in valid range (2-5)
  if (amount < 2 || amount > 5) {
    return { valid: false, reason: 'Bid must be between 2 and 5' };
  }

  // Bid must be higher than current highest
  if (currentHighestBid !== null && amount <= currentHighestBid) {
    return { valid: false, reason: `Bid must be higher than ${currentHighestBid}` };
  }

  return { valid: true };
}

/**
 * Validates if a player can fold
 * 
 * Rules:
 * 1. Cannot fold if Clubs turned up (everyone must play)
 * 2. Bidder cannot fold
 * 
 * @param isClubsTurnUp - Whether the turn-up card was a Club
 * @param isBidder - Whether this player won the bidding
 * @returns Validation result with reason if invalid
 */
export function canFold(
  isClubsTurnUp: boolean,
  isBidder: boolean,
  currentDecision: FoldDecision,
  requestedFold: boolean
): ValidationResult {
  // Player cannot change their mind once a decision has been made
  if (currentDecision !== 'UNDECIDED') {
    return { valid: false, reason: 'Fold decision already made' };
  }

  // Bidder cannot fold
  if (isBidder) {
    return { valid: false, reason: 'Bidder cannot fold' };
  }

  // Cannot fold when Clubs turned up
  if (isClubsTurnUp && requestedFold) {
    return { valid: false, reason: 'Cannot fold when Clubs turned up' };
  }

  return { valid: true };
}
