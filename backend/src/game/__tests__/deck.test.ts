/**
 * @jest-environment node
 */

import { createDeck, shuffleDeck, dealCards, getEffectiveSuit, isSameColor } from '../deck';
import { Card, Suit } from '../../../../shared/src/types/game';
import { DECK_SIZE, CARDS_PER_PLAYER, BLIND_SIZE, PLAYER_COUNT } from '../../../../shared/src/constants/cards';

describe('deck.ts - Deck Operations', () => {
  describe('createDeck', () => {
    it('should create a 24-card deck', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(DECK_SIZE);
    });

    it('should have all unique card IDs', () => {
      const deck = createDeck();
      const ids = deck.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(DECK_SIZE);
    });

    it('should have 6 cards per suit', () => {
      const deck = createDeck();
      const suits = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as Suit[];
      
      suits.forEach(suit => {
        const cardsOfSuit = deck.filter(c => c.suit === suit);
        expect(cardsOfSuit).toHaveLength(6);
      });
    });

    it('should have all ranks (9, 10, J, Q, K, A)', () => {
      const deck = createDeck();
      const ranks = ['9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'];
      
      ranks.forEach(rank => {
        const cardsOfRank = deck.filter(c => c.rank === rank);
        expect(cardsOfRank).toHaveLength(4); // One per suit
      });
    });
  });

  describe('shuffleDeck', () => {
    it('should return deck with same length', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled).toHaveLength(DECK_SIZE);
    });

    it('should not mutate original deck', () => {
      const deck = createDeck();
      const originalFirst = deck[0];
      const shuffled = shuffleDeck(deck);
      expect(deck[0]).toEqual(originalFirst);
      expect(deck).not.toBe(shuffled);
    });

    it('should contain all original cards', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);
      
      deck.forEach(card => {
        expect(shuffled.some(c => c.id === card.id)).toBe(true);
      });
    });

    it('should randomize order (probabilistic test)', () => {
      const deck = createDeck();
      const shuffled1 = shuffleDeck(deck);
      const shuffled2 = shuffleDeck(deck);
      
      // Very unlikely to get same order twice
      const sameOrder = shuffled1.every((c, i) => c.id === shuffled2[i].id);
      expect(sameOrder).toBe(false);
    });
  });

  describe('dealCards', () => {
    it('should deal 5 cards to each player', () => {
      const deck = shuffleDeck(createDeck());
      const { hands } = dealCards(deck);
      
      expect(hands).toHaveLength(PLAYER_COUNT);
      hands.forEach(hand => {
        expect(hand).toHaveLength(CARDS_PER_PLAYER);
      });
    });

    it('should put 4 cards in blind', () => {
      const deck = shuffleDeck(createDeck());
      const { blind } = dealCards(deck);
      
      expect(blind).toHaveLength(BLIND_SIZE);
    });

    it('should deal all 24 cards', () => {
      const deck = shuffleDeck(createDeck());
      const { hands, blind } = dealCards(deck);
      
      const totalCards = hands.flat().length + blind.length;
      expect(totalCards).toBe(DECK_SIZE);
    });

    it('should deal unique cards (no duplicates)', () => {
      const deck = shuffleDeck(createDeck());
      const { hands, blind } = dealCards(deck);
      
      const allCards = [...hands.flat(), ...blind];
      const uniqueIds = new Set(allCards.map(c => c.id));
      expect(uniqueIds.size).toBe(DECK_SIZE);
    });

    it('should throw error for invalid deck size', () => {
      const invalidDeck = createDeck().slice(0, 20);
      expect(() => dealCards(invalidDeck)).toThrow();
    });
  });

  describe('getEffectiveSuit', () => {
    it('should return original suit for non-Jacks', () => {
      const card: Card = { suit: 'HEARTS', rank: 'ACE', id: 'HEARTS_ACE' };
      expect(getEffectiveSuit(card, 'SPADES')).toBe('HEARTS');
    });

    it('should return original suit for Right Bower', () => {
      const card: Card = { suit: 'HEARTS', rank: 'JACK', id: 'HEARTS_JACK' };
      expect(getEffectiveSuit(card, 'HEARTS')).toBe('HEARTS');
    });

    it('should return trump suit for Left Bower (Spades trump, Clubs Jack)', () => {
      const card: Card = { suit: 'CLUBS', rank: 'JACK', id: 'CLUBS_JACK' };
      expect(getEffectiveSuit(card, 'SPADES')).toBe('SPADES');
    });

    it('should return trump suit for Left Bower (Hearts trump, Diamonds Jack)', () => {
      const card: Card = { suit: 'DIAMONDS', rank: 'JACK', id: 'DIAMONDS_JACK' };
      expect(getEffectiveSuit(card, 'HEARTS')).toBe('HEARTS');
    });

    it('should return trump suit for Left Bower (Diamonds trump, Hearts Jack)', () => {
      const card: Card = { suit: 'HEARTS', rank: 'JACK', id: 'HEARTS_JACK' };
      expect(getEffectiveSuit(card, 'DIAMONDS')).toBe('DIAMONDS');
    });

    it('should return trump suit for Left Bower (Clubs trump, Spades Jack)', () => {
      const card: Card = { suit: 'SPADES', rank: 'JACK', id: 'SPADES_JACK' };
      expect(getEffectiveSuit(card, 'CLUBS')).toBe('CLUBS');
    });

    it('should not treat Jack as Left Bower if wrong color', () => {
      const card: Card = { suit: 'HEARTS', rank: 'JACK', id: 'HEARTS_JACK' };
      expect(getEffectiveSuit(card, 'SPADES')).toBe('HEARTS'); // Different color
    });
  });

  describe('isSameColor', () => {
    it('should return true for both black suits', () => {
      expect(isSameColor('SPADES', 'CLUBS')).toBe(true);
      expect(isSameColor('CLUBS', 'SPADES')).toBe(true);
    });

    it('should return true for both red suits', () => {
      expect(isSameColor('HEARTS', 'DIAMONDS')).toBe(true);
      expect(isSameColor('DIAMONDS', 'HEARTS')).toBe(true);
    });

    it('should return true for same suit', () => {
      expect(isSameColor('HEARTS', 'HEARTS')).toBe(true);
      expect(isSameColor('SPADES', 'SPADES')).toBe(true);
    });

    it('should return false for different colors', () => {
      expect(isSameColor('HEARTS', 'SPADES')).toBe(false);
      expect(isSameColor('DIAMONDS', 'CLUBS')).toBe(false);
      expect(isSameColor('SPADES', 'HEARTS')).toBe(false);
      expect(isSameColor('CLUBS', 'DIAMONDS')).toBe(false);
    });
  });
});
