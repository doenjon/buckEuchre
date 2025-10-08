/**
 * @module components/__tests__/CurrentTrick
 * @description Tests for CurrentTrick component layout
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Player, Trick } from '@buck-euchre/shared';
import { CurrentTrick } from '../game/CurrentTrick';

const mockPlayers: Player[] = [
  {
    id: 'player-1',
    name: 'Alice',
    position: 0,
    hand: [],
    score: 0,
    tricksTaken: 0,
    connected: true,
    folded: false,
    foldDecision: 'STAY'
  },
  {
    id: 'player-2',
    name: 'Bob',
    position: 1,
    hand: [],
    score: 0,
    tricksTaken: 0,
    connected: true,
    folded: false,
    foldDecision: 'STAY'
  },
  {
    id: 'player-3',
    name: 'Charlie',
    position: 2,
    hand: [],
    score: 0,
    tricksTaken: 0,
    connected: true,
    folded: false,
    foldDecision: 'STAY'
  },
  {
    id: 'player-4',
    name: 'Diana',
    position: 3,
    hand: [],
    score: 0,
    tricksTaken: 0,
    connected: true,
    folded: false,
    foldDecision: 'STAY'
  }
];

describe('CurrentTrick Component', () => {
  it('keeps the local player anchored to the bottom position', () => {
    const trick: Trick = {
      number: 1,
      leadPlayerPosition: 3,
      winner: null,
      cards: [
        {
          card: { id: 'AS', rank: 'A', suit: 'SPADES' },
          playerPosition: 3
        },
        {
          card: { id: 'KH', rank: 'K', suit: 'HEARTS' },
          playerPosition: 0
        },
        {
          card: { id: 'QD', rank: 'Q', suit: 'DIAMONDS' },
          playerPosition: 1
        },
        {
          card: { id: 'JC', rank: 'J', suit: 'CLUBS' },
          playerPosition: 2
        }
      ]
    };

    render(
      <CurrentTrick
        trick={trick}
        players={mockPlayers}
        currentPlayerPosition={2}
        myPosition={2}
      />
    );

    const myBadge = screen.getByText('Charlie');
    const mySeat = myBadge.closest('div')?.parentElement as HTMLDivElement | null;

    expect(mySeat?.className).toContain('bottom-12');
    expect(mySeat?.className).toContain('-translate-x-1/2');

    const leftOpponentSeat = screen.getByText('Diana').closest('div')?.parentElement as HTMLDivElement | null;
    expect(leftOpponentSeat?.className).toContain('left-12');

    const acrossOpponentSeat = screen.getByText('Alice').closest('div')?.parentElement as HTMLDivElement | null;
    expect(acrossOpponentSeat?.className).toContain('top-12');

    const rightOpponentSeat = screen.getByText('Bob').closest('div')?.parentElement as HTMLDivElement | null;
    expect(rightOpponentSeat?.className).toContain('right-12');
  });
});
