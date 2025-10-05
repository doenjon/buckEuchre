import { describe, expect, it } from 'vitest';

import { getPlayableCards, canPlayCard } from '../gameValidation';
import type {
  GameState,
  Card,
  Player,
  PlayerPosition,
  Trick,
} from '@buck-euchre/shared';

const createCard = (suit: Card['suit'], rank: Card['rank']): Card => ({
  suit,
  rank,
  id: `${suit}_${rank}`,
});

const createPlayer = (position: PlayerPosition, hand: Card[] = []): Player => ({
  id: `player-${position}`,
  name: `Player ${position}`,
  position,
  score: 10,
  connected: true,
  hand,
  tricksTaken: 0,
  folded: false,
});

const createTrick = (overrides: Partial<Trick>): Trick => ({
  number: 1,
  leadPlayerPosition: 0,
  cards: [],
  winner: null,
  ...overrides,
});

const createPlayers = (): GameState['players'] =>
  [createPlayer(0), createPlayer(1), createPlayer(2), createPlayer(3)] as GameState['players'];

const createGameState = (overrides: Partial<GameState> = {}): GameState => {
  const baseState: GameState = {
    gameId: 'game-1',
    phase: 'PLAYING',
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    players: createPlayers(),
    round: 1,
    dealerPosition: 0,
    blind: [],
    turnUpCard: null,
    isClubsTurnUp: false,
    bids: [],
    currentBidder: null,
    highestBid: null,
    winningBidderPosition: 0,
    trumpSuit: 'HEARTS',
    tricks: [],
    currentTrick: createTrick({}),
    currentPlayerPosition: 0,
    winner: null,
    gameOver: false,
  };

  const players = (overrides.players ?? baseState.players) as GameState['players'];
  const currentTrick = overrides.currentTrick
    ? createTrick(overrides.currentTrick)
    : baseState.currentTrick;

  return {
    ...baseState,
    ...overrides,
    players,
    currentTrick,
  };
};

const withPlayerHand = (
  state: GameState,
  position: PlayerPosition,
  hand: Card[],
): GameState => ({
  ...state,
  players: state.players.map((player, index) =>
    index === position ? { ...player, hand } : player
  ) as GameState['players'],
});

describe('gameValidation', () => {
  it('treats a led Left Bower as trump suit when determining playable cards', () => {
    const leftBower = createCard('DIAMONDS', 'JACK');
    const heartsAce = createCard('HEARTS', 'ACE');
    const spadesNine = createCard('SPADES', '9');

    const baseState = createGameState({
      trumpSuit: 'HEARTS',
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: leftBower, playerPosition: 0 }],
      }),
    });

    const gameState = withPlayerHand(baseState, 1, [heartsAce, spadesNine]);

    const playable = getPlayableCards(gameState, 1);

    expect(playable).toEqual([heartsAce]);
  });

  it('requires playing the Left Bower when it matches the led suit', () => {
    const heartsTen = createCard('HEARTS', '10');
    const leftBower = createCard('DIAMONDS', 'JACK');
    const spadesNine = createCard('SPADES', '9');

    const baseState = createGameState({
      trumpSuit: 'HEARTS',
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: heartsTen, playerPosition: 0 }],
      }),
    });

    const gameState = withPlayerHand(baseState, 1, [leftBower, spadesNine]);

    const playable = getPlayableCards(gameState, 1);

    expect(playable).toEqual([leftBower]);
  });

  it('allows both trump cards when holding hearts and the Left Bower', () => {
    const heartsTen = createCard('HEARTS', '10');
    const leftBower = createCard('DIAMONDS', 'JACK');
    const heartsAce = createCard('HEARTS', 'ACE');
    const clubsNine = createCard('CLUBS', '9');

    const baseState = createGameState({
      trumpSuit: 'HEARTS',
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: heartsTen, playerPosition: 0 }],
      }),
    });

    const gameState = withPlayerHand(baseState, 1, [leftBower, heartsAce, clubsNine]);

    const playable = getPlayableCards(gameState, 1);

    expect(playable).toEqual([leftBower, heartsAce]);
  });

  it('provides a follow-suit error referencing the effective led suit', () => {
    const leftBower = createCard('DIAMONDS', 'JACK');
    const heartsAce = createCard('HEARTS', 'ACE');
    const spadesNine = createCard('SPADES', '9');

    const baseState = createGameState({
      trumpSuit: 'HEARTS',
      currentPlayerPosition: 1,
      currentTrick: createTrick({
        leadPlayerPosition: 0,
        cards: [{ card: leftBower, playerPosition: 0 }],
      }),
    });

    const gameState = withPlayerHand(baseState, 1, [heartsAce, spadesNine]);

    const result = canPlayCard(gameState, 1, spadesNine.id);

    expect(result).toEqual({ valid: false, reason: 'Must follow suit (HEARTS)' });
  });
});
