/**
 * @jest-environment node
 */

import { canPlayCard, canPlaceBid, canFold } from '../validation';
import { Card, Trick, Suit } from '../../../../shared/src/types/game';

describe('validation.ts - Move Validation', () => {
  describe('canPlayCard', () => {
    const trumpSuit: Suit = 'HEARTS';

    it('should allow any card when leading trick', () => {
      const hand: Card[] = [
        { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' },
        { suit: 'HEARTS', rank: 'KING', id: 'HEARTS_KING' },
      ];
      const emptyTrick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [],
        winner: null,
      };

      const result = canPlayCard(hand[0], hand, emptyTrick, trumpSuit, false);
      expect(result.valid).toBe(true);
    });

    it('should reject card play from folded player', () => {
      const hand: Card[] = [
        { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' },
      ];
      const emptyTrick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [],
        winner: null,
      };

      const result = canPlayCard(hand[0], hand, emptyTrick, trumpSuit, true);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('folded');
    });

    it('should reject card not in hand', () => {
      const hand: Card[] = [
        { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' },
      ];
      const notInHand: Card = { suit: 'HEARTS', rank: 'KING', id: 'HEARTS_KING' };
      const emptyTrick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [],
        winner: null,
      };

      const result = canPlayCard(notInHand, hand, emptyTrick, trumpSuit, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not in hand');
    });

    it('should allow card matching led suit', () => {
      const hand: Card[] = [
        { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' },
        { suit: 'SPADES', rank: 'KING', id: 'SPADES_KING' },
      ];
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'QUEEN', id: 'SPADES_QUEEN' }, playerPosition: 0 },
        ],
        winner: null,
      };

      const result = canPlayCard(hand[0], hand, trick, trumpSuit, false);
      expect(result.valid).toBe(true);
    });

    it('should reject off-suit when player has led suit', () => {
      const hand: Card[] = [
        { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' },
        { suit: 'CLUBS', rank: 'KING', id: 'CLUBS_KING' },
      ];
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'QUEEN', id: 'SPADES_QUEEN' }, playerPosition: 0 },
        ],
        winner: null,
      };

      const result = canPlayCard(hand[1], hand, trick, trumpSuit, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('follow suit');
    });

    it('should allow off-suit when player has no led suit', () => {
      const hand: Card[] = [
        { suit: 'CLUBS', rank: 'ACE', id: 'CLUBS_ACE' },
        { suit: 'CLUBS', rank: 'KING', id: 'CLUBS_KING' },
      ];
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'SPADES', rank: 'QUEEN', id: 'SPADES_QUEEN' }, playerPosition: 0 },
        ],
        winner: null,
      };

      const result = canPlayCard(hand[0], hand, trick, trumpSuit, false);
      expect(result.valid).toBe(true);
    });

    it('should treat Left Bower as trump for follow suit', () => {
      const hand: Card[] = [
        { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' }, // Left Bower (trump)
        { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' },
      ];
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' }, playerPosition: 0 }, // Trump led
        ],
        winner: null,
      };

      // Player has Left Bower (trump), so must play it
      const result = canPlayCard(hand[1], hand, trick, trumpSuit, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('follow suit');
    });

    it('should allow Left Bower when trump led', () => {
      const hand: Card[] = [
        { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' }, // Left Bower
      ];
      const trick: Trick = {
        number: 1,
        leadPlayerPosition: 0,
        cards: [
          { card: { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' }, playerPosition: 0 },
        ],
        winner: null,
      };

      const result = canPlayCard(hand[0], hand, trick, trumpSuit, false);
      expect(result.valid).toBe(true);
    });
  });

  describe('canPlaceBid', () => {
    it('should allow PASS when no one has passed yet', () => {
      const result = canPlaceBid('PASS', null, false, false);
      expect(result.valid).toBe(true);
    });

    it('should reject bid after player already passed', () => {
      const result = canPlaceBid(2, null, true, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Already passed');
    });

    it('should allow PASS even when all others have passed (Buck Euchre rule)', () => {
      const result = canPlaceBid('PASS', null, false, true);
      expect(result.valid).toBe(true);
      // In Buck Euchre, if all players pass, the hand is over and deal moves to next player
    });

    it('should allow valid bid higher than current', () => {
      const result = canPlaceBid(4, 3, false, false);
      expect(result.valid).toBe(true);
    });

    it('should reject bid equal to current', () => {
      const result = canPlaceBid(3, 3, false, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('higher than');
    });

    it('should reject bid lower than current', () => {
      const result = canPlaceBid(2, 3, false, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('higher than');
    });

    it('should reject bid below minimum (2)', () => {
      const result = canPlaceBid(1, null, false, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('between 2 and 5');
    });

    it('should reject bid above maximum (5)', () => {
      const result = canPlaceBid(6, null, false, false);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('between 2 and 5');
    });

    it('should allow first bid of 2', () => {
      const result = canPlaceBid(2, null, false, false);
      expect(result.valid).toBe(true);
    });

    it('should allow maximum bid of 5', () => {
      const result = canPlaceBid(5, 4, false, false);
      expect(result.valid).toBe(true);
    });
  });

  describe('canFold', () => {
    it('should allow non-bidder to fold when not Clubs', () => {
      const result = canFold(false, false, 'UNDECIDED', true);
      expect(result.valid).toBe(true);
    });

    it('should reject fold when Clubs turned up', () => {
      const result = canFold(true, false, 'UNDECIDED', true);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Clubs turned up');
    });

    it('should reject fold when player is bidder', () => {
      const result = canFold(false, true, 'UNDECIDED', true);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Bidder cannot fold');
    });

    it('should reject fold when both Clubs and bidder', () => {
      const result = canFold(true, true, 'UNDECIDED', true);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Bidder cannot fold');
    });

    it('should allow stay response even when Clubs are turned up', () => {
      const result = canFold(true, false, 'UNDECIDED', false);
      expect(result.valid).toBe(true);
    });

    it('should reject second decision once recorded', () => {
      const result = canFold(false, false, 'STAY', true);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already');
    });
  });
});
