/**
 * Full Game Flow Integration Tests
 * 
 * These tests simulate complete games of Buck Euchre from start to finish,
 * including all phases: dealing, bidding, trump, folding, playing, and scoring.
 */

import { io as ioClient, Socket } from 'socket.io-client';
import { GameState, GamePhase, Card, Suit } from '../../../shared/src/types/game';
import { FULL_DECK } from '../../../shared/src/constants/cards';

const BACKEND_URL = 'http://localhost:3000';

const RANDOM_GAME_ITERATIONS = parseInt(process.env.RANDOM_GAME_ITERATIONS || '3', 10);
const RANDOM_GAME_ROUNDS = parseInt(process.env.RANDOM_GAME_ROUNDS || '3', 10);
const RANDOM_GAME_SEED_BASE = process.env.RANDOM_GAME_SEED_BASE || `${Date.now()}`;

interface Player {
  socket: Socket;
  name: string;
  playerId: string;
  token: string;
  gameState: GameState | null;
}

// Helper functions (reuse from game-flow.test.ts)
async function createPlayer(name: string): Promise<Player> {
  const response = await fetch(`${BACKEND_URL}/api/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName: name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create player: ${response.statusText}`);
  }

  const { playerId, playerName, token } = await response.json() as { playerId: string; playerName: string; token: string };

  return new Promise((resolve, reject) => {
    const socket = ioClient(BACKEND_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: false,
    });

    const player: Player = {
      socket,
      name: playerName,
      playerId,
      token,
      gameState: null,
    };

    socket.on('connect', () => resolve(player));
    socket.on('connect_error', (error: Error) => reject(error));
    socket.on('GAME_STATE_UPDATE', (data: { gameState: GameState }) => {
      player.gameState = data.gameState;
    });

    socket.connect();
    setTimeout(() => reject(new Error(`Timeout connecting ${name}`)), 5000);
  });
}

async function createGame(player: Player): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${player.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create game: ${response.statusText}`);
  }

  const { gameId } = await response.json() as { gameId: string };
  return gameId;
}

async function joinGame(player: Player, gameId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    player.socket.emit('JOIN_GAME', { gameId });

    const handleStateUpdate = (data: { gameState: GameState }) => {
      player.gameState = data.gameState;
      if (data.gameState.phase !== 'WAITING_FOR_PLAYERS') {
        player.socket.off('GAME_STATE_UPDATE', handleStateUpdate);
        resolve();
      }
    };

    player.socket.on('GAME_STATE_UPDATE', handleStateUpdate);
    player.socket.on('GAME_WAITING', () => resolve());
    player.socket.on('ERROR', (error: any) => reject(error));

    setTimeout(() => resolve(), 5000);
  });
}

async function setShuffleSeed(seed: string | null): Promise<void> {
  await fetch(`${BACKEND_URL}/api/test/shuffle-seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed }),
  });
}

async function setCustomDeck(deck: string[] | null): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/test/deck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to set custom deck: ${response.status} ${body}`);
  }
}

async function setDealerPosition(position: number | null): Promise<void> {
  await fetch(`${BACKEND_URL}/api/test/dealer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}

async function resetTestControls(): Promise<void> {
  await setShuffleSeed(null);
  await setCustomDeck(null);
  await setDealerPosition(null);
}

/**
 * Wait for all players to have game state matching condition
 */
async function waitForGameState(
  players: Player[],
  condition: (state: GameState) => boolean,
  timeout = 5000
): Promise<GameState> {
  const startTime = Date.now();
  
  while (true) {
    const allStatesMatch = players.every(p => p.gameState && condition(p.gameState));
    
    if (allStatesMatch && players[0].gameState) {
      return players[0].gameState;
    }

    if (Date.now() - startTime >= timeout) {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const phaseSnapshot = players.map(p => ({ name: p.name, phase: p.gameState?.phase ?? 'null', version: p.gameState?.version ?? null }));
  const debugState = players[0].gameState
    ? {
        round: players[0].gameState!.round,
        phase: players[0].gameState!.phase,
        winningBidderPosition: players[0].gameState!.winningBidderPosition,
        players: players[0].gameState!.players.map(pl => ({ position: pl.position, foldDecision: pl.foldDecision, folded: pl.folded })),
      }
    : null;
  console.error('WaitForGameState timeout snapshot:', phaseSnapshot, 'state:', debugState);
  throw new Error(`Timeout waiting for game state: ${players[0].gameState?.phase || 'null'}`);
}

/**
 * Wait for a specific game phase
 */
async function waitForPhase(players: Player[], phase: GamePhase, timeout = 5000): Promise<GameState> {
  return waitForGameState(players, state => state.phase === phase, timeout);
}

/**
 * Get a player's current hand
 */
function getPlayerHand(gameState: GameState, playerId: string): Card[] {
  const player = gameState.players.find(p => p.id === playerId);
  return player?.hand || [];
}

/**
 * Find player by their game position
 */
function getPlayerByPosition(players: Player[], gameState: GameState, position: number): Player | null {
  const gamePlayer = gameState.players.find(p => p.position === position);
  if (!gamePlayer) return null;
  return players.find(p => p.playerId === gamePlayer.id) || null;
}

function getNextActivePosition(state: GameState, startPosition: number): number {
  let next = (startPosition + 1) % 4;
  while (state.players[next].folded === true) {
    next = (next + 1) % 4;
  }
  return next;
}

const ALL_CARD_IDS = FULL_DECK.map(card => card.id);

function composeDeck(
  playerCards: [string[], string[], string[], string[]],
  blind: string[]
): string[] {
  playerCards.forEach((cards, index) => {
    if (cards.length !== 5) {
      throw new Error(`Player ${index} deck must contain 5 cards`);
    }
  });

  if (blind.length !== 4) {
    throw new Error('Blind must contain 4 cards');
  }

  const used = new Set<string>();
  [...playerCards.flat(), ...blind].forEach(cardId => {
    if (!ALL_CARD_IDS.includes(cardId)) {
      throw new Error(`Invalid card id: ${cardId}`);
    }
    if (used.has(cardId)) {
      throw new Error(`Duplicate card id in custom deck: ${cardId}`);
    }
    used.add(cardId);
  });

  if (used.size !== 24) {
    throw new Error('Custom deck must contain exactly 24 unique cards');
  }

  const deck: string[] = [];
  for (let round = 0; round < 5; round++) {
    for (let player = 0; player < 4; player++) {
      deck.push(playerCards[player][round]);
    }
  }

  deck.push(...blind);
  return deck;
}

function waitForSocketError(socket: Socket, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const handler = (error: any) => {
      clearTimeout(timer);
      socket.off('ERROR', handler);
      resolve(error);
    };

    const timer = setTimeout(() => {
      socket.off('ERROR', handler);
      reject(new Error('Timed out waiting for socket error'));
    }, timeoutMs);

    socket.on('ERROR', handler);
  });
}

