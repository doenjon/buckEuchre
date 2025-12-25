import { describe, expect, it } from 'vitest';
import {
  canFold,
  canPlayCard,
  getPlayableCards,
  isPlayerTurn,
} from '../gameValidation';
import type {
  Card,
  FoldDecision,
  GameState,
  Player,
  PlayerPosition,
  Trick,
} from '@buck-euchre/shared';

const createCard = (suit: Card['suit'], rank: Card['rank']): Card => ({
  suit,
  rank,
  id: `${suit}_${rank}`,
});

const createPlayer = (
  position: PlayerPosition,
  overrides: Partial<Player> = {},
): Player => ({
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
});

const createTrick = (overrides: Partial<Trick> = {}): Trick => ({
  number: 1,
  leadPlayerPosition: 0,
  cards: [],
  winner: null,
  ...overrides,
});

const createGameState = (overrides: Partial<GameState> = {}): GameState => {
  const basePlayers: [Player, Player, Player, Player] = [
    createPlayer(0),
    createPlayer(1),
    createPlayer(2),
    createPlayer(3),
  ];

  const state: GameState = {
    gameId: 'game-1',
    phase: 'PLAYING',
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    players: overrides.players ? (overrides.players as [Player, Player, Player, Player]) : basePlayers,
    round: 1,
    dealerPosition: 0,
    scoresCalculated: false,
    blind: [],
    turnUpCard: null,
    isClubsTurnUp: false,
    bids: [],
    currentBidder: null,
    highestBid: null,
    winningBidderPosition: 0,
    trumpSuit: 'HEARTS',
    tricks: [],
    currentTrick: overrides.currentTrick ? createTrick(overrides.currentTrick) : createTrick(),
    currentPlayerPosition: overrides.currentPlayerPosition ?? 0,
    winner: null,
    gameOver: false,
    ...overrides,
  };

  return state;
};

const withHand = (state: GameState, position: PlayerPosition, hand: Card[]): GameState => ({
  ...state,
  players: state.players.map((player, index) =>
    index === position ? { ...player, hand } : player
  ) as GameState['players'],
});

describe('gameValidation folding helpers', () => {
  const buildFoldingState = (overrides: Partial<GameState> = {}): GameState =>
    createGameState({
      phase: 'FOLDING_DECISION',
      winningBidderPosition: 1,
      currentPlayerPosition: null,
      currentTrick: createTrick(),
      ...overrides,
    });

  const expectFold = (
    state: GameState,
    position: PlayerPosition,
    expectation: { valid: boolean; reasonIncludes?: string },
  ) => {
    const result = canFold(state, position);
    expect(result.valid).toBe(expectation.valid);
    if (expectation.reasonIncludes) {
      expect(result.reason).toContain(expectation.reasonIncludes);
    }
  };

  it('allows undecided non-bidders to fold', () => {
    const state = buildFoldingState();
    expectFold(state, 2, { valid: true });
  });

  it('blocks folding for the winning bidder', () => {
    const state = buildFoldingState();
    expectFold(state, 1, { valid: false, reasonIncludes: 'bidder' });
  });

  it('blocks folding when clubs are turned up', () => {
    const state = buildFoldingState({ isClubsTurnUp: true });
    expectFold(state, 2, { valid: false, reasonIncludes: 'clubs' });
  });

  it('blocks fold attempts after a decision has been recorded', () => {
    const players = [
      createPlayer(0, { foldDecision: 'STAY' as FoldDecision }),
      createPlayer(1),
      createPlayer(2, { foldDecision: 'STAY' as FoldDecision }),
      createPlayer(3),
    ] as [Player, Player, Player, Player];

    const state = buildFoldingState({ players });
    expectFold(state, 2, { valid: false, reasonIncludes: 'already' });
  });

  it('uses fold decision flag when determining current turns', () => {
    const players = [
      createPlayer(0, { foldDecision: 'STAY' as FoldDecision }),
      createPlayer(1),
      createPlayer(2, { foldDecision: 'UNDECIDED' as FoldDecision }),
      createPlayer(3, { foldDecision: 'STAY' as FoldDecision }),
    ] as [Player, Player, Player, Player];

    const state = buildFoldingState({ players });

    expect(isPlayerTurn(state, 2)).toBe(true);
    expect(isPlayerTurn(state, 3)).toBe(false);
  });
});

describe('gameValidation effective suit handling', () => {
  it('treats a led Left Bower as trump suit when determining playable cards', () => {
    const leftBower = createCard('DIAMONDS', 'JACK');
    const heartsAce = createCard('HEARTS', 'ACE');
    const spadesNine = createCard('SPADES', '9');

    const baseState = createGameState({
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: leftBower, playerPosition: 0 }],
      }),
    });

    const gameState = withHand(baseState, 1, [heartsAce, spadesNine]);
    const playable = getPlayableCards(gameState, 1);
    expect(playable).toEqual([heartsAce]);
  });

  it('requires playing the Left Bower when it matches the led suit', () => {
    const heartsTen = createCard('HEARTS', '10');
    const leftBower = createCard('DIAMONDS', 'JACK');
    const spadesNine = createCard('SPADES', '9');

    const baseState = createGameState({
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: heartsTen, playerPosition: 0 }],
      }),
    });

    const gameState = withHand(baseState, 1, [leftBower, spadesNine]);
    const playable = getPlayableCards(gameState, 1);
    expect(playable).toEqual([leftBower]);
  });

  it('allows both trump cards when holding hearts and the Left Bower', () => {
    const heartsTen = createCard('HEARTS', '10');
    const leftBower = createCard('DIAMONDS', 'JACK');
    const heartsAce = createCard('HEARTS', 'ACE');
    const clubsNine = createCard('CLUBS', '9');

    const baseState = createGameState({
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: heartsTen, playerPosition: 0 }],
      }),
    });

    const gameState = withHand(baseState, 1, [leftBower, heartsAce, clubsNine]);
    const playable = getPlayableCards(gameState, 1);
    expect(playable).toEqual([leftBower, heartsAce]);
  });

  it('provides a follow-suit error referencing the effective led suit', () => {
    const leftBower = createCard('DIAMONDS', 'JACK');
    const heartsAce = createCard('HEARTS', 'ACE');
    const spadesNine = createCard('SPADES', '9');

    const baseState = createGameState({
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: leftBower, playerPosition: 0 }],
      }),
    });

    const gameState = withHand(baseState, 1, [heartsAce, spadesNine]);
    const result = canPlayCard(gameState, 1, spadesNine.id);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Must follow suit (HEARTS)');
  });
});
