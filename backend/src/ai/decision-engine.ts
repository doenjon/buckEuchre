/**
 * @module ai/decision-engine
 * @description AI decision-making logic for Buck Euchre
 * 
 * Implements a simple but functional AI strategy:
 * - Bidding: Count trump cards and bid based on strength
 * - Trump declaration: Choose suit with most cards
 * - Folding: Fold if weak hand (unless clubs or bidder)
 * - Card play: Basic strategy (lead high, follow low)
 */

import { Card, Suit, BidAmount, GameState, PlayerPosition } from '@buck-euchre/shared';
import { getEffectiveSuit, isSameColor } from '../game/deck';
import { canPlayCard } from '../game/validation';
import { getRankValue } from '../game/cards';

/**
 * Count how many trump cards are in a hand (including Left Bower)
 * 
 * @param hand - Cards in the player's hand
 * @param trumpSuit - The trump suit
 * @returns Number of trump cards
 */
function countTrumpCards(hand: Card[], trumpSuit: Suit): number {
  return hand.filter(card => getEffectiveSuit(card, trumpSuit) === trumpSuit).length;
}

/**
 * Count high trump cards (Jack, Ace, King)
 * 
 * @param hand - Cards in the player's hand
 * @param trumpSuit - The trump suit
 * @returns Number of high trump cards
 */
function countHighTrumpCards(hand: Card[], trumpSuit: Suit): number {
  return hand.filter(card => {
    const effectiveSuit = getEffectiveSuit(card, trumpSuit);
    return effectiveSuit === trumpSuit && 
           (card.rank === 'JACK' || card.rank === 'ACE' || card.rank === 'KING');
  }).length;
}

/**
 * Evaluate hand strength for a potential trump suit
 * 
 * @param hand - Cards in the player's hand
 * @param trumpSuit - Potential trump suit
 * @returns Score representing hand strength (higher = better)
 */
function evaluateHandStrength(hand: Card[], trumpSuit: Suit): number {
  const trumpCount = countTrumpCards(hand, trumpSuit);
  const highTrumpCount = countHighTrumpCards(hand, trumpSuit);
  
  // Weight high cards more heavily
  return trumpCount + (highTrumpCount * 2);
}

/**
 * Decide what bid to place
 * 
 * Strategy:
 * - Count trump cards in the turn-up suit
 * - 4+ trumps with 2+ high cards: bid 4-5
 * - 3+ trumps with 1+ high card: bid 3
 * - 2+ trumps: bid 2 or pass based on high cards
 * - <2 trumps: pass
 * 
 * @param hand - AI player's hand
 * @param turnUpCard - The turn-up card from the blind
 * @param currentBid - Current highest bid (null if none)
 * @returns Bid amount
 */
export function decideBid(
  hand: Card[],
  turnUpCard: Card,
  currentBid: number | null
): BidAmount {
  const trumpSuit = turnUpCard.suit;
  const trumpCount = countTrumpCards(hand, trumpSuit);
  const highTrumpCount = countHighTrumpCards(hand, trumpSuit);
  
  // Calculate desired bid based on hand strength
  let desiredBid = 0;
  
  if (trumpCount >= 4 && highTrumpCount >= 2) {
    // Very strong hand
    desiredBid = 4 + (highTrumpCount >= 3 ? 1 : 0);
  } else if (trumpCount >= 3 && highTrumpCount >= 1) {
    // Good hand
    desiredBid = 3;
  } else if (trumpCount >= 2) {
    // Marginal hand
    desiredBid = highTrumpCount >= 1 ? 2 : 0;
  } else {
    // Weak hand
    desiredBid = 0;
  }
  
  // If desired bid is 0 or not higher than current bid, pass
  if (desiredBid === 0 || (currentBid !== null && desiredBid <= currentBid)) {
    return 'PASS';
  }
  
  // Cap at 5
  return Math.min(desiredBid, 5) as 2 | 3 | 4 | 5;
}