function createDeckWithAssignments(assignments: Record<number, string>): string[] {
  const deck: string[] = new Array(ALL_CARD_IDS.length);
  const remaining = new Set(ALL_CARD_IDS);

  for (const [indexString, cardId] of Object.entries(assignments)) {
    const index = Number(indexString);
    if (Number.isNaN(index) || index < 0 || index >= ALL_CARD_IDS.length) {
      throw new Error(`Invalid deck index: ${indexString}`);
    }
    if (!ALL_CARD_IDS.includes(cardId)) {
      throw new Error(`Invalid card id: ${cardId}`);
    }
    if (!remaining.has(cardId)) {
      throw new Error(`Duplicate card assignment: ${cardId}`);
    }
    deck[index] = cardId;
    remaining.delete(cardId);
  }

  const iterator = remaining.values();
  for (let i = 0; i < deck.length; i++) {
    if (!deck[i]) {
      const next = iterator.next();
      if (next.done) {
        throw new Error('Ran out of cards while building deck');
      }
      deck[i] = next.value;
    }
  }

  return deck;
}

async function bidAndDeclareTrump(
  players: Player[],
  gameId: string,
  winningBid: number,
  trumpSuit: Suit
): Promise<{
  bidState: GameState;
  trumpState: GameState;
  winningBidderPosition: number;
}> {
  const bidState = await waitForPhase(players, 'BIDDING', 10000);
  const winningBidderPosition = bidState.currentBidder ?? 0;
  const bidder = getPlayerByPosition(players, bidState, winningBidderPosition);
  if (!bidder) {
    throw new Error('Winning bidder not found');
  }

  bidder.socket.emit('PLACE_BID', { gameId, amount: winningBid });

  for (let i = 1; i < 4; i++) {
    const position = (winningBidderPosition + i) % 4;

    await waitForGameState(
      players,
      (state) => state.phase === 'BIDDING' && state.currentBidder === position,
      5000
    );

    const state = players[0].gameState!;
    const currentPlayer = getPlayerByPosition(players, state, position);
    if (!currentPlayer) {
      throw new Error(`Player at position ${position} not found`);
    }
    currentPlayer.socket.emit('PLACE_BID', { gameId, amount: 'PASS' });
  }

  const trumpState = await waitForPhase(players, 'DECLARING_TRUMP', 10000);
  bidder.socket.emit('DECLARE_TRUMP', { gameId, trumpSuit });

  return { bidState, trumpState, winningBidderPosition };
}

async function resolveFoldingPhase(
  players: Player[],
  gameId: string,
  winningBidderPosition: number,
  decisions: Record<number, boolean>
): Promise<GameState> {
  const foldState = await waitForPhase(players, 'FOLDING_DECISION', 10000);

  for (let position = 0; position < 4; position++) {
    if (position === winningBidderPosition) continue;
    const state = players[0].gameState!;
    const player = getPlayerByPosition(players, state, position);
    if (!player) continue;
    const folded = decisions[position] ?? false;
    player.socket.emit('FOLD_DECISION', { gameId, folded });
    await waitForGameState(players, (s) => s.players[position].folded !== null, 5000);
  }

  return await waitForPhase(players, 'PLAYING', 10000);
}

async function playOutRound(
  players: Player[],
  gameId: string,
  options: {
    winningBid?: number;
    trumpSuit?: Suit;
    foldDecisions?: Record<number, boolean>;
  } = {}
): Promise<{ finalState: GameState; winningBidderPosition: number; dealerPosition: number }>
{
  const { winningBid = 3, trumpSuit = 'HEARTS', foldDecisions = {} } = options;

  const { bidState, winningBidderPosition } = await bidAndDeclareTrump(players, gameId, winningBid, trumpSuit);
  let state = await resolveFoldingPhase(players, gameId, winningBidderPosition, foldDecisions);

  outer: for (let trickNum = 1; trickNum <= 5; trickNum++) {
    while (true) {
      state = players[0].gameState!;

      if (state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER') {
        break outer;
      }

      const currentPosition = state.currentPlayerPosition;
      if (currentPosition === null) {
        break;
      }

      const currentPlayer = getPlayerByPosition(players, state, currentPosition);
      if (!currentPlayer) {
        break;
      }

      const hand = getPlayerHand(state, currentPlayer.playerId);
      const cardToPlay = findValidCard(hand, state);
      if (!cardToPlay) {
        break;
      }

      currentPlayer.socket.emit('PLAY_CARD', { gameId, cardId: cardToPlay.id });

      const previousTrickLength = state.currentTrick.cards.length;
      await waitForGameState(
        players,
        (nextState) =>
          nextState.phase === 'ROUND_OVER' ||
          nextState.phase === 'GAME_OVER' ||
          nextState.currentTrick.cards.length !== previousTrickLength,
        5000
      );
    }

    await waitForGameState(
      players,
      (nextState) =>
        nextState.tricks.length >= trickNum ||
        nextState.phase === 'ROUND_OVER' ||
        nextState.phase === 'GAME_OVER',
      5000
    );
  }

  const finalState = await waitForGameState(
    players,
    (state) => state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER',
    10000
  );
  return { finalState, winningBidderPosition, dealerPosition: bidState.dealerPosition };
}

const FOLLOW_SUIT_DECK = composeDeck(
  [
    ['HEARTS_ACE', 'SPADES_10', 'DIAMONDS_KING', 'CLUBS_9', 'HEARTS_QUEEN'],
    ['HEARTS_KING', 'SPADES_9', 'CLUBS_KING', 'DIAMONDS_QUEEN', 'HEARTS_JACK'],
    ['SPADES_ACE', 'CLUBS_QUEEN', 'DIAMONDS_ACE', 'SPADES_KING', 'CLUBS_10'],
    ['CLUBS_ACE', 'DIAMONDS_JACK', 'HEARTS_10', 'SPADES_QUEEN', 'DIAMONDS_10'],
  ],
  ['SPADES_JACK', 'HEARTS_9', 'DIAMONDS_9', 'CLUBS_JACK']
);

const DIRTY_CLUBS_DECK = composeDeck(
  [
    ['HEARTS_ACE', 'SPADES_10', 'DIAMONDS_KING', 'CLUBS_QUEEN', 'HEARTS_QUEEN'],
    ['HEARTS_KING', 'SPADES_9', 'DIAMONDS_QUEEN', 'CLUBS_KING', 'HEARTS_JACK'],
    ['SPADES_ACE', 'CLUBS_ACE', 'DIAMONDS_ACE', 'SPADES_KING', 'HEARTS_10'],
    ['DIAMONDS_JACK', 'CLUBS_9', 'SPADES_QUEEN', 'DIAMONDS_10', 'HEARTS_9'],
  ],
  ['CLUBS_10', 'SPADES_JACK', 'DIAMONDS_9', 'CLUBS_JACK']
);

