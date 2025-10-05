import { describe, expect, it } from 'vitest';
import type { GameState, Player, PlayerPosition } from '@buck-euchre/shared';
import { canFold, isPlayerTurn } from '../gameValidation';

function createPlayer(position: PlayerPosition, overrides: Partial<Player> = {}): Player {
  return {
    id: `player-${position}`,
    name: `Player ${position}`,
    position,
    score: 15,
    connected: true,
    hand: [],
    tricksTaken: 0,
    folded: false,
    foldDecision: 'UNDECIDED',
    ...overrides,
  };
}

function createState(overrides: Partial<GameState> = {}): GameState {
  const players: [Player, Player, Player, Player] = [
    createPlayer(0),
    createPlayer(1),
    createPlayer(2),
    createPlayer(3),
  ];

  const state: GameState = {
    gameId: 'game-1',
    phase: 'FOLDING_DECISION',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players,
    round: 1,
    dealerPosition: 0,
    blind: [],
    turnUpCard: null,
    isClubsTurnUp: false,
    bids: [],
    currentBidder: null,
    highestBid: null,
    winningBidderPosition: 1,
    trumpSuit: 'HEARTS',
    tricks: [],
    currentTrick: {
      number: 1,
      leadPlayerPosition: 1,
      cards: [],
      winner: null,
    },
    currentPlayerPosition: null,
    winner: null,
    gameOver: false,
    ...overrides,
  };

  if (overrides.players) {
    state.players = overrides.players as [Player, Player, Player, Player];
  }

  return state;
}

describe('gameValidation folding helpers', () => {
  it('allows undecided non-bidders to fold', () => {
    const state = createState();
    const result = canFold(state, 2);
    expect(result.valid).toBe(true);
  });

  it('blocks fold attempts after a decision has been recorded', () => {
    const players = [
      createPlayer(0, { foldDecision: 'STAY' }),
      createPlayer(1),
      createPlayer(2, { foldDecision: 'STAY' }),
      createPlayer(3),
    ] as [Player, Player, Player, Player];

    const state = createState({ players });
    const result = canFold(state, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('already');
  });

  it('uses fold decision flag when determining current turns', () => {
    const players = [
      createPlayer(0, { foldDecision: 'STAY' }),
      createPlayer(1),
      createPlayer(2, { foldDecision: 'UNDECIDED' }),
      createPlayer(3, { foldDecision: 'STAY' }),
    ] as [Player, Player, Player, Player];

    const state = createState({ players });

    expect(isPlayerTurn(state, 2)).toBe(true);
    expect(isPlayerTurn(state, 3)).toBe(false);
  });
});
