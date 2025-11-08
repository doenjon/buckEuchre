/**
 * ELO Rating Calculator for Arena Matches
 *
 * Implements ELO rating updates for 4-player games.
 * Uses pairwise comparison: each player is compared against all other players.
 *
 * For each pair of players:
 * - Higher score = win (1 point)
 * - Equal score = draw (0.5 points)
 * - Lower score = loss (0 points)
 *
 * Each player's rating change is the sum of all pairwise rating changes.
 */

import type { MatchResult, EloUpdate } from './types';

/**
 * ELO K-factor (determines how much ratings change per game)
 * Higher K = more volatile ratings, faster adaptation
 * Lower K = more stable ratings, slower adaptation
 *
 * Typical values:
 * - 32: Standard for chess
 * - 40: For newer players
 * - 16: For established players
 */
const K_FACTOR = 32;

/**
 * Calculate expected score for a player against an opponent
 *
 * Uses the standard ELO formula:
 * E = 1 / (1 + 10^((opponent_rating - player_rating) / 400))
 *
 * @param playerRating - Current rating of the player
 * @param opponentRating - Current rating of the opponent
 * @returns Expected score (0 to 1)
 */
function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate actual score for a player against an opponent
 *
 * @param playerScore - Final game score of the player
 * @param opponentScore - Final game score of the opponent
 * @returns Actual score: 1 (win), 0.5 (draw), 0 (loss)
 */
function calculateActualScore(playerScore: number, opponentScore: number): number {
  if (playerScore > opponentScore) return 1; // Win
  if (playerScore === opponentScore) return 0.5; // Draw
  return 0; // Loss
}

/**
 * Calculate ELO rating change for a player against a single opponent
 *
 * @param playerRating - Current rating of the player
 * @param opponentRating - Current rating of the opponent
 * @param actualScore - Actual score (1, 0.5, or 0)
 * @returns Rating change (positive or negative)
 */
function calculatePairwiseRatingChange(
  playerRating: number,
  opponentRating: number,
  actualScore: number
): number {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);
  return K_FACTOR * (actualScore - expectedScore);
}

/**
 * Calculate ELO rating updates for all players in a 4-player match
 *
 * Uses pairwise comparison: each player is rated against all 3 opponents.
 * The total rating change is the sum of all 3 pairwise changes.
 *
 * @param results - Match results with current ratings and final scores
 * @param currentRatings - Map of configId to current ELO rating
 * @returns Array of ELO updates for each player
 */
export function calculateEloUpdates(
  results: MatchResult[],
  currentRatings: Map<string, number>
): EloUpdate[] {
  if (results.length !== 4) {
    throw new Error('ELO calculation requires exactly 4 players');
  }

  const updates: EloUpdate[] = [];

  // Calculate rating changes for each player
  for (const player of results) {
    const playerRating = currentRatings.get(player.configId);
    if (playerRating === undefined) {
      throw new Error(`No rating found for config ${player.configId}`);
    }

    let totalRatingChange = 0;

    // Compare against each opponent
    for (const opponent of results) {
      if (opponent.configId === player.configId) continue;

      const opponentRating = currentRatings.get(opponent.configId);
      if (opponentRating === undefined) {
        throw new Error(`No rating found for config ${opponent.configId}`);
      }

      const actualScore = calculateActualScore(player.finalScore, opponent.finalScore);
      const ratingChange = calculatePairwiseRatingChange(
        playerRating,
        opponentRating,
        actualScore
      );

      totalRatingChange += ratingChange;
    }

    const newRating = playerRating + totalRatingChange;

    updates.push({
      configId: player.configId,
      oldRating: playerRating,
      newRating,
      change: totalRatingChange,
    });
  }

  return updates;
}

/**
 * Get expected win probability for a player against the field
 *
 * Useful for matchmaking and displaying odds.
 * Returns probability of finishing in 1st place.
 *
 * This is a simplified approximation - actual probability depends on
 * the complex interactions in a 4-player game.
 *
 * @param playerRating - Player's ELO rating
 * @param opponentRatings - Array of 3 opponent ratings
 * @returns Estimated win probability (0 to 1)
 */
export function calculateWinProbability(
  playerRating: number,
  opponentRatings: number[]
): number {
  if (opponentRatings.length !== 3) {
    throw new Error('Win probability requires exactly 3 opponents');
  }

  // Calculate expected score against each opponent
  const expectedScores = opponentRatings.map((opponentRating) =>
    calculateExpectedScore(playerRating, opponentRating)
  );

  // Average expected score (0 to 1)
  const avgExpectedScore = expectedScores.reduce((sum, score) => sum + score, 0) / 3;

  // This is a rough approximation - the player with higher expected score
  // is more likely to win, but it's not exact for 4-player games
  return avgExpectedScore;
}

/**
 * Find configs within a rating range for matchmaking
 *
 * @param targetRating - The rating to match against
 * @param allRatings - Map of all configs to their ratings
 * @param range - Maximum rating difference (default: 200)
 * @returns Array of config IDs within range, sorted by rating proximity
 */
export function findSimilarRatings(
  targetRating: number,
  allRatings: Map<string, number>,
  range: number = 200
): string[] {
  const similar: { configId: string; diff: number }[] = [];

  for (const [configId, rating] of allRatings.entries()) {
    const diff = Math.abs(rating - targetRating);
    if (diff <= range) {
      similar.push({ configId, diff });
    }
  }

  // Sort by proximity (closest first)
  similar.sort((a, b) => a.diff - b.diff);

  return similar.map((entry) => entry.configId);
}
