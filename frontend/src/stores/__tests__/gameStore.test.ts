import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState, Player, PlayerPosition } from '@buck-euchre/shared';
import { useGameStore } from '../gameStore';

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

function createGameState(overrides: Partial<GameState> = {}): GameState {
  const players: [Player, Player, Player, Player] = [
    createPlayer(0),
    createPlayer(1),
    createPlayer(2),
    createPlayer(3),
  ];

  const baseState: GameState = {
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
    baseState.players = overrides.players as [Player, Player, Player, Player];
  }

  return baseState;
}

describe('gameStore folding decision selectors', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: null,
      myPosition: null,
      error: null,
      waitingInfo: null,
    });
  });

  it('identifies undecided non-bidder turns during folding phase', () => {
    const gameState = createGameState();
    gameState.players[2] = createPlayer(2, { foldDecision: 'UNDECIDED' });
    gameState.players[3] = createPlayer(3, { foldDecision: 'STAY' });

    useGameStore.setState({ gameState, myPosition: 2 });

    expect(useGameStore.getState().isMyTurn()).toBe(true);
  });

  it('stops indicating turn after stay decision', () => {
    const gameState = createGameState();
    gameState.players[2] = createPlayer(2, { foldDecision: 'STAY' });

    useGameStore.setState({ gameState, myPosition: 2 });

    expect(useGameStore.getState().isMyTurn()).toBe(false);
  });

  it('never prompts the winning bidder to decide', () => {
    const gameState = createGameState();

    useGameStore.setState({ gameState, myPosition: 1 });

    expect(useGameStore.getState().isMyTurn()).toBe(false);
  });

  it('returns the next undecided player as current actor', () => {
    const gameState = createGameState();
    gameState.players[0] = createPlayer(0, { foldDecision: 'STAY' });
    gameState.players[2] = createPlayer(2, { foldDecision: 'UNDECIDED' });
    gameState.players[3] = createPlayer(3, { foldDecision: 'UNDECIDED' });

    useGameStore.setState({ gameState, myPosition: 3 });

    const currentPlayer = useGameStore.getState().getCurrentPlayer();
    expect(currentPlayer?.position).toBe(2);
  });
});