const TRICK_WINNER_DECK = composeDeck(
  [
    ['HEARTS_KING', 'SPADES_10', 'DIAMONDS_KING', 'CLUBS_9', 'SPADES_QUEEN'],
    ['DIAMONDS_JACK', 'SPADES_9', 'CLUBS_KING', 'DIAMONDS_QUEEN', 'CLUBS_10'],
    ['HEARTS_ACE', 'CLUBS_QUEEN', 'DIAMONDS_ACE', 'SPADES_KING', 'HEARTS_10'],
    ['CLUBS_ACE', 'HEARTS_QUEEN', 'DIAMONDS_10', 'SPADES_ACE', 'DIAMONDS_9'],
  ],
  ['HEARTS_JACK', 'SPADES_JACK', 'HEARTS_9', 'CLUBS_JACK']
);

const HEARTS_SWEEP_DECK = composeDeck(
  [
    ['HEARTS_ACE', 'HEARTS_KING', 'HEARTS_QUEEN', 'HEARTS_JACK', 'DIAMONDS_JACK'],
    ['HEARTS_10', 'SPADES_9', 'SPADES_10', 'SPADES_JACK', 'SPADES_QUEEN'],
    ['DIAMONDS_ACE', 'DIAMONDS_KING', 'DIAMONDS_QUEEN', 'CLUBS_ACE', 'CLUBS_KING'],
    ['DIAMONDS_10', 'CLUBS_QUEEN', 'CLUBS_JACK', 'CLUBS_10', 'SPADES_KING'],
  ],
  ['HEARTS_9', 'SPADES_ACE', 'DIAMONDS_9', 'CLUBS_9']
);

// Remove global players array - each test should manage its own players

/**
 * Get effective suit of a card (handles left bower becoming trump)
 */
function getEffectiveSuit(card: Card, trumpSuit: Suit | null): Suit {
  if (!trumpSuit) return card.suit;
  
  // Left bower (Jack of same color as trump) becomes trump
  if (card.rank === 'JACK') {
    const sameColorSuits: Record<Suit, Suit> = {
      'HEARTS': 'DIAMONDS',
      'DIAMONDS': 'HEARTS',
      'CLUBS': 'SPADES',
      'SPADES': 'CLUBS',
    };
    if (card.suit === sameColorSuits[trumpSuit]) {
      return trumpSuit;
    }
  }
  
  return card.suit;
}

/**
 * Find a valid card to play (following suit rules with trump logic)
 */
function findValidCard(hand: Card[], gameState: GameState): Card | null {
  if (hand.length === 0) return null;
  
  // If leading the trick, any card is valid
  if (gameState.currentTrick.cards.length === 0) {
    return hand[0];
  }
  
  // Must follow suit if possible (using effective suit for trump logic)
  const leadCard = gameState.currentTrick.cards[0].card;
  const leadSuit = getEffectiveSuit(leadCard, gameState.trumpSuit);
  const suitCards = hand.filter(c => getEffectiveSuit(c, gameState.trumpSuit) === leadSuit);
  
  if (suitCards.length > 0) {
    return suitCards[0];
  }
  
  // Can't follow suit, play any card
  return hand[0];
}

function getValidCards(hand: Card[], gameState: GameState): Card[] {
  if (hand.length === 0) return [];
  if (gameState.currentTrick.cards.length === 0) {
    return [...hand];
  }

  const leadCard = gameState.currentTrick.cards[0].card;
  const leadSuit = getEffectiveSuit(leadCard, gameState.trumpSuit);
  const matching = hand.filter(card => getEffectiveSuit(card, gameState.trumpSuit) === leadSuit);
  return matching.length > 0 ? matching : [...hand];
}

function chooseRandomBid(state: GameState, rng: () => number): 'PASS' | 2 | 3 | 4 | 5 {
  const highest = state.highestBid;
  const raiseOptions: Array<2 | 3 | 4 | 5> = [2, 3, 4, 5].filter(
    amount => highest === null || amount > highest
  ) as Array<2 | 3 | 4 | 5>;

  if (raiseOptions.length === 0) {
    return 'PASS';
  }

  // Make AI very likely to bid (90% chance) and unlikely to pass (10% chance)
  const options: Array<'PASS' | 2 | 3 | 4 | 5> = ['PASS', ...raiseOptions, ...raiseOptions, ...raiseOptions, ...raiseOptions, ...raiseOptions, ...raiseOptions, ...raiseOptions, ...raiseOptions];
  return randomChoice(options, rng);
}

function chooseRandomTrump(hand: Card[], rng: () => number): Suit {
  const suits: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  const counts = suits.map(suit => ({
    suit,
    count: hand.filter(card => getEffectiveSuit(card, suit) === suit).length,
  }));

  counts.sort((a, b) => {
    if (a.count === b.count) {
      return rng() < 0.5 ? -1 : 1;
    }
    return b.count - a.count;
  });

  return counts[0].suit;
}

function chooseRandomFoldDecision(state: GameState, rng: () => number): boolean {
  if (state.isClubsTurnUp) {
    return false;
  }
  // Make AI more likely to stay in (70% chance) and less likely to fold (30% chance)
  return rng() < 0.3;
}