/**
 * Decide which suit to declare as trump
 * 
 * Strategy:
 * - Count cards in each suit (considering Left Bower)
 * - Weight high cards more heavily
 * - Choose suit with highest score
 * 
 * @param hand - AI player's hand
 * @param turnUpCard - The turn-up card (for reference)
 * @returns Trump suit to declare
 */
export function decideTrump(hand: Card[], turnUpCard: Card): Suit {
  const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
  
  let bestSuit = suits[0];
  let bestScore = -1;
  
  for (const suit of suits) {
    const score = evaluateHandStrength(hand, suit);
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }
  
  return bestSuit;
}

/**
 * Decide whether to fold or stay
 * 
 * Strategy:
 * - Fold if fewer than 2 trump cards
 * - Stay if 2+ trump cards or any high trump card
 * 
 * @param hand - AI player's hand
 * @param trumpSuit - The declared trump suit
 * @param isClubs - Whether the turn-up was Clubs (cannot fold)
 * @returns True to fold, false to stay
 */
export function decideFold(
  hand: Card[],
  trumpSuit: Suit,
  isClubs: boolean
): boolean {
  // Cannot fold if clubs
  if (isClubs) {
    return false;
  }
  
  const trumpCount = countTrumpCards(hand, trumpSuit);
  const highTrumpCount = countHighTrumpCards(hand, trumpSuit);
  
  // Stay if we have a high trump card
  if (highTrumpCount > 0) {
    return false;
  }
  
  // Fold if fewer than 2 trumps
  return trumpCount < 2;
}

/**
 * Get all cards that can legally be played
 * 
 * @param gameState - Current game state
 * @param aiPosition - AI player's position
 * @returns Array of playable cards
 */
function getPlayableCards(gameState: GameState, aiPosition: PlayerPosition): Card[] {
  const player = gameState.players[aiPosition];
  const trumpSuit = gameState.trumpSuit!;
  
  return player.hand.filter(card => 
    canPlayCard(card, player.hand, gameState.currentTrick, trumpSuit, player.folded === true).valid
  );
}

/**
 * Score a card for playing (higher = better to play)
 * 
 * @param card - Card to score
 * @param trumpSuit - Trump suit
 * @param isLeading - Whether this is the lead card
 * @returns Score (higher = better)
 */
function scoreCardForPlay(card: Card, trumpSuit: Suit, isLeading: boolean): number {
  const effectiveSuit = getEffectiveSuit(card, trumpSuit);
  const rankValue = getRankValue(card, trumpSuit, effectiveSuit);
  
  if (isLeading) {
    // When leading, prefer high cards
    return rankValue * 10;
  } else {
    // When following, prefer low cards to save high ones
    return 100 - (rankValue * 10);
  }
}

/**
 * Decide which card to play
 * 
 * Strategy:
 * - If leading: Play highest trump, or highest card if no trump
 * - If following: 
 *   - If can follow suit: Play lowest card that follows suit
 *   - If cannot follow suit: Play lowest off-suit card
 * 
 * @param gameState - Current game state
 * @param aiPosition - AI player's position
 * @returns Card to play
 */
export function decideCardToPlay(gameState: GameState, aiPosition: PlayerPosition): Card {
  const player = gameState.players[aiPosition];
  const trumpSuit = gameState.trumpSuit!;
  const isLeading = gameState.currentTrick.cards.length === 0;
  
  // Get all cards that can be legally played
  const playableCards = getPlayableCards(gameState, aiPosition);
  
  if (playableCards.length === 0) {
    // Shouldn't happen, but fallback to first card
    console.error('AI has no playable cards!');
    return player.hand[0];
  }
  
  if (playableCards.length === 1) {
    // Only one choice
    return playableCards[0];
  }
  
  // Score each playable card
  const scoredCards = playableCards.map((card: Card) => ({
    card,
    score: scoreCardForPlay(card, trumpSuit, isLeading),
  }));
  
  // Sort by score (descending)
  scoredCards.sort((a, b) => b.score - a.score);
  
  // Return highest scoring card
  return scoredCards[0].card;
}
