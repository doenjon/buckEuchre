/**
 * @jest-environment node
 */

import { calculateRoundScores, checkWinCondition } from '../scoring';
import { Player, PlayerPosition } from '../../../../shared/src/types/game';

describe('scoring.ts - Scoring Logic', () => {
  const createPlayer = (position: PlayerPosition, tricksTaken: number, folded: boolean): Player => ({
    id: `player${position}`,
    name: `Player ${position}`,
    position,
    score: 15,
    connected: true,
    hand: [],
    tricksTaken,
    folded,
    foldDecision: folded ? 'FOLD' : 'STAY',
  });

  describe('calculateRoundScores', () => {
    it('should score bidder correctly when making contract', () => {
      const players = [
        createPlayer(0, 3, false), // Bidder
        createPlayer(1, 1, false),
        createPlayer(2, 1, false),
        createPlayer(3, 0, false),
      ];

      const scores = calculateRoundScores(players, 0, 3);
      expect(scores[0]).toBe(-3); // Bidder made contract, took 3
    });

    it('should score bidder correctly when failing contract (euchred)', () => {
      const players = [
        createPlayer(0, 2, false), // Bidder
        createPlayer(1, 2, false),
        createPlayer(2, 1, false),
        createPlayer(3, 0, false),
      ];

      const scores = calculateRoundScores(players, 0, 3);
      expect(scores[0]).toBe(5); // Bidder failed contract (took 2, needed 3)
    });

    it('should score non-bidders correctly when taking tricks', () => {
      const players = [
        createPlayer(0, 3, false), // Bidder
        createPlayer(1, 1, false),
        createPlayer(2, 1, false),
        createPlayer(3, 0, false),
      ];

      const scores = calculateRoundScores(players, 0, 3);
      expect(scores[1]).toBe(-1); // Took 1 trick
      expect(scores[2]).toBe(-1); // Took 1 trick
      expect(scores[3]).toBe(5);  // Took 0 tricks (got set)
    });

    it('should score folded players as 0', () => {
      const players = [
        createPlayer(0, 5, false), // Bidder took all tricks
        createPlayer(1, 0, true),  // Folded
        createPlayer(2, 0, true),  // Folded
        createPlayer(3, 0, true),  // Folded
      ];

      const scores = calculateRoundScores(players, 0, 3);
      expect(scores[0]).toBe(-5); // Bidder took all 5
      expect(scores[1]).toBe(0);  // Folded
      expect(scores[2]).toBe(0);  // Folded
      expect(scores[3]).toBe(0);  // Folded
    });

    it('should handle bidder taking more tricks than bid', () => {
      const players = [
        createPlayer(0, 4, false), // Bidder
        createPlayer(1, 1, false),
        createPlayer(2, 0, false),
        createPlayer(3, 0, false),
      ];

      const scores = calculateRoundScores(players, 0, 2);
      expect(scores[0]).toBe(-4); // Still scores tricks taken, not bid amount
    });

    it('should handle all non-bidders folded scenario', () => {
      const players = [
        createPlayer(0, 5, false), // Bidder
        createPlayer(1, 0, true),
        createPlayer(2, 0, true),
        createPlayer(3, 0, true),
      ];

      const scores = calculateRoundScores(players, 0, 4);
      expect(scores[0]).toBe(-5);
      expect(scores[1]).toBe(0);
      expect(scores[2]).toBe(0);
      expect(scores[3]).toBe(0);
    });

    it('should handle minimum bid (2) correctly', () => {
      const players = [
        createPlayer(0, 2, false), // Bidder
        createPlayer(1, 2, false),
        createPlayer(2, 1, false),
        createPlayer(3, 0, false),
      ];

      const scores = calculateRoundScores(players, 0, 2);
      expect(scores[0]).toBe(-2); // Made contract
      expect(scores[1]).toBe(-2);
      expect(scores[2]).toBe(-1);
      expect(scores[3]).toBe(5);
    });

    it('should handle maximum bid (5) correctly', () => {
      const players = [
        createPlayer(0, 5, false), // Bidder took all
        createPlayer(1, 0, true),
        createPlayer(2, 0, true),
        createPlayer(3, 0, true),
      ];

      const scores = calculateRoundScores(players, 0, 5);
      expect(scores[0]).toBe(-5); // Made contract
    });

    describe('Clubs Turn-Up (No Bidder) Scenario', () => {
      it('should score all players as non-bidders when clubs is turned up', () => {
        const players = [
          createPlayer(0, 2, false), // Would be "bidder" position but clubs turned up
          createPlayer(1, 2, false),
          createPlayer(2, 1, false),
          createPlayer(3, 0, false),
        ];

        // When isClubsTurnUp is true, player 0 should NOT be treated as bidder
        const scores = calculateRoundScores(players, 0, 2, true);
        expect(scores[0]).toBe(-2); // Scored as non-bidder (not euchred)
        expect(scores[1]).toBe(-2);
        expect(scores[2]).toBe(-1);
        expect(scores[3]).toBe(5); // Got set (0 tricks)
      });

      it('should NOT euchre player with 1 trick when clubs is turned up', () => {
        const players = [
          createPlayer(0, 1, false), // Would fail contract if treated as bidder
          createPlayer(1, 2, false),
          createPlayer(2, 2, false),
          createPlayer(3, 0, false),
        ];

        // This is the bug fix: player 0 gets -1, not +5
        const scores = calculateRoundScores(players, 0, 2, true);
        expect(scores[0]).toBe(-1); // Non-bidder scoring (NOT euchred)
        expect(scores[1]).toBe(-2);
        expect(scores[2]).toBe(-2);
        expect(scores[3]).toBe(5);
      });

      it('should score all players taking tricks as -tricksTaken when clubs turned up', () => {
        const players = [
          createPlayer(0, 1, false),
          createPlayer(1, 1, false),
          createPlayer(2, 2, false),
          createPlayer(3, 1, false),
        ];

        const scores = calculateRoundScores(players, null, 2, true);
        expect(scores[0]).toBe(-1);
        expect(scores[1]).toBe(-1);
        expect(scores[2]).toBe(-2);
        expect(scores[3]).toBe(-1);
      });

      it('should still penalize players with 0 tricks when clubs turned up', () => {
        const players = [
          createPlayer(0, 3, false),
          createPlayer(1, 2, false),
          createPlayer(2, 0, false), // Got set
          createPlayer(3, 0, false), // Got set
        ];

        const scores = calculateRoundScores(players, null, 2, true);
        expect(scores[0]).toBe(-3);
        expect(scores[1]).toBe(-2);
        expect(scores[2]).toBe(5); // Got set penalty
        expect(scores[3]).toBe(5); // Got set penalty
      });
    });
  });

  describe('checkWinCondition', () => {
    it('should return no winner when all scores above 0', () => {
      const players = [
        { ...createPlayer(0, 0, false), score: 10 },
        { ...createPlayer(1, 0, false), score: 8 },
        { ...createPlayer(2, 0, false), score: 12 },
        { ...createPlayer(3, 0, false), score: 5 },
      ];

      const result = checkWinCondition(players);
      expect(result.winner).toBeNull();
      expect(result.gameOver).toBe(false);
    });

    it('should return winner when one player reaches 0', () => {
      const players = [
        { ...createPlayer(0, 0, false), score: 10 },
        { ...createPlayer(1, 0, false), score: 0 },
        { ...createPlayer(2, 0, false), score: 12 },
        { ...createPlayer(3, 0, false), score: 5 },
      ];

      const result = checkWinCondition(players);
      expect(result.winner).toBe(1);
      expect(result.gameOver).toBe(true);
    });

    it('should return winner when one player goes negative', () => {
      const players = [
        { ...createPlayer(0, 0, false), score: 10 },
        { ...createPlayer(1, 0, false), score: -2 },
        { ...createPlayer(2, 0, false), score: 12 },
        { ...createPlayer(3, 0, false), score: 5 },
      ];

      const result = checkWinCondition(players);
      expect(result.winner).toBe(1);
      expect(result.gameOver).toBe(true);
    });

    it('should return lowest score when multiple at or below 0', () => {
      const players = [
        { ...createPlayer(0, 0, false), score: 0 },
        { ...createPlayer(1, 0, false), score: -3 },
        { ...createPlayer(2, 0, false), score: 12 },
        { ...createPlayer(3, 0, false), score: -1 },
      ];

      const result = checkWinCondition(players);
      expect(result.winner).toBe(1); // Lowest score (-3)
      expect(result.gameOver).toBe(true);
    });

    it('should handle all players at exactly 0', () => {
      const players = [
        { ...createPlayer(0, 0, false), score: 0 },
        { ...createPlayer(1, 0, false), score: 0 },
        { ...createPlayer(2, 0, false), score: 0 },
        { ...createPlayer(3, 0, false), score: 0 },
      ];

      const result = checkWinCondition(players);
      expect(result.winner).toBe(0); // First player at 0
      expect(result.gameOver).toBe(true);
    });

    it('should handle edge case of very negative score', () => {
      const players = [
        { ...createPlayer(0, 0, false), score: 10 },
        { ...createPlayer(1, 0, false), score: -100 },
        { ...createPlayer(2, 0, false), score: 12 },
        { ...createPlayer(3, 0, false), score: -5 },
      ];

      const result = checkWinCondition(players);
      expect(result.winner).toBe(1); // Lowest score
      expect(result.gameOver).toBe(true);
    });
  });
});
