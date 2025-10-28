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
      const expectedStyles = {
        small: {
          width: 'clamp(3.25rem, 11vw, 3.875rem)',
          height: 'calc(1.45 * clamp(3.25rem, 11vw, 3.875rem))',
          padding: 'clamp(0.35rem, 1.5vw, 0.5rem)',
        },
        medium: {
          width: 'clamp(3.75rem, 12.5vw, 4.75rem)',
          height: 'calc(1.45 * clamp(3.75rem, 12.5vw, 4.75rem))',
          padding: 'clamp(0.45rem, 1.65vw, 0.7rem)',
        },
        large: {
          width: 'clamp(4.25rem, 15vw, 6rem)',
          height: 'calc(1.45 * clamp(4.25rem, 15vw, 6rem))',
          padding: 'clamp(0.55rem, 1.85vw, 0.9rem)',
        },
      } as const;

      const { rerender } = render(<Card card={mockCard} size="small" />);
      let button = screen.getByRole('button');
      expect(button).toHaveStyle(expectedStyles.small);

      rerender(<Card card={mockCard} size="medium" />);
      button = screen.getByRole('button');
      expect(button).toHaveStyle(expectedStyles.medium);

      rerender(<Card card={mockCard} size="large" />);
      button = screen.getByRole('button');
      expect(button).toHaveStyle(expectedStyles.large);
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
      expect(button.className).toContain('border-green-500');
    });

    it('should not show selected state when selected is false', () => {
      render(<Card card={mockCard} selected={false} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button.className).not.toContain('border-green-500');
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
      expect(button.className).not.toContain('opacity-40');
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
    it('should render as div when face down', () => {
      render(<Card card={mockCard} faceDown={true} />);
      
      // Face down cards use div with role="button" instead of button element
      expect(screen.getByRole('button')).toBeInTheDocument();
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

    it('should have correct tabIndex when face down', () => {
      const { rerender } = render(<Card card={mockCard} faceDown={true} onClick={() => {}} />);
      expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '0');
      
      rerender(<Card card={mockCard} faceDown={true} disabled={true} />);
      expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '-1');
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
      expect(button.className).toContain('focus:outline-none');
      expect(button.className).toContain('focus:ring-4');
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
      
      expect(screen.getByRole('button').className).toContain('border-green-500');
      
      // Re-render with same props
      rerender(<Card card={mockCard} selected={true} />);
      
      expect(screen.getByRole('button').className).toContain('border-green-500');
    });
  });
});
