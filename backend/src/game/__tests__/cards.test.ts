/**
 * @jest-environment node
 */

import { getRankValue, isHigherCard } from '../cards';
import { Card, Suit } from '../../../../shared/src/types/game';

describe('cards.ts - Card Ranking & Comparison', () => {
  describe('getRankValue', () => {
    describe('Trump suit rankings', () => {
      const trumpSuit: Suit = 'HEARTS';

      it('should rank Right Bower (Jack of trump) highest', () => {
        const rightBower: Card = { suit: 'HEARTS', rank: 'JACK', id: 'HEARTS_JACK' };
        expect(getRankValue(rightBower, trumpSuit, 'HEARTS')).toBe(7);
      });

      it('should rank Left Bower (Jack of same color) second highest', () => {
        const leftBower: Card = { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' };
        expect(getRankValue(leftBower, trumpSuit, 'HEARTS')).toBe(6);
      });

      it('should rank Ace of trump third', () => {
        const ace: Card = { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' };
        expect(getRankValue(ace, trumpSuit, 'HEARTS')).toBe(5);
      });

      it('should rank King of trump fourth', () => {
        const king: Card = { suit: 'HEARTS', rank: 'KING', id: 'HEARTS_KING' };
        expect(getRankValue(king, trumpSuit, 'HEARTS')).toBe(4);
      });

      it('should rank trump cards correctly: Right > Left > A > K > Q > 10 > 9', () => {
        const cards = [
          { card: { suit: 'HEARTS', rank: 'JACK', id: 'HEARTS_JACK' }, expected: 7 },
          { card: { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' }, expected: 6 },
          { card: { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' }, expected: 5 },
          { card: { suit: 'HEARTS', rank: 'KING', id: 'HEARTS_KING' }, expected: 4 },
          { card: { suit: 'HEARTS', rank: 'QUEEN', id: 'HEARTS_QUEEN' }, expected: 3 },
          { card: { suit: 'HEARTS', rank: '10', id: 'HEARTS_10' }, expected: 2 },
          { card: { suit: 'HEARTS', rank: '9', id: 'HEARTS_9' }, expected: 1 },
        ];

        cards.forEach(({ card, expected }) => {
          const effectiveSuit = card.suit === 'DIAMONDS' ? 'HEARTS' : card.suit;
          expect(getRankValue(card as Card, trumpSuit, effectiveSuit as Suit)).toBe(expected);
        });
      });
    });

    describe('Non-trump suit rankings', () => {
      const trumpSuit: Suit = 'HEARTS';

      it('should rank non-trump Ace highest', () => {
        const ace: Card = { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' };
        expect(getRankValue(ace, trumpSuit, 'SPADES')).toBe(6);
      });

      it('should rank non-trump cards correctly: A > K > Q > J > 10 > 9', () => {
        const cards = [
          { rank: 'ACE', expected: 6 },
          { rank: 'KING', expected: 5 },
          { rank: 'QUEEN', expected: 4 },
          { rank: 'JACK', expected: 3 },
          { rank: '10', expected: 2 },
          { rank: '9', expected: 1 },
        ];

        cards.forEach(({ rank, expected }) => {
          const card: Card = { suit: 'SPADES', rank: rank as any, id: `SPADES_${rank}` };
          expect(getRankValue(card, trumpSuit, 'SPADES')).toBe(expected);
        });
      });
    });
  });

  describe('isHigherCard', () => {
    const trumpSuit: Suit = 'HEARTS';
    const ledSuit: Suit = 'SPADES';

    describe('Trump vs Non-Trump', () => {
      it('should have trump beat non-trump', () => {
        const trump: Card = { suit: 'HEARTS', rank: '9', id: 'HEARTS_9' };
        const nonTrump: Card = { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' };
        
        expect(isHigherCard(trump, nonTrump, trumpSuit, ledSuit)).toBe(true);
      });

      it('should have non-trump lose to trump', () => {
        const nonTrump: Card = { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' };
        const trump: Card = { suit: 'HEARTS', rank: '9', id: 'HEARTS_9' };
        
        expect(isHigherCard(nonTrump, trump, trumpSuit, ledSuit)).toBe(false);
      });
    });

    describe('Trump rankings', () => {
      it('should have Right Bower beat all other cards', () => {
        const rightBower: Card = { suit: 'HEARTS', rank: 'JACK', id: 'HEARTS_JACK' };
        const leftBower: Card = { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' };
        const aceOfTrump: Card = { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' };
        
        expect(isHigherCard(rightBower, leftBower, trumpSuit, trumpSuit)).toBe(true);
        expect(isHigherCard(rightBower, aceOfTrump, trumpSuit, trumpSuit)).toBe(true);
      });

      it('should have Left Bower beat Ace of trump', () => {
        const leftBower: Card = { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' };
        const aceOfTrump: Card = { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' };
        
        expect(isHigherCard(leftBower, aceOfTrump, trumpSuit, trumpSuit)).toBe(true);
      });

      it('should have Ace of trump beat King of trump', () => {
        const ace: Card = { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' };
        const king: Card = { suit: 'HEARTS', rank: 'KING', id: 'HEARTS_KING' };
        
        expect(isHigherCard(ace, king, trumpSuit, trumpSuit)).toBe(true);
      });
    });

    describe('Same suit comparisons', () => {
      it('should compare ranks when both same non-trump suit', () => {
        const ace: Card = { suit: 'SPADES', rank: 'ACE', id: 'SPADES_ACE' };
        const king: Card = { suit: 'SPADES', rank: 'KING', id: 'SPADES_KING' };
        
        expect(isHigherCard(ace, king, trumpSuit, ledSuit)).toBe(true);
        expect(isHigherCard(king, ace, trumpSuit, ledSuit)).toBe(false);
      });
    });

    describe('Off-suit cards', () => {
      it('should have led suit beat off-suit', () => {
        const ledSuitCard: Card = { suit: 'SPADES', rank: '9', id: 'SPADES_9' };
        const offSuitCard: Card = { suit: 'CLUBS', rank: 'ACE', id: 'CLUBS_ACE' };
        
        expect(isHigherCard(ledSuitCard, offSuitCard, trumpSuit, ledSuit)).toBe(true);
      });

      it('should have off-suit lose to led suit', () => {
        const offSuitCard: Card = { suit: 'CLUBS', rank: 'ACE', id: 'CLUBS_ACE' };
        const ledSuitCard: Card = { suit: 'SPADES', rank: '9', id: 'SPADES_9' };
        
        expect(isHigherCard(offSuitCard, ledSuitCard, trumpSuit, ledSuit)).toBe(false);
      });

      it('should have two off-suit cards favor first played', () => {
        const first: Card = { suit: 'CLUBS', rank: 'ACE', id: 'CLUBS_ACE' };
        const second: Card = { suit: 'DIAMONDS', rank: 'ACE', id: 'DIAMONDS_ACE' };
        
        expect(isHigherCard(second, first, trumpSuit, ledSuit)).toBe(false);
      });
    });
  });
});
