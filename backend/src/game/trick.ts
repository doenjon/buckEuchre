/**
 * @module game/trick
 * @description Trick evaluation logic for Buck Euchre
 * 
 * All functions in this module are pure (no I/O, no mutations, no side effects)
 */

import { Trick, Suit, PlayerPosition } from '../../../shared/src/types/game.js';
import { getEffectiveSuit } from './deck.js';
import { isHigherCard } from './cards.js';

/**
 * Determines the winner of a completed trick
 * 
 * Algorithm:
 * 1. Start with first card as winner
 * 2. Get led suit from first card (considering Left Bower)
 * 3. Compare each subsequent card to current winner
 * 4. Only consider cards from players who haven't folded (activePlayers)
 * 5. Return position of winning player
 * 
 * @param trick - The completed trick
 * @param trumpSuit - The trump suit for this round
 * @param activePlayers - Array of player positions who haven't folded
 * @returns Position of the player who won the trick
 * @throws Error if trick is empty or incomplete
 */
export function determineTrickWinner(
  trick: Trick,
  trumpSuit: Suit,
  activePlayers: PlayerPosition[]
): PlayerPosition {
  if (trick.cards.length === 0) {
    throw new Error('Cannot determine winner of empty trick');
  }

  // Filter to only cards from active (non-folded) players
  const activeCards = trick.cards.filter(pc => 
    activePlayers.includes(pc.playerPosition)
  );

  if (activeCards.length === 0) {
    throw new Error('No active players in trick');
  }

  // Start with first card as winner
  let winningIndex = 0;
  let winningCard = activeCards[0].card;
  const ledSuit = getEffectiveSuit(activeCards[0].card, trumpSuit);

  // Compare each subsequent card
  for (let i = 1; i < activeCards.length; i++) {
    const card = activeCards[i].card;
    
    if (isHigherCard(card, winningCard, trumpSuit, ledSuit)) {
      winningIndex = i;
      winningCard = card;
    }
  }

  return activeCards[winningIndex].playerPosition;
}
