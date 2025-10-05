/**
 * @module components/__tests__/Scoreboard
 * @description Tests for Scoreboard component
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Scoreboard } from '../game/Scoreboard';
import type { Player } from '@buck-euchre/shared';

// Mock players
const mockPlayers: Player[] = [
  {
    id: 'player-1',
    name: 'Alice',
    position: 0,
    hand: [],
    score: 15,
    tricksTaken: 0,
    connected: true,
    folded: false,
  },
  {
    id: 'player-2',
    name: 'Bob',
    position: 1,
    hand: [],
    score: 20,
    tricksTaken: 0,
    connected: true,
    folded: false,
  },
  {
    id: 'player-3',
    name: 'Charlie',
    position: 2,
    hand: [],
    score: 25,
    tricksTaken: 0,
    connected: true,
    folded: false,
  },
  {
    id: 'player-4',
    name: 'Diana',
    position: 3,
    hand: [],
    score: 30,
    tricksTaken: 0,
    connected: true,
    folded: false,
  },
];

describe('Scoreboard Component', () => {
  describe('Rendering', () => {
    it('should render all players', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.getByRole('list', { name: /Player scores/i })).toBeInTheDocument();
      
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(4);
    });

    it('should display player names', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();
    });

    it('should display player scores', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('should display tricks taken for each player', () => {
      const playersWithTricks = mockPlayers.map(p => ({ ...p, tricksTaken: 2 }));
      render(
        <Scoreboard 
          players={playersWithTricks} 
          currentPlayerPosition={null}
          phase="PLAYING"
        />
      );
      
      const trickTexts = screen.getAllByText(/Tricks: 2/);
      expect(trickTexts).toHaveLength(4);
    });

    it('should display game phase', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="BIDDING"
        />
      );
      
      expect(screen.getByText('BIDDING')).toBeInTheDocument();
    });
  });

  describe('Current Player Highlighting', () => {
    it('should highlight current player turn', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={1}
          phase="PLAYING"
        />
      );
      
      const items = screen.getAllByRole('listitem');
      
      // Bob is position 1 (index 1)
      expect(items[1].className).toContain('border-green-500');
      expect(items[1].className).toContain('bg-green-50');
      
      // Other players should not be highlighted
      expect(items[0].className).not.toContain('border-green-500');
      expect(items[2].className).not.toContain('border-green-500');
    });

    it('should update highlighting when turn changes', () => {
      const { rerender } = render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={0}
          phase="PLAYING"
        />
      );
      
      let items = screen.getAllByRole('listitem');
      expect(items[0].className).toContain('border-green-500');
      
      rerender(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={2}
          phase="PLAYING"
        />
      );
      
      items = screen.getAllByRole('listitem');
      expect(items[0].className).not.toContain('border-green-500');
      expect(items[2].className).toContain('border-green-500');
    });

    it('should include current turn in aria-label', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={1}
          phase="PLAYING"
        />
      );
      
      const bobItem = screen.getByRole('listitem', { name: /Bob.*current turn/i });
      expect(bobItem).toBeInTheDocument();
    });
  });

  describe('Trump Suit Display', () => {
    it('should display trump suit when provided', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          trumpSuit="HEARTS"
        />
      );
      
      expect(screen.getByRole('status', { name: /Trump suit is HEARTS/i })).toBeInTheDocument();
      expect(screen.getByText('♥')).toBeInTheDocument();
    });

    it('should display correct suit symbols', () => {
      const { rerender } = render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          trumpSuit="SPADES"
        />
      );
      expect(screen.getByText('♠')).toBeInTheDocument();
      
      rerender(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          trumpSuit="DIAMONDS"
        />
      );
      expect(screen.getByText('♦')).toBeInTheDocument();
      
      rerender(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          trumpSuit="CLUBS"
        />
      );
      expect(screen.getByText('♣')).toBeInTheDocument();
    });

    it('should not display trump suit when not provided', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.queryByText(/Trump Suit:/i)).not.toBeInTheDocument();
    });

    it('should not display trump suit when null', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
          trumpSuit={null}
        />
      );
      
      expect(screen.queryByText(/Trump Suit:/i)).not.toBeInTheDocument();
    });
  });

  describe('Bidder Indication', () => {
    it('should show bidder badge for winning bidder', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          winningBidderPosition={1}
          winningBid={3}
        />
      );
      
      expect(screen.getByText(/Bidder \(3\)/i)).toBeInTheDocument();
    });

    it('should show correct bid amount', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          winningBidderPosition={0}
          winningBid={5}
        />
      );
      
      expect(screen.getByText(/Bidder \(5\)/i)).toBeInTheDocument();
    });

    it('should not show bidder badge when no bidder', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.queryByText(/Bidder/i)).not.toBeInTheDocument();
    });
  });

  describe('Player Status Indicators', () => {
    it('should show offline badge for disconnected players', () => {
      const playersWithDisconnected = [...mockPlayers];
      playersWithDisconnected[2] = { ...mockPlayers[2], connected: false };
      
      render(
        <Scoreboard 
          players={playersWithDisconnected} 
          currentPlayerPosition={null}
          phase="PLAYING"
        />
      );
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should show folded badge for folded players', () => {
      const playersWithFolded = [...mockPlayers];
      playersWithFolded[1] = { ...mockPlayers[1], folded: true };
      
      render(
        <Scoreboard 
          players={playersWithFolded} 
          currentPlayerPosition={null}
          phase="PLAYING"
        />
      );
      
      expect(screen.getByText('Folded')).toBeInTheDocument();
    });

    it('should reduce opacity for folded players', () => {
      const playersWithFolded = [...mockPlayers];
      playersWithFolded[1] = { ...mockPlayers[1], folded: true };
      
      render(
        <Scoreboard 
          players={playersWithFolded} 
          currentPlayerPosition={null}
          phase="PLAYING"
        />
      );
      
      const items = screen.getAllByRole('listitem');
      expect(items[1].className).toContain('opacity-50');
    });
  });

  describe('Win Condition', () => {
    it('should show winner when player reaches 0 or below', () => {
      const playersWithWinner = [...mockPlayers];
      playersWithWinner[0] = { ...mockPlayers[0], score: 0 };
      
      render(
        <Scoreboard 
          players={playersWithWinner} 
          currentPlayerPosition={null}
          phase="ROUND_OVER"
        />
      );
      
      expect(screen.getByText('WINNER!')).toBeInTheDocument();
    });

    it('should show winner for negative score', () => {
      const playersWithWinner = [...mockPlayers];
      playersWithWinner[0] = { ...mockPlayers[0], score: -5 };
      
      render(
        <Scoreboard 
          players={playersWithWinner} 
          currentPlayerPosition={null}
          phase="ROUND_OVER"
        />
      );
      
      expect(screen.getByText('WINNER!')).toBeInTheDocument();
    });

    it('should show winner only for player with lowest score at 0 or below', () => {
      const playersWithMultipleWinners = [...mockPlayers];
      playersWithMultipleWinners[0] = { ...mockPlayers[0], score: 0 };
      playersWithMultipleWinners[1] = { ...mockPlayers[1], score: 5 };
      
      render(
        <Scoreboard 
          players={playersWithMultipleWinners} 
          currentPlayerPosition={null}
          phase="ROUND_OVER"
        />
      );
      
      // Should only show one winner
      expect(screen.getAllByText('WINNER!')).toHaveLength(1);
    });

    it('should highlight winner score in green', () => {
      const playersWithWinner = [...mockPlayers];
      playersWithWinner[0] = { ...mockPlayers[0], score: 0 };
      
      render(
        <Scoreboard 
          players={playersWithWinner} 
          currentPlayerPosition={null}
          phase="ROUND_OVER"
        />
      );
      
      const items = screen.getAllByRole('listitem');
      const winnerScore = within(items[0]).getByText('0');
      expect(winnerScore.className).toContain('text-green-600');
    });
  });

  describe('Accessibility', () => {
    it('should have proper list role and label', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.getByRole('list', { name: /Player scores/i })).toBeInTheDocument();
    });

    it('should have descriptive aria-labels for each player', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={0}
          phase="PLAYING"
        />
      );
      
      expect(screen.getByRole('listitem', { 
        name: /Alice, score 15, 0 tricks, current turn/i 
      })).toBeInTheDocument();
      
      expect(screen.getByRole('listitem', { 
        name: /Bob, score 20, 0 tricks/i 
      })).toBeInTheDocument();
    });

    it('should announce trump suit to screen readers', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          trumpSuit="HEARTS"
        />
      );
      
      expect(screen.getByRole('status', { name: /Trump suit is HEARTS/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty player name', () => {
      const playersNoName = [...mockPlayers];
      playersNoName[0] = { ...mockPlayers[0], name: '' };
      
      render(
        <Scoreboard 
          players={playersNoName} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.getByText('Player 0')).toBeInTheDocument();
    });

    it('should handle single player', () => {
      render(
        <Scoreboard 
          players={[mockPlayers[0]]} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('should handle null currentPlayerPosition', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      const items = screen.getAllByRole('listitem');
      items.forEach(item => {
        expect(item.className).not.toContain('border-green-500');
      });
    });

    it('should handle phase name formatting', () => {
      render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="WAITING_FOR_PLAYERS"
        />
      );
      
      expect(screen.getByText('WAITING FOR PLAYERS')).toBeInTheDocument();
    });

    it('should handle all players with same score', () => {
      const sameScorePlayers = mockPlayers.map(p => ({ ...p, score: 15 }));
      
      render(
        <Scoreboard 
          players={sameScorePlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
        />
      );
      
      // Should render without errors
      expect(screen.getAllByText('15')).toHaveLength(4);
    });
  });

  describe('Dynamic Updates', () => {
    it('should update when scores change', () => {
      const { rerender } = render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
        />
      );
      
      expect(screen.getByText('15')).toBeInTheDocument();
      
      const updatedPlayers = [...mockPlayers];
      updatedPlayers[0] = { ...mockPlayers[0], score: 12 };
      
      rerender(
        <Scoreboard 
          players={updatedPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
        />
      );
      
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.queryByText('15')).not.toBeInTheDocument();
    });

    it('should update when phase changes', () => {
      const { rerender } = render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DEALING"
        />
      );
      
      expect(screen.getByText('DEALING')).toBeInTheDocument();
      
      rerender(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="BIDDING"
        />
      );
      
      expect(screen.getByText('BIDDING')).toBeInTheDocument();
    });

    it('should update when trump suit is declared', () => {
      const { rerender } = render(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="DECLARING_TRUMP"
        />
      );
      
      expect(screen.queryByText(/Trump Suit:/i)).not.toBeInTheDocument();
      
      rerender(
        <Scoreboard 
          players={mockPlayers} 
          currentPlayerPosition={null}
          phase="PLAYING"
          trumpSuit="HEARTS"
        />
      );
      
      expect(screen.getByText(/Trump Suit:/i)).toBeInTheDocument();
      expect(screen.getByText('♥')).toBeInTheDocument();
    });
  });
});
