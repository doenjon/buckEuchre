/**
 * @jest-environment node
 */

import { determineTrickWinner } from '../trick.js';
import { Trick, Card, Suit, PlayerPosition } from '../../../../shared/src/types/game.js';

describe('trick.ts - Trick Evaluation', () => {
  const trumpSuit: Suit = 'HEARTS';
  const activePlayers: PlayerPosition[] = [0, 1, 2, 3];

  describe('determineTrickWinner', () => {
    it('should throw error for empty trick', () => {
      const emptyTrick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [],
        winner: null,
      };

      expect(() => determineTrickWinner(emptyTrick, trumpSuit, activePlayers)).toThrow();
    });

    it('should throw error when no active players', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 0 },
        ],
        winner: null,
      };

      expect(() => determineTrickWinner(trick, trumpSuit, [])).toThrow();
    });

    it('should return only player when single card played', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 0 },
        ],
        winner: null,
      };

      const winner = determineTrickWinner(trick, trumpSuit, [0]);
      expect(winner).toBe(0);
    });

    it('should have trump win over non-trump', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 0 },
          { card: { suit: 'HEARTS', rank: '9', id: 'HEARTS_9' }, playerPosition: 1 }, // Trump
          { card: { suit: 'SPADES', rank: 'KING', id: 'SPADES_KING' }, playerPosition: 2 },
        ],
        winner: null,
      };

      const winner = determineTrickWinner(trick, trumpSuit, [0, 1, 2]);
      expect(winner).toBe(1); // Player with trump
    });

    it('should have Right Bower win all', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' }, playerPosition: 0 },
          { card: { suit: 'HEARTS', rank: 'JACK', id: 'HEARTS_JACK' }, playerPosition: 1 }, // Right Bower
          { card: { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' }, playerPosition: 2 }, // Left Bower
        ],
        winner: null,
      };

      const winner = determineTrickWinner(trick, trumpSuit, [0, 1, 2]);
      expect(winner).toBe(1); // Right Bower
    });

    it('should have Left Bower beat other trump', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' }, playerPosition: 0 },
          { card: { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' }, playerPosition: 1 }, // Left Bower
          { card: { suit: 'HEARTS', rank: 'KING', id: 'HEARTS_KING' }, playerPosition: 2 },
        ],
        winner: null,
      };

      const winner = determineTrickWinner(trick, trumpSuit, [0, 1, 2]);
      expect(winner).toBe(1); // Left Bower
    });

    it('should have led suit win when no trump played', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'KING', id: 'SPADES_KING' }, playerPosition: 0 },
          { card: { suit: 'CLUBS', rank: 'ACE', id: 'CLUBS_ACE' }, playerPosition: 1 },
          { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 2 },
        ],
        winner: null,
      };

      const winner = determineTrickWinner(trick, trumpSuit, [0, 1, 2]);
      expect(winner).toBe(2); // Ace of led suit
    });

    it('should ignore folded players', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: '9', id: 'SPADES_9' }, playerPosition: 0 },
          { card: { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' }, playerPosition: 1 }, // Trump
          { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 2 }, // Folded
        ],
        winner: null,
      };

      // Player 2 is folded, so their card doesn't count
      const winner = determineTrickWinner(trick, trumpSuit, [0, 1]);
      expect(winner).toBe(1); // Player 1 wins with trump
    });

    it('should handle full 4-player trick', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'KING', id: 'SPADES_KING' }, playerPosition: 0 },
          { card: { suit: 'SPADES', rank: '10', id: 'SPADES_10' }, playerPosition: 1 },
          { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 2 },
          { card: { suit: 'CLUBS', rank: 'ACE', id: 'CLUBS_ACE' }, playerPosition: 3 },
        ],
        winner: null,
      };

      const winner = determineTrickWinner(trick, trumpSuit, activePlayers);
      expect(winner).toBe(2); // Ace of led suit
    });

    it('should handle trick with some folded players', () => {
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'KING', id: 'SPADES_KING' }, playerPosition: 0 },
          { card: { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' }, playerPosition: 2 },
        ],
        winner: null,
      };

      // Players 1 and 3 folded
      const winner = determineTrickWinner(trick, trumpSuit, [0, 2]);
      expect(winner).toBe(2); // Ace wins
    });
  });
});
