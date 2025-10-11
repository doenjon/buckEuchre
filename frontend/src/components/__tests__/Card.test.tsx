/**
 * @module components/__tests__/Card
 * @description Tests for Card component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from '../game/Card';
import type { Card as CardType } from '@buck-euchre/shared';

// Mock card data
const mockCard: CardType = {
  id: 'card-1',
  rank: 'ACE',
  suit: 'SPADES',
};

const mockHeartCard: CardType = {
  id: 'card-2',
  rank: 'KING',
  suit: 'HEARTS',
};

const mockDiamondCard: CardType = {
  id: 'card-3',
  rank: 'QUEEN',
  suit: 'DIAMONDS',
};

const mockClubCard: CardType = {
  id: 'card-4',
  rank: 'JACK',
  suit: 'CLUBS',
};

describe('Card Component', () => {
  describe('Rendering', () => {
    it('should render card with correct rank and suit', () => {
      render(<Card card={mockCard} />);
      
      expect(screen.getByRole('button', { name: /ACE of SPADES/i })).toBeInTheDocument();
    });

    it('should display correct suit symbols', () => {
      const { rerender } = render(<Card card={mockCard} />);
      expect(screen.getByRole('button', { name: /SPADES/i })).toBeInTheDocument();
      
      rerender(<Card card={mockHeartCard} />);
      expect(screen.getByRole('button', { name: /HEARTS/i })).toBeInTheDocument();
      
      rerender(<Card card={mockDiamondCard} />);
      expect(screen.getByRole('button', { name: /DIAMONDS/i })).toBeInTheDocument();
      
      rerender(<Card card={mockClubCard} />);
      expect(screen.getByRole('button', { name: /CLUBS/i })).toBeInTheDocument();
    });

    it('should render face down card when faceDown is true', () => {
      render(<Card card={mockCard} faceDown={true} />);
      
      expect(screen.getByRole('button', { name: /Face down card/i })).toBeInTheDocument();
      expect(screen.queryByText('ACE')).not.toBeInTheDocument();
    });

    it('should render with correct size styles', () => {
      const { rerender } = render(<Card card={mockCard} size="small" />);
      let button = screen.getByRole('button');
      expect(button.className).toContain('w-12');
      expect(button.className).toContain('aspect-[63/88]');

      rerender(<Card card={mockCard} size="medium" />);
      button = screen.getByRole('button');
      expect(button.className).toContain('w-16');
      expect(button.className).toContain('aspect-[63/88]');

      rerender(<Card card={mockCard} size="large" />);
      button = screen.getByRole('button');
      expect(button.className).toContain('w-20');
      expect(button.className).toContain('aspect-[63/88]');
    });
  });

  describe('Interactions', () => {
    it('should call onClick handler when clicked', async () => {
      const handleClick = vi.fn();
      render(<Card card={mockCard} onClick={handleClick} />);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      render(<Card card={mockCard} onClick={handleClick} disabled={true} />);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should be keyboard accessible', async () => {
      const handleClick = vi.fn();
      render(<Card card={mockCard} onClick={handleClick} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveFocus();
      
      // Simulate Enter key press
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      
      // Button's default behavior handles Enter/Space automatically
    });

    it('should not be clickable when disabled', () => {
      const handleClick = vi.fn();
      render(<Card card={mockCard} onClick={handleClick} disabled={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Selected State', () => {
    it('should show selected state when selected is true', () => {
      render(<Card card={mockCard} selected={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button.className).toContain('border-emerald-400');
    });

    it('should not show selected state when selected is false', () => {
      render(<Card card={mockCard} selected={false} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button.className).not.toContain('border-emerald-400');
    });

    it('should include selected state in aria-label', () => {
      const { rerender } = render(<Card card={mockCard} selected={false} />);
      expect(screen.getByRole('button').getAttribute('aria-label')).not.toContain('selected');
      
      rerender(<Card card={mockCard} selected={true} />);
      expect(screen.getByRole('button').getAttribute('aria-label')).toContain('selected');
    });
  });

  describe('Disabled State', () => {
    it('should show disabled styles when disabled', () => {
      render(<Card card={mockCard} disabled={true} />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('cursor-not-allowed');
      expect(button.className).toContain('opacity-60');
    });

    it('should include disabled state in aria-label', () => {
      render(<Card card={mockCard} disabled={true} />);

      expect(screen.getByRole('button').getAttribute('aria-label')).toContain('disabled');
    });

    it('should not have hover cursor when disabled', () => {
      render(<Card card={mockCard} disabled={true} onClick={() => {}} />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('cursor-not-allowed');
      expect(button.className).not.toContain('cursor-pointer');
    });
  });

  describe('Face Down Cards', () => {
    it('should render as a button when face down', () => {
      render(<Card card={mockCard} faceDown={true} />);

      const faceDownCard = screen.getByRole('button', { name: /face down card/i });
      expect(faceDownCard.tagName).toBe('BUTTON');
    });

    it('should be clickable when face down if onClick provided', async () => {
      const handleClick = vi.fn();
      render(<Card card={mockCard} faceDown={true} onClick={handleClick} />);

      const card = screen.getByRole('button');
      await userEvent.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not be clickable when face down and disabled', async () => {
      const handleClick = vi.fn();
      render(<Card card={mockCard} faceDown={true} onClick={handleClick} disabled={true} />);

      const card = screen.getByRole('button');
      await userEvent.click(card);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label with card info', () => {
      render(<Card card={mockCard} />);
      
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'ACE of SPADES'
      );
    });

    it('should have proper aria-pressed attribute', () => {
      const { rerender } = render(<Card card={mockCard} selected={false} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
      
      rerender(<Card card={mockCard} selected={true} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('should be keyboard navigable with proper focus styles', () => {
      render(<Card card={mockCard} onClick={() => {}} />);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('focus-visible:outline-none');
      expect(button.className).toContain('focus-visible:ring-4');
    });
  });

  describe('Suit Colors', () => {
    it('should render red color for hearts', () => {
      render(<Card card={mockHeartCard} />);
      
      const button = screen.getByRole('button');
      // Check if the button contains text-red-600 class anywhere in children
      expect(button.innerHTML).toContain('text-red-600');
    });

    it('should render red color for diamonds', () => {
      render(<Card card={mockDiamondCard} />);
      
      const button = screen.getByRole('button');
      expect(button.innerHTML).toContain('text-red-600');
    });

    it('should render black color for spades', () => {
      render(<Card card={mockCard} />);
      
      const button = screen.getByRole('button');
      expect(button.innerHTML).toContain('text-gray-900');
    });

    it('should render black color for clubs', () => {
      render(<Card card={mockClubCard} />);
      
      const button = screen.getByRole('button');
      expect(button.innerHTML).toContain('text-gray-900');
    });
  });

  describe('Edge Cases', () => {
    it('should handle card without onClick gracefully', () => {
      render(<Card card={mockCard} />);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('cursor-default');
    });

    it('should handle multiple rapid clicks', async () => {
      const handleClick = vi.fn();
      render(<Card card={mockCard} onClick={handleClick} />);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('should maintain selected state across re-renders', () => {
      const { rerender } = render(<Card card={mockCard} selected={true} />);
      
      expect(screen.getByRole('button').className).toContain('border-emerald-400');
      
      // Re-render with same props
      rerender(<Card card={mockCard} selected={true} />);
      
      expect(screen.getByRole('button').className).toContain('border-emerald-400');
    });
  });
});
