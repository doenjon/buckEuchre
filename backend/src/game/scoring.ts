/**
 * @module game/scoring
 * @description Scoring logic for Buck Euchre
 * 
 * All functions in this module are pure (no I/O, no mutations, no side effects)
 */

import { Player, PlayerPosition } from '../../../shared/src/types/game';

/**
 * Calculates score changes for all players at end of round
 * 
 * Scoring Rules:
 * - Folded players: 0 (no change)
 * - Bidder made contract (tricksTaken >= bid): -tricksTaken
 * - Bidder failed contract: +5
 * - Non-bidder took 1+ tricks: -tricksTaken
 * - Non-bidder took 0 tricks: +5 (got set)
 * 
 * Special case - Clubs Turn-Up:
 * - When clubs is turned up, there is NO bidder (bidding is skipped)
 * - ALL players are scored as non-bidders
 * 
 * Lower scores are better (race to 0 or below)
 * 
 * @param players - Array of 4 players
 * @param winningBidderPosition - Position of the player who won bidding (null for clubs turn-up)
 * @param bid - The bid amount (2-5)
 * @param isClubsTurnUp - Whether clubs was turned up (no bidder scenario)
 * @returns Record mapping position to score change
 */
export function calculateRoundScores(
  players: Player[],
  winningBidderPosition: PlayerPosition | null,
  bid: number,
  isClubsTurnUp: boolean = false
): Record<number, number> {
  const scores: Record<number, number> = {};

  // Validation: ensure bid is valid when not dirty clubs
  if (!isClubsTurnUp && (bid === null || bid === undefined || bid < 2 || bid > 5)) {
    throw new Error(`Invalid bid amount: ${bid}. Must be between 2 and 5.`);
  }

  // Validation: ensure winningBidderPosition is valid when not dirty clubs
  if (!isClubsTurnUp && (winningBidderPosition === null || winningBidderPosition === undefined)) {
    throw new Error('winningBidderPosition cannot be null for normal bidding');
  }

  for (let i = 0; i < 4; i++) {
    const player = players[i];

    // Check 1: Folded players always get 0
    if (player.folded === true) {
      // Folded players get 0 score change
      scores[i] = 0;
      continue;
    }

    // Check 2: Dirty Clubs (clubs turn-up) - ALL players scored as non-bidders
    if (isClubsTurnUp === true) {
      // DIRTY CLUBS: ALL players are scored as non-bidders
      // Win 1+ tricks to avoid getting bucked
      if (player.tricksTaken >= 1) {
        // Took tricks: score DECREASES (good)
        scores[i] = -player.tricksTaken;
      } else {
        // Took no tricks: score INCREASES by 5 (bad - got set)
        scores[i] = 5;
      }
      continue;
    }

    // Check 3: Normal bidding - check if this player is the bidder
    if (i === winningBidderPosition) {
      // NORMAL BIDDING: This player is the bidder
      const bidderTricks = player.tricksTaken;
      if (bidderTricks >= bid) {
        // Made contract: subtract tricks actually taken
        scores[i] = -bidderTricks;
      } else {
        // Failed contract: score INCREASES by 5 (bad - got euchred)
        scores[i] = 5;
      }
      continue;
    }

    // Check 4: Normal bidding - non-bidder who stayed in
    // NORMAL BIDDING: Non-bidder who stayed in
    if (player.tricksTaken >= 1) {
      // Took tricks: score DECREASES (good)
      scores[i] = -player.tricksTaken;
    } else {
      // Took no tricks: score INCREASES by 5 (bad - got set)
      scores[i] = 5;
    }
  }

  return scores;
}

/**
 * Checks if any player has won the game
 * 
 * Win condition: First player to reach 0 or below
 * If multiple players at/below 0, lowest score wins
 * 
 * @param players - Array of 4 players
 * @returns Object with winner position and gameOver flag
 */
export function checkWinCondition(players: Player[]): {
  winner: PlayerPosition | null;
  gameOver: boolean;
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
