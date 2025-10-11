/**
 * @module components/__tests__/PlayerHand
 * @description Tests for PlayerHand component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerHand } from '../game/PlayerHand';
import type { Card } from '@buck-euchre/shared';

// Mock card data
const mockCards: Card[] = [
  { id: 'card-1', rank: 'ACE', suit: 'SPADES' },
  { id: 'card-2', rank: 'KING', suit: 'HEARTS' },
  { id: 'card-3', rank: 'QUEEN', suit: 'DIAMONDS' },
  { id: 'card-4', rank: 'JACK', suit: 'CLUBS' },
  { id: 'card-5', rank: '10', suit: 'SPADES' },
];

describe('PlayerHand Component', () => {
  describe('Rendering', () => {
    it('should render all cards in hand', () => {
      render(<PlayerHand cards={mockCards} />);
      
      const hand = screen.getByRole('group', { name: /Your hand: 5 cards/i });
      expect(hand).toBeInTheDocument();
      
      // Should render 5 cards
      const cards = screen.getAllByRole('button');
      expect(cards).toHaveLength(5);
    });

    it('should render empty state when no cards', () => {
      render(<PlayerHand cards={[]} />);
      
      expect(screen.getByRole('status', { name: /No cards in hand/i })).toBeInTheDocument();
      expect(screen.getByText(/No cards in hand/i)).toBeInTheDocument();
    });

    it('should render empty state when cards is undefined', () => {
      render(<PlayerHand cards={undefined as any} />);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should display correct card count in aria-label', () => {
      const { rerender } = render(<PlayerHand cards={mockCards.slice(0, 3)} />);
      expect(screen.getByRole('group', { name: /Your hand: 3 cards/i })).toBeInTheDocument();
      
      rerender(<PlayerHand cards={mockCards} />);
      expect(screen.getByRole('group', { name: /Your hand: 5 cards/i })).toBeInTheDocument();
    });

    it('should render cards in order', () => {
      render(<PlayerHand cards={mockCards} />);
      
      const cards = screen.getAllByRole('button');
      expect(cards[0]).toHaveAttribute('aria-label', expect.stringContaining('ACE'));
      expect(cards[1]).toHaveAttribute('aria-label', expect.stringContaining('KING'));
      expect(cards[2]).toHaveAttribute('aria-label', expect.stringContaining('QUEEN'));
      expect(cards[3]).toHaveAttribute('aria-label', expect.stringContaining('JACK'));
      expect(cards[4]).toHaveAttribute('aria-label', expect.stringContaining('10'));
    });
  });

  describe('Interactions', () => {
    it('should call onCardClick with card ID when card is clicked', async () => {
      const handleCardClick = vi.fn();
      render(<PlayerHand cards={mockCards} onCardClick={handleCardClick} />);
      
      const cards = screen.getAllByRole('button');
      await userEvent.click(cards[0]);
      
      expect(handleCardClick).toHaveBeenCalledTimes(1);
      expect(handleCardClick).toHaveBeenCalledWith('card-1');
    });

    it('should call onCardClick with correct card ID for each card', async () => {
      const handleCardClick = vi.fn();
      render(<PlayerHand cards={mockCards} onCardClick={handleCardClick} />);
      
      const cards = screen.getAllByRole('button');
      
      await userEvent.click(cards[2]); // Queen of Diamonds
      expect(handleCardClick).toHaveBeenLastCalledWith('card-3');
      
      await userEvent.click(cards[4]); // 10 of Spades
      expect(handleCardClick).toHaveBeenLastCalledWith('card-5');
    });

    it('should not be clickable when disabled', async () => {
      const handleCardClick = vi.fn();
      render(<PlayerHand cards={mockCards} onCardClick={handleCardClick} disabled={true} />);
      
      const cards = screen.getAllByRole('button');
      
      // Try clicking each card
      for (const card of cards) {
        expect(card).toBeDisabled();
      }
      
      await userEvent.click(cards[0]);
      expect(handleCardClick).not.toHaveBeenCalled();
    });

    it('should not be clickable when onCardClick is not provided', () => {
      render(<PlayerHand cards={mockCards} />);
      
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        expect(card).toBeDisabled();
      });
    });
  });

  describe('Selected State', () => {
    it('should highlight selected card', () => {
      render(<PlayerHand cards={mockCards} selectedCardId="card-2" />);
      
      const cards = screen.getAllByRole('button');
      expect(cards[1]).toHaveAttribute('aria-pressed', 'true');
      expect(cards[0]).toHaveAttribute('aria-pressed', 'false');
    });

    it('should update selected card when prop changes', () => {
      const { rerender } = render(
        <PlayerHand cards={mockCards} selectedCardId="card-1" />
      );
      
      let cards = screen.getAllByRole('button');
      expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
      
      rerender(<PlayerHand cards={mockCards} selectedCardId="card-3" />);
      
      cards = screen.getAllByRole('button');
      expect(cards[0]).toHaveAttribute('aria-pressed', 'false');
      expect(cards[2]).toHaveAttribute('aria-pressed', 'true');
    });

    it('should handle null selectedCardId', () => {
      render(<PlayerHand cards={mockCards} selectedCardId={null} />);
      
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        expect(card).toHaveAttribute('aria-pressed', 'false');
      });
    });

    it('should handle selectedCardId not in cards', () => {
      render(<PlayerHand cards={mockCards} selectedCardId="non-existent-card" />);
      
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        expect(card).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });

  describe('Disabled State', () => {
    it('should disable all cards when disabled is true', () => {
      render(<PlayerHand cards={mockCards} onCardClick={() => {}} disabled={true} />);
      
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        expect(card).toBeDisabled();
      });
    });

    it('should enable cards when disabled is false and onCardClick provided', () => {
      render(<PlayerHand cards={mockCards} onCardClick={() => {}} disabled={false} />);
      
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        expect(card).not.toBeDisabled();
      });
    });

    it('should disable selected card when disabled is true', () => {
      render(
        <PlayerHand 
          cards={mockCards} 
          onCardClick={() => {}} 
          disabled={true}
          selectedCardId="card-2"
        />
      );
      
      const cards = screen.getAllByRole('button');
      expect(cards[1]).toBeDisabled();
      expect(cards[1]).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper group role and label', () => {
      render(<PlayerHand cards={mockCards} />);
      
      const hand = screen.getByRole('group');
      expect(hand).toHaveAttribute('aria-label', 'Your hand: 5 cards');
    });

    it('should have proper status role for empty state', () => {
      render(<PlayerHand cards={[]} />);
      
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'No cards in hand');
    });

    it('should have accessible card labels', () => {
      render(<PlayerHand cards={mockCards} />);
      
      expect(screen.getByRole('button', { name: /ACE of SPADES/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /KING of HEARTS/i })).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const handleCardClick = vi.fn();
      render(<PlayerHand cards={mockCards} onCardClick={handleCardClick} />);
      
      const cards = screen.getAllByRole('button');
      
      // Tab through cards
      cards[0].focus();
      expect(cards[0]).toHaveFocus();
      
      cards[1].focus();
      expect(cards[1]).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single card', () => {
      render(<PlayerHand cards={[mockCards[0]]} />);
      
      expect(screen.getByRole('group', { name: /Your hand: 1 cards/i })).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('should handle maximum cards (5)', () => {
      render(<PlayerHand cards={mockCards} />);
      
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });

    it('should handle clicking multiple cards in sequence', async () => {
      const handleCardClick = vi.fn();
      render(<PlayerHand cards={mockCards} onCardClick={handleCardClick} />);
      
      const cards = screen.getAllByRole('button');
      
      await userEvent.click(cards[0]);
      await userEvent.click(cards[2]);
      await userEvent.click(cards[4]);
      
      expect(handleCardClick).toHaveBeenCalledTimes(3);
      expect(handleCardClick).toHaveBeenNthCalledWith(1, 'card-1');
      expect(handleCardClick).toHaveBeenNthCalledWith(2, 'card-3');
      expect(handleCardClick).toHaveBeenNthCalledWith(3, 'card-5');
    });

    it('should handle rapid clicks on same card', async () => {
      const handleCardClick = vi.fn();
      render(<PlayerHand cards={mockCards} onCardClick={handleCardClick} />);
      
      const card = screen.getAllByRole('button')[0];
      
      await userEvent.click(card);
      await userEvent.click(card);
      await userEvent.click(card);
      
      expect(handleCardClick).toHaveBeenCalledTimes(3);
    });

    it('should maintain state across re-renders', () => {
      const { rerender } = render(
        <PlayerHand cards={mockCards} selectedCardId="card-2" />
      );
      
      let cards = screen.getAllByRole('button');
      expect(cards[1]).toHaveAttribute('aria-pressed', 'true');
      
      // Re-render with same props
      rerender(<PlayerHand cards={mockCards} selectedCardId="card-2" />);
      
      cards = screen.getAllByRole('button');
      expect(cards[1]).toHaveAttribute('aria-pressed', 'true');
    });

    it('should update when cards change', () => {
      const { rerender } = render(<PlayerHand cards={mockCards.slice(0, 3)} />);
      
      expect(screen.getAllByRole('button')).toHaveLength(3);
      
      rerender(<PlayerHand cards={mockCards} />);
      
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });
  });

  describe('Visual States', () => {
    it('should render with large card size', () => {
      render(<PlayerHand cards={mockCards} />);

      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        // Cards should maintain consistent card aspect ratio and responsive width
        expect(card.className).toContain('aspect-[63/88]');
        expect(card.className).toMatch(/w-\[/);
      });
    });

    it('should apply styling to card container', () => {
      render(<PlayerHand cards={mockCards} />);
      
      const hand = screen.getByRole('group');
      expect(hand.className).toContain('flex');
      expect(hand.className).toContain('justify-center');
    });
  });
});
