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
    scoresCalculated: false,
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

describe('gameStore state management', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: null,
      myPosition: null,
      error: null,
      waitingInfo: null,
      currentNotification: null,
      isGameStartNotification: false,
    });
  });

  it('resets myPosition when switching to a different game', () => {
    // Set up initial game state
    const gameState1 = createGameState({ gameId: 'game-1' });
    useGameStore.setState({ gameState: gameState1, myPosition: 2 });
    
    // Verify initial state
    expect(useGameStore.getState().myPosition).toBe(2);
    expect(useGameStore.getState().gameState?.gameId).toBe('game-1');
    
    // Switch to a new game
    const gameState2 = createGameState({ gameId: 'game-2' });
    useGameStore.getState().setGameState(gameState2);
    
    // myPosition should be reset to null when game changes
    expect(useGameStore.getState().myPosition).toBe(null);
    expect(useGameStore.getState().gameState?.gameId).toBe('game-2');
  });

  it('preserves myPosition when updating the same game', () => {
    // Set up initial game state
    const gameState1 = createGameState({ gameId: 'game-1', version: 1 });
    useGameStore.setState({ gameState: gameState1, myPosition: 2 });
    
    // Update same game with new version
    const gameState2 = createGameState({ gameId: 'game-1', version: 2 });
    useGameStore.getState().setGameState(gameState2);
    
    // myPosition should be preserved
    expect(useGameStore.getState().myPosition).toBe(2);
    expect(useGameStore.getState().gameState?.version).toBe(2);
  });
});

describe('gameStore folding decision selectors', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: null,
      myPosition: null,
      error: null,
      waitingInfo: null,
      currentNotification: null,
      isGameStartNotification: false,
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