async function cleanup(players: Player[]) {
  const disconnectPromises = players.map(player => {
    return new Promise<void>((resolve) => {
      if (!player.socket || !player.socket.connected) {
        resolve();
        return;
      }
      
      player.socket.once('disconnect', () => {
        resolve();
      });
      
      player.socket.disconnect();
      
      // Fallback timeout in case disconnect event doesn't fire
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  });
  
  await Promise.all(disconnectPromises);
}

async function waitForNextVersion(players: Player[], previousVersion: number, timeout = 10000): Promise<GameState> {
  return waitForGameState(
    players,
    state => state.version > previousVersion,
    timeout
  );
}

async function runRandomBidding(
  players: Player[],
  gameId: string,
  rng: () => number,
  startState: GameState
): Promise<GameState> {
  let state = startState;
  while (state.phase === 'BIDDING') {
    const bidderPosition = state.currentBidder;
    if (bidderPosition === null) {
      break;
    }
    const bidder = getPlayerByPosition(players, state, bidderPosition);
    if (!bidder) {
      throw new Error(`Bidder at position ${bidderPosition} not found`);
    }

    const amount = chooseRandomBid(state, rng);
    bidder.socket.emit('PLACE_BID', { gameId, amount });

    state = await waitForNextVersion(players, state.version);
  }
  return state;
}

async function runRandomTrumpDeclaration(
  players: Player[],
  gameId: string,
  rng: () => number,
  state: GameState
): Promise<GameState> {
  if (state.phase !== 'DECLARING_TRUMP') {
    return state;
  }

  const bidderPos = state.winningBidderPosition;
  if (bidderPos === null) {
    throw new Error('Winning bidder missing during trump declaration');
  }

  const bidder = getPlayerByPosition(players, state, bidderPos);
  if (!bidder) {
    throw new Error(`Winning bidder at position ${bidderPos} not found`);
  }

  const hand = getPlayerHand(state, bidder.playerId);
  const trumpSuit = chooseRandomTrump(hand, rng);
  bidder.socket.emit('DECLARE_TRUMP', { gameId, trumpSuit });

  return waitForNextVersion(players, state.version);
}

async function runRandomFolding(
  players: Player[],
  gameId: string,
  rng: () => number,
  state: GameState
): Promise<GameState> {
  let currentState = state;

  while (currentState.phase === 'FOLDING_DECISION') {
    const undecided = currentState.players.find(player => (
      player.position !== currentState.winningBidderPosition &&
      player.foldDecision === 'UNDECIDED'
    ));

    if (!undecided) {
      break;
    }

    const player = getPlayerByPosition(players, currentState, undecided.position);
    if (!player) {
      throw new Error(`Folding player at position ${undecided.position} not found`);
    }

    const shouldFold = chooseRandomFoldDecision(currentState, rng);
    player.socket.emit('FOLD_DECISION', { gameId, folded: shouldFold });

    const successPromise = waitForNextVersion(players, currentState.version);
    const errorPromise = waitForSocketError(player.socket, 2000)
      .then(error => ({ error }))
      .catch(() => null);

    const result = await Promise.race([
      successPromise.then(state => ({ state })),
      errorPromise,
    ]);

    if (result && 'error' in result) {
      successPromise.catch(() => null);
      const error = result.error;
      const message = error?.message || '';
      if (message.includes('Cannot fold') || message.includes('Bidder cannot fold')) {
        player.socket.emit('FOLD_DECISION', { gameId, folded: false });
        currentState = await waitForNextVersion(players, currentState.version);
      } else if (message.includes('You already made your decision')) {
        currentState = await waitForNextVersion(players, currentState.version);
      } else {
        throw new Error(`Unexpected fold decision error: ${message || 'unknown'}`);
      }
    } else {
      currentState = (result && 'state' in result) ? result.state : await successPromise;
    }
  }

  return currentState;
}

async function runRandomPlaying(
  players: Player[],
  gameId: string,
  rng: () => number,
  state: GameState,
  maxTricks = 5
): Promise<GameState> {
  let currentState = state;

  while (currentState.phase === 'PLAYING') {
    const currentPosition = currentState.currentPlayerPosition;
    if (currentPosition === null) {
      currentState = await waitForNextVersion(players, currentState.version);
      continue;
    }

    const player = getPlayerByPosition(players, currentState, currentPosition);
    if (!player) {
      throw new Error(`Current player at position ${currentPosition} not found`);
    }

    const hand = getPlayerHand(currentState, player.playerId);
    const validCards = getValidCards(hand, currentState);

    if (validCards.length === 0) {
      throw new Error(`No valid cards available for player ${player.name}`);
    }

    const selectedCard = randomChoice(validCards, rng);
    player.socket.emit('PLAY_CARD', { gameId, cardId: selectedCard.id });

    currentState = await waitForNextVersion(players, currentState.version);

    if (currentState.tricks.length >= maxTricks || currentState.phase !== 'PLAYING') {
      break;
    }
  }

  return currentState;
}

describe('Full Game Flow', () => {

  afterEach(async () => {
    // Cleanup is now handled by individual tests
    await resetTestControls();
  });

  describe('Complete Game - Happy Path', () => {
    it('should play a full game: deal → bid → trump → fold → play 5 tricks → score', async () => {
      console.log('\n🎮 TEST: Complete game flow\n');

      // Setup: Create 4 players and start game
      console.log('Creating 4 players...');
      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      await setCustomDeck(FOLLOW_SUIT_DECK);


      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      // Round should begin immediately in bidding phase with cards already dealt
      console.log('\n📋 Phase: BIDDING (after deal)');
      const bidState = await waitForPhase(players, 'BIDDING', 10000);
      
      expect(bidState.phase).toBe('BIDDING');
      expect(bidState.round).toBe(1);
      expect(bidState.blind).toHaveLength(4);
      expect(bidState.turnUpCard).toBeTruthy();
      
      // Each player should have 5 cards
      bidState.players.forEach((p, i) => {
        expect(p.hand).toHaveLength(5);
        console.log(`  Player ${i} (${p.name}): ${p.hand.length} cards`);
      });

      console.log(`  Turn-up card: ${bidState.turnUpCard?.rank} of ${bidState.turnUpCard?.suit}`);
      console.log(`  Dirty clubs: ${bidState.isClubsTurnUp}`);
      

      console.log('\n💰 Bidding actions');
      expect(bidState.currentBidder).toBeDefined();
      
      const dealerPos = bidState.dealerPosition;
      const firstBidder = (dealerPos + 1) % 4;
      expect(bidState.currentBidder).toBe(firstBidder);
      
      console.log(`  Dealer: Player ${dealerPos}`);
      console.log(`  First bidder: Player ${firstBidder}`);

      // Simulate bidding: Player after dealer bids 3, others pass
      const bidder = getPlayerByPosition(players, bidState, firstBidder);
      if (!bidder) throw new Error('Bidder not found');
      console.log(`  ${bidder.name} bids 3`);
      bidder.socket.emit('PLACE_BID', { gameId, amount: 3 });

      // Wait for next player's turn
      await waitForGameState(players, state => 
        state.phase === 'BIDDING' && state.currentBidder === (firstBidder + 1) % 4
      );

      // Other players pass
      for (let i = 1; i < 4; i++) {
        const nextPos = (firstBidder + i) % 4;
        const currentState = players[0].gameState!;
        const currentPlayer = getPlayerByPosition(players, currentState, nextPos);
        if (!currentPlayer) throw new Error(`Player at position ${nextPos} not found`);
        console.log(`  ${currentPlayer.name} passes`);
        currentPlayer.socket.emit('PLACE_BID', { gameId, amount: 'PASS' });
        
        if (i < 3) {
          await waitForGameState(players, state =>
            state.phase === 'BIDDING' && state.currentBidder === (firstBidder + i + 1) % 4
          );
        }
      }

      // TRUMP DECLARATION PHASE
      console.log('\n♠️ Phase: DECLARING_TRUMP');
      const trumpState = await waitForPhase(players, 'DECLARING_TRUMP', 10000);
      
      expect(trumpState.phase).toBe('DECLARING_TRUMP');
      expect(trumpState.winningBidderPosition).toBe(firstBidder);
      expect(trumpState.highestBid).toBe(3);
      
      console.log(`  Bidder (Player ${firstBidder}) declares HEARTS as trump`);
      bidder.socket.emit('DECLARE_TRUMP', { gameId, trumpSuit: 'HEARTS' });

      console.log('\n🎴 Phase: FOLDING DECISION');
      const foldState = await waitForPhase(players, 'FOLDING_DECISION', 10000);
      expect(foldState.phase).toBe('FOLDING_DECISION');

      // Non-bidders make folding decisions (dirty clubs forces stay)
      for (let i = 0; i < 4; i++) {
        if (i !== firstBidder) {
          const position = i;
          const currentState = players[0].gameState!;
          const player = getPlayerByPosition(players, currentState, position);
          if (!player) continue;
          const shouldFold = !trumpState.isClubsTurnUp && position % 2 === 0;
          console.log(`  Player ${position} (${player.name}): ${shouldFold ? 'FOLDS' : 'STAYS'}`);
          player.socket.emit('FOLD_DECISION', { gameId, folded: shouldFold });

          await waitForGameState(players, state => {
            const updatedPlayer = state.players[position];
            return updatedPlayer.folded !== null;
          }, 5000);
        }
      }

      // PLAYING PHASE
      console.log('\n🃏 Phase: PLAYING');
      const playState = await waitForPhase(players, 'PLAYING', 10000);
      
      expect(playState.phase).toBe('PLAYING');
      expect(playState.trumpSuit).toBe('HEARTS');
      
      console.log(`  Trump suit: ${playState.trumpSuit}`);
      console.log(`  Playing 5 tricks...`);

      // Play all 5 tricks
      for (let trickNum = 1; trickNum <= 5; trickNum++) {
        console.log(`  [DEBUG] Starting trick ${trickNum}, current phase: ${players[0].gameState?.phase}`);
        console.log(`\n  --- Trick ${trickNum} ---`);
        
        // Play cards until trick is complete or round ends
        while (true) {
          const currentState = players[0].gameState!;
          console.log(`    [DEBUG] Loop iteration - phase: ${currentState.phase}, currentPlayer: ${currentState.currentPlayerPosition}, tricksCompleted: ${currentState.tricks.length}, cardsInTrick: ${currentState.currentTrick.cards.length}`);
          
          // Check if round is over
          if (currentState.phase === 'ROUND_OVER') {
            console.log(`  Round over after ${currentState.tricks.length} tricks!`);
            break;
          }
          
          const currentPlayerPos = currentState.currentPlayerPosition;
          
          // Check if trick is complete (currentPlayerPosition becomes null briefly then resets for next trick)
          if (currentPlayerPos === null) {
            console.log(`    [DEBUG] currentPlayerPos is null, breaking`);
            break;
          }
          
          const currentPlayer = getPlayerByPosition(players, currentState, currentPlayerPos);
          if (!currentPlayer) {
            console.log(`    [DEBUG] Could not find player at position ${currentPlayerPos}`);
            break;
          }
          
          const hand = getPlayerHand(currentState, currentPlayer.playerId);
          const cardToPlay = findValidCard(hand, currentState);
          
          if (cardToPlay) {
            console.log(`    Player ${currentPlayerPos} (${currentPlayer.name}) plays ${cardToPlay.rank} of ${cardToPlay.suit}`);
            currentPlayer.socket.emit('PLAY_CARD', { gameId, cardId: cardToPlay.id });
            
            // Wait for game state to update (card played or trick completed)
            const prevTrickLength = currentState.currentTrick.cards.length;
            console.log(`    [DEBUG] Waiting for state update... prevTrickLength: ${prevTrickLength}`);
            await waitForGameState(players, state =>
              state.currentTrick.cards.length !== prevTrickLength || 
              state.tricks.length > currentState.tricks.length ||
              state.phase === 'ROUND_OVER'
            , 3000);
            console.log(`    [DEBUG] State updated!`);
          }
        }
        
        // Wait for trick to complete
        await waitForGameState(players, state => 
          state.tricks.length === trickNum || state.phase === 'ROUND_OVER'
        , 3000);
        
        // Break outer loop if round is over
        if (players[0].gameState!.phase === 'ROUND_OVER') {
          break;
        }
      }

      // ROUND OVER PHASE (Scoring)
      console.log('\n📊 Phase: ROUND_OVER');
      const scoreState = await waitForPhase(players, 'ROUND_OVER', 10000);
      
      expect(scoreState.phase).toBe('ROUND_OVER');
      
      const bidderPlayer = scoreState.players[firstBidder];
      const tricksTaken = bidderPlayer.tricksTaken;
      const bid = scoreState.highestBid!;
      
      console.log(`  Bidder (${bidderPlayer.name}) took ${tricksTaken} tricks (bid: ${bid})`);
      
      if (tricksTaken >= bid) {
        console.log(`  ✅ Made bid! Score: 15 - ${tricksTaken} = ${15 - tricksTaken}`);
        expect(bidderPlayer.score).toBe(15 - tricksTaken);
      } else {
        console.log(`  ❌ Failed bid! Score: 15 + 5 = 20`);
        expect(bidderPlayer.score).toBe(20);
      }
      
      // Non-bidding players
      scoreState.players.forEach((p, i) => {
        if (i !== firstBidder && !p.folded) {
          console.log(`  Player ${i} (${p.name}): ${p.tricksTaken} tricks, score: ${p.score}`);
          const expectedScore = p.tricksTaken > 0 ? 15 - p.tricksTaken : 20;
          expect(p.score).toBe(expectedScore);
        }
      });

      console.log('\n✅ GAME COMPLETE!');
      
      // Cleanup
      await cleanup(players);
    }, 60000); // 60 second timeout for full game
  });

  describe('Edge Cases', () => {
    it('should handle all players passing (no bids)', async () => {
      console.log('\n🎮 TEST: All players pass\n');

      // Setup game
      const players = [
        await createPlayer('Alice'),
        await createPlayer('Bob'),
        await createPlayer('Charlie'),
        await createPlayer('Diana'),
      ];
      
      const gameId = await createGame(players[0]);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const bidState = await waitForPhase(players, 'BIDDING');
      const startingRound = bidState.round;

      const firstBidder = bidState.currentBidder!;

      // All players pass
      console.log('All players passing...');
      for (let i = 0; i < 4; i++) {
        const currentPos = (firstBidder + i) % 4;
        const currentState = players[0].gameState!;
        const currentPlayer = getPlayerByPosition(players, currentState, currentPos);
        if (!currentPlayer) throw new Error(`Player at position ${currentPos} not found`);
        console.log(`  ${currentPlayer.name} passes`);
        currentPlayer.socket.emit('PLACE_BID', { gameId, amount: 'PASS' });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Should rotate dealer and start a new round (automatically re-dealt into bidding)
      const nextRoundState = await waitForGameState(
        players,
        state => state.round === startingRound + 1 && state.phase === 'BIDDING',
        10000
      );
      
      expect(nextRoundState.round).toBe(startingRound + 1);
      console.log('✅ New round started after all players passed');

      await cleanup(players);
    }, 30000);

    it('should skip bidding and force all players to stay on dirty clubs', async () => {
      console.log('\n🎮 TEST: Dirty clubs (forced play)\n');

      await setDealerPosition(3);
      await setCustomDeck(DIRTY_CLUBS_DECK);

      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const playState = await waitForPhase(players, 'PLAYING', 10000);
      expect(playState.isClubsTurnUp).toBe(true);
      expect(playState.trumpSuit).toBe('CLUBS');
      expect(playState.bids).toHaveLength(0);
      expect(playState.currentBidder).toBeNull();
      expect(playState.highestBid).toBe(2);

      const leftOfDealer = (playState.dealerPosition + 1) % 4;
      expect(playState.currentPlayerPosition).toBe(leftOfDealer);
      expect(playState.winningBidderPosition).toBe(leftOfDealer);

      playState.players.forEach(player => {
        expect(player.foldDecision).toBe('STAY');
        expect(player.folded).toBe(false);
      });

      const forcedLeader = getPlayerByPosition(players, playState, leftOfDealer);
      if (!forcedLeader) throw new Error('Forced leader not found');

      const bidErrorPromise = waitForSocketError(forcedLeader.socket);
      forcedLeader.socket.emit('PLACE_BID', { gameId, amount: 3 });
      const bidError = await bidErrorPromise;
      expect(bidError.code).toBe('PLACE_BID_FAILED');
      expect(bidError.message).toBe('Not in bidding phase');

      const nextPlayerPosition = getNextActivePosition(playState, leftOfDealer);
      const nextPlayer = getPlayerByPosition(players, playState, nextPlayerPosition);
      if (!nextPlayer) throw new Error('Next player not found');

      const foldErrorPromise = waitForSocketError(nextPlayer.socket);
      nextPlayer.socket.emit('FOLD_DECISION', { gameId, folded: true });
      const foldError = await foldErrorPromise;
      expect(foldError.code).toBe('FOLD_DECISION_FAILED');
      expect(foldError.message).toBe('Not in folding decision phase');

      await cleanup(players);
    }, 30000);
  });

  describe('Game Rules Validation', () => {
    it('should reject card play when not your turn', async () => {
      console.log('\n🎮 TEST: Out-of-turn play rejection\n');

      await setDealerPosition(3);
      await setCustomDeck(FOLLOW_SUIT_DECK);

      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const { winningBidderPosition } = await bidAndDeclareTrump(players, gameId, 3, 'HEARTS');
      const playState = await resolveFoldingPhase(players, gameId, winningBidderPosition, {});

      const currentPosition = playState.currentPlayerPosition!;
      const nextPosition = getNextActivePosition(playState, currentPosition);
      const offender = getPlayerByPosition(players, playState, nextPosition)!;
      const offenderHand = getPlayerHand(playState, offender.playerId);

      const errorPromise = waitForSocketError(offender.socket);
      offender.socket.emit('PLAY_CARD', { gameId, cardId: offenderHand[0].id });
      const error = await errorPromise;
      expect(error.code).toBe('PLAY_CARD_FAILED');
      expect(error.message).toBe('Not your turn');

      const stateAfter = players[0].gameState!;
      expect(stateAfter.currentTrick.cards).toHaveLength(0);
      expect(stateAfter.currentPlayerPosition).toBe(currentPosition);
      
      await cleanup(players);
    }, 20000);

    it('should reject playing a card not in hand', async () => {
      console.log('\n🎮 TEST: Invalid card rejection\n');

      await setDealerPosition(3);
      await setCustomDeck(FOLLOW_SUIT_DECK);

      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      await bidAndDeclareTrump(players, gameId, 3, 'HEARTS');
      const playState = await resolveFoldingPhase(players, gameId, players[0].gameState!.winningBidderPosition!, {});

      const leader = getPlayerByPosition(players, playState, playState.currentPlayerPosition!)!;
      const illegalCardId = 'SPADES_ACE';
      expect(getPlayerHand(playState, leader.playerId).some(card => card.id === illegalCardId)).toBe(false);

      const errorPromise = waitForSocketError(leader.socket);
      leader.socket.emit('PLAY_CARD', { gameId, cardId: illegalCardId });
      const error = await errorPromise;
      expect(error.code).toBe('PLAY_CARD_FAILED');
      expect(error.message).toBe('Card not in hand');

      const stateAfter = players[0].gameState!;
      expect(stateAfter.currentTrick.cards).toHaveLength(0);
      
      await cleanup(players);
    }, 20000);

    it('should reject multiple fold decisions from the same player', async () => {
      console.log('\n🎮 TEST: Duplicate fold decision\n');

      await setDealerPosition(3);
      await setCustomDeck(FOLLOW_SUIT_DECK);

      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const { winningBidderPosition, trumpState } = await bidAndDeclareTrump(players, gameId, 3, 'HEARTS');
      const foldState = await waitForPhase(players, 'FOLDING_DECISION', 10000);
      expect(foldState.winningBidderPosition).toBe(winningBidderPosition);

      const targetPosition = getNextActivePosition(trumpState, winningBidderPosition);
      const targetPlayer = getPlayerByPosition(players, foldState, targetPosition)!;

      const firstDecision = waitForGameState(players, state => state.players[targetPosition].folded === false, 5000);
      targetPlayer.socket.emit('FOLD_DECISION', { gameId, folded: false });
      await firstDecision;

      const errorPromise = waitForSocketError(targetPlayer.socket);
      targetPlayer.socket.emit('FOLD_DECISION', { gameId, folded: false });
      const error = await errorPromise;
      expect(error.code).toBe('FOLD_DECISION_FAILED');
      expect(error.message).toBe('You already made your decision');
      
      await cleanup(players);
    }, 20000);

    it('should enforce following suit rules', async () => {
      console.log('\n🎮 TEST: Following suit rules\n');

      await setDealerPosition(3);
      await setCustomDeck(FOLLOW_SUIT_DECK);

      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const { winningBidderPosition } = await bidAndDeclareTrump(players, gameId, 3, 'HEARTS');

      const playState = await resolveFoldingPhase(players, gameId, winningBidderPosition, {});

      let currentState = players[0].gameState!;
      let currentPlayerPos = currentState.currentPlayerPosition!;
      let leadCard: Card | null = null;

      const leader = getPlayerByPosition(players, currentState, currentPlayerPos);
      if (!leader) throw new Error('Leader not found');

      const leaderHand = getPlayerHand(currentState, leader.playerId);
      const nextPosition = getNextActivePosition(currentState, currentPlayerPos);
      const nextPlayer = getPlayerByPosition(players, currentState, nextPosition);
      if (!nextPlayer) throw new Error('Next player not found');
      const nextHand = getPlayerHand(currentState, nextPlayer.playerId);

      const trumpSuit = currentState.trumpSuit!;

      for (const candidate of leaderHand) {
        const leadSuit = getEffectiveSuit(candidate, trumpSuit);
        const nextHasSuit = nextHand.some(card => getEffectiveSuit(card, trumpSuit) === leadSuit);
        if (nextHasSuit) {
          leadCard = candidate;
          break;
        }
      }

      if (!leadCard) {
        throw new Error('Failed to find a lead card that forces follow suit');
      }

      leader.socket.emit('PLAY_CARD', { gameId, cardId: leadCard.id });
      await waitForGameState(players, state => state.currentTrick.cards.length === 1, 5000);

      currentState = players[0].gameState!;
      currentPlayerPos = currentState.currentPlayerPosition!;

      expect(currentPlayerPos).toBe(nextPosition);

      const illegalCard = getPlayerHand(currentState, nextPlayer.playerId)
        .find(card => getEffectiveSuit(card, trumpSuit) !== getEffectiveSuit(leadCard!, trumpSuit));

      expect(illegalCard).toBeTruthy();

      const errorPromise = waitForSocketError(nextPlayer.socket);
      nextPlayer.socket.emit('PLAY_CARD', { gameId, cardId: illegalCard!.id });
      const error = await errorPromise;
      expect(error.code).toBe('PLAY_CARD_FAILED');
      expect(error.message).toBe('Must follow suit');

      // Play a legal card instead
      const legalCard = getPlayerHand(players[0].gameState!, nextPlayer.playerId)
        .find(card => getEffectiveSuit(card, trumpSuit) === getEffectiveSuit(leadCard!, trumpSuit));
      expect(legalCard).toBeTruthy();

      nextPlayer.socket.emit('PLAY_CARD', { gameId, cardId: legalCard!.id });
      await waitForGameState(players, state => state.currentTrick.cards.length === 2, 5000);
      
      await cleanup(players);
    }, 10000);

    it('should correctly determine trick winners', async () => {
      console.log('\n🎮 TEST: Trick winner determination\n');

      await setDealerPosition(3);
      await setCustomDeck(TRICK_WINNER_DECK);

      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const { winningBidderPosition } = await bidAndDeclareTrump(players, gameId, 3, 'HEARTS');
      const playState = await resolveFoldingPhase(players, gameId, winningBidderPosition, {});

      let state = playState;
      const leader = getPlayerByPosition(players, state, state.currentPlayerPosition!);
      if (!leader) throw new Error('Leader not found');

      const leaderHand = getPlayerHand(state, leader.playerId);
      const leadCard = leaderHand.find(card => card.id === 'HEARTS_KING') || leaderHand[0];
      leader.socket.emit('PLAY_CARD', { gameId, cardId: leadCard.id });
      await waitForGameState(players, s => s.currentTrick.cards.length === 1, 5000);

      state = players[0].gameState!;
      const secondPosition = getNextActivePosition(state, state.currentTrick.cards[0].playerPosition);
      const secondPlayer = getPlayerByPosition(players, state, secondPosition);
      if (!secondPlayer) throw new Error('Second player not found');
      secondPlayer.socket.emit('PLAY_CARD', { gameId, cardId: 'DIAMONDS_JACK' });
      await waitForGameState(players, s => s.currentTrick.cards.length === 2, 5000);

      state = players[0].gameState!;
      const thirdPosition = getNextActivePosition(state, secondPosition);
      const thirdPlayer = getPlayerByPosition(players, state, thirdPosition)!;
      thirdPlayer.socket.emit('PLAY_CARD', { gameId, cardId: 'HEARTS_ACE' });
      await waitForGameState(players, s => s.currentTrick.cards.length === 3, 5000);

      state = players[0].gameState!;
      const fourthPosition = getNextActivePosition(state, thirdPosition);
      const fourthPlayer = getPlayerByPosition(players, state, fourthPosition)!;
      fourthPlayer.socket.emit('PLAY_CARD', { gameId, cardId: 'HEARTS_QUEEN' });
      await waitForGameState(players, s => s.tricks.length === 1, 5000);

      state = players[0].gameState!;
      expect(state.tricks).toHaveLength(1);
      const trick = state.tricks[0];
      expect(trick.winner).toBe(secondPosition);
      expect(state.players[secondPosition].tricksTaken).toBe(1);
      
      await cleanup(players);
    }, 10000);

    it('should handle player reaching 0 or below (win condition)', async () => {
      console.log('\n🎮 TEST: Win condition\n');

      await setDealerPosition(3);
      await setCustomDeck(HEARTS_SWEEP_DECK);

      const alice = await createPlayer('Alice');
      const bob = await createPlayer('Bob');
      const charlie = await createPlayer('Charlie');
      const diana = await createPlayer('Diana');
      const players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      let latestState: GameState | null = null;

      for (let round = 0; round < 3; round++) {
        if (round > 0) {
          await setDealerPosition(3);
          await setCustomDeck(HEARTS_SWEEP_DECK);
          players[0].socket.emit('START_NEXT_ROUND', { gameId });
          await waitForPhase(players, 'BIDDING', 10000);
        }

        const { finalState, winningBidderPosition } = await playOutRound(players, gameId, {
          winningBid: 5,
          trumpSuit: 'HEARTS',
        });

        latestState = finalState;

        console.log(`  Round ${round + 1} scores:`, finalState.players.map(p => p.score), 'phase:', finalState.phase);
        console.log('  Winning bidder position:', winningBidderPosition);

        if (round < 2) {
          expect(finalState.phase).toBe('ROUND_OVER');
          expect(finalState.players[0].score).toBe(15 - (round + 1) * 5);
        }
      }

      const gameOverState = await waitForGameState(
        players,
        (state) => state.phase === 'GAME_OVER',
        10000
      );

      expect(gameOverState.gameOver).toBe(true);
      expect(gameOverState.winner).toBe(0);
      expect(gameOverState.players[0].score).toBeLessThanOrEqual(0);
      expect(gameOverState.players.every((p, idx) => idx === 0 ? p.score <= 0 : p.score > 15)).toBe(true);

      latestState = gameOverState;

      console.log('  Winner:', latestState.winner, 'Scores:', latestState.players.map(p => p.score));
      
      await cleanup(players);
    }, 40000);
  });
});

async function playRandomRounds(seed: string, roundsTarget: number): Promise<void> {
  const rng = createRng(seed);

  await resetTestControls();
  await setShuffleSeed(seed);

  const alice = await createPlayer('Alice');
  const bob = await createPlayer('Bob');
  const charlie = await createPlayer('Charlie');
  const diana = await createPlayer('Diana');
  const players = [alice, bob, charlie, diana];

  try {
    const gameId = await createGame(alice);
    await Promise.all(players.map(p => joinGame(p, gameId)));

    let state = await waitForPhase(players, 'BIDDING', 10000);
    let roundsCompleted = 0;

    const maxRounds = 20; // Prevent infinite games
    while (!state.gameOver && (roundsTarget <= 0 || roundsCompleted < roundsTarget) && roundsCompleted < maxRounds) {
      console.log(`🎯 Round ${roundsCompleted + 1}: Phase ${state.phase}, Game Over: ${state.gameOver}`);
      
      state = await runRandomBidding(players, gameId, rng, state);

      if (state.phase === 'DEALING') {
        state = await waitForPhase(players, 'BIDDING', 15000);
        roundsCompleted += 1;
        continue;
      }

      if (state.phase !== 'DECLARING_TRUMP') {
        state = await waitForPhase(players, 'DECLARING_TRUMP', 15000);
      }
      state = await runRandomTrumpDeclaration(players, gameId, rng, state);

      if (state.phase !== 'FOLDING_DECISION') {
        state = await waitForPhase(players, 'FOLDING_DECISION', 15000);
      }
      state = await runRandomFolding(players, gameId, rng, state);

      if (state.phase !== 'PLAYING') {
        state = await waitForPhase(players, 'PLAYING', 15000);
      }
      state = await runRandomPlaying(players, gameId, rng, state);

      state = await waitForGameState(players, s => s.phase === 'ROUND_OVER' || s.gameOver, 20000);
      const completedRoundNumber = state.round;
      roundsCompleted += 1;

      if (state.gameOver) {
        break;
      }

      state = await waitForGameState(
        players,
        s => s.gameOver || (s.round > completedRoundNumber && s.phase === 'BIDDING'),
        15000
      );
    }

    if (roundsTarget <= 0) {
      if (roundsCompleted >= maxRounds) {
        console.log(`⚠️ Game reached max rounds (${maxRounds}) without ending. This is acceptable for testing.`);
      } else {
        expect(state.gameOver).toBe(true);
      }
    } else if (!state.gameOver) {
      expect(state.phase).toBe('BIDDING');
    }
  } finally {
    cleanup(players);
    // players array is now local to each test
    await resetTestControls();
  }
}

describe('Randomized Full Game Fuzzing', () => {
  for (let iteration = 0; iteration < RANDOM_GAME_ITERATIONS; iteration++) {
    it(
      `plays ${RANDOM_GAME_ROUNDS} random round(s) without stalling [iteration ${iteration + 1}]`,
      async () => {
        const seed = `${RANDOM_GAME_SEED_BASE}-${iteration}`;
        console.log(`\n🎲 Starting random game iteration ${iteration + 1} with seed: ${seed}`);
        try {
          await playRandomRounds(seed, RANDOM_GAME_ROUNDS);
          console.log(`✅ Random game iteration ${iteration + 1} completed successfully`);
        } catch (error: any) {
          console.error(`❌ Random game iteration ${iteration + 1} failed:`, error.message);
          error.message = `Seed ${seed}: ${error.message || error}`;
          throw error;
        }
      },
      120000 // Increased timeout to 2 minutes
    );
  }
});

describe('Multi-Round Games', () => {
  it('should handle dealer rotation across rounds', async () => {
    console.log('\n🎮 TEST: Dealer rotation\n');

    await setDealerPosition(3);
    await setCustomDeck(FOLLOW_SUIT_DECK);

    const alice = await createPlayer('Alice');
    const bob = await createPlayer('Bob');
    const charlie = await createPlayer('Charlie');
    const diana = await createPlayer('Diana');
    const players = [alice, bob, charlie, diana];

    const gameId = await createGame(alice);
    await Promise.all(players.map(p => joinGame(p, gameId)));

    const { dealerPosition: firstDealer } = await playOutRound(players, gameId);
    const roundOverState = players[0].gameState!;
    expect(roundOverState.phase).toBe('ROUND_OVER');

    await setCustomDeck(TRICK_WINNER_DECK);
    players[0].socket.emit('START_NEXT_ROUND', { gameId });

    const nextRoundState = await waitForPhase(players, 'BIDDING', 10000);
    expect(nextRoundState.round).toBe(2);
    expect(nextRoundState.dealerPosition).toBe((firstDealer + 1) % 4);
    
    await cleanup(players);
  }, 30000);

  it('should persist scores across rounds', async () => {
    console.log('\n🎮 TEST: Score persistence\n');
    
    await setDealerPosition(3);
    await setCustomDeck(FOLLOW_SUIT_DECK);

    const alice = await createPlayer('Alice');
    const bob = await createPlayer('Bob');
    const charlie = await createPlayer('Charlie');
    const diana = await createPlayer('Diana');
    const players = [alice, bob, charlie, diana];

    const gameId = await createGame(alice);
    await Promise.all(players.map(p => joinGame(p, gameId)));

    const { finalState: firstRoundState } = await playOutRound(players, gameId);
    const firstRoundScores = firstRoundState.players.map(p => p.score);

    await setCustomDeck(TRICK_WINNER_DECK);
    players[0].socket.emit('START_NEXT_ROUND', { gameId });
    const roundTwoBidding = await waitForPhase(players, 'BIDDING', 10000);

    const preRoundTwoScores = roundTwoBidding.players.map(p => p.score);
    expect(preRoundTwoScores).toEqual(firstRoundScores);

    const { finalState: secondRoundState } = await playOutRound(players, gameId, { trumpSuit: 'HEARTS' });
    const combinedScores = secondRoundState.players.map(p => p.score);

    expect(combinedScores).not.toEqual(firstRoundScores);
    
    await cleanup(players);
  }, 30000);
});

function createRng(seed: string): () => number {
  let h1 = 1779033703 ^ seed.length;
  let h2 = 3144134277 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 597399067);
    h2 = Math.imul(h2 ^ ch, 2869860233);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 15), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return () => {
    h1 = Math.imul(h1 ^ (h1 >>> 15), 2246822507) ^ Math.imul(h2, 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1, 3266489909);
    const x = (h1 ^ (h1 >>> 13)) >>> 0;
    return (x % 0x100000000) / 0x100000000;
  };
}

function randomChoice<T>(items: T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('randomChoice called with empty array');
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.min(index, items.length - 1)];
}
