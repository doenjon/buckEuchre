/**
 * Full Game Flow Integration Tests
 * 
 * Tests complete game flows including:
 * - Full game from dealing to scoring
 * - All players pass scenario
 * - Reconnection scenarios
 * - Edge cases
 */

import { io as ioClient, Socket } from 'socket.io-client';
import { GameState, GamePhase, Card, Suit } from '@buck-euchre/shared';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TIMEOUT = 60000; // 60 seconds for full game tests

interface TestPlayer {
  socket: Socket;
  name: string;
  playerId: string;
  token: string;
  gameState: GameState | null;
}

/**
 * Helper to create and authenticate a player
 */
async function createPlayer(name: string): Promise<TestPlayer> {
  const response = await fetch(`${BACKEND_URL}/api/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName: name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create player: ${response.statusText}`);
  }

  const { playerId, playerName, token } = await response.json();

  return new Promise((resolve, reject) => {
    const socket = ioClient(BACKEND_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: false,
    });

    const player: TestPlayer = {
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

/**
 * Helper to create a game
 */
async function createGame(token: string): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create game: ${response.statusText}`);
  }

  const { gameId } = await response.json();
  return gameId;
}

/**
 * Helper to join a game
 */
async function joinGame(player: TestPlayer, gameId: string): Promise<void> {
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

/**
 * Wait for game state condition
 */
async function waitForGameState(
  players: TestPlayer[],
  condition: (state: GameState) => boolean,
  timeout = 5000
): Promise<GameState> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const allStatesMatch = players.every(p => p.gameState && condition(p.gameState));

    if (allStatesMatch && players[0].gameState) {
      return players[0].gameState;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Timeout waiting for game state. Current phase: ${players[0].gameState?.phase || 'null'}`);
}

/**
 * Wait for specific phase
 */
async function waitForPhase(
  players: TestPlayer[],
  phase: GamePhase,
  timeout = 5000
): Promise<GameState> {
  return waitForGameState(players, state => state.phase === phase, timeout);
}

/**
 * Get player by position
 */
function getPlayerByPosition(
  players: TestPlayer[],
  gameState: GameState,
  position: number
): TestPlayer | null {
  const gamePlayer = gameState.players.find(p => p.position === position);
  if (!gamePlayer) return null;
  return players.find(p => p.playerId === gamePlayer.id) || null;
}

/**
 * Get player's hand
 */
function getPlayerHand(gameState: GameState, playerId: string): Card[] {
  const player = gameState.players.find(p => p.id === playerId);
  return player?.hand || [];
}

/**
 * Get effective suit (handles left bower)
 */
function getEffectiveSuit(card: Card, trumpSuit: Suit | null): Suit {
  if (!trumpSuit) return card.suit;

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
 * Find valid card to play
 */
function findValidCard(hand: Card[], gameState: GameState): Card | null {
  if (hand.length === 0) return null;

  // Leading the trick - any card valid
  if (gameState.currentTrick.cards.length === 0) {
    return hand[0];
  }

  // Must follow suit if possible
  const leadCard = gameState.currentTrick.cards[0].card;
  const leadSuit = getEffectiveSuit(leadCard, gameState.trumpSuit);
  const suitCards = hand.filter(c => getEffectiveSuit(c, gameState.trumpSuit) === leadSuit);

  if (suitCards.length > 0) {
    return suitCards[0];
  }

  // Can't follow suit - any card
  return hand[0];
}

/**
 * Cleanup helper
 */
function cleanup(players: TestPlayer[]) {
  players.forEach(p => {
    if (p.socket?.connected) {
      p.socket.disconnect();
    }
  });
}

describe('Full Game Flow Integration Tests', () => {
  let players: TestPlayer[] = [];

  afterEach(() => {
    cleanup(players);
    players = [];
  });

  describe('Complete Game Flow', () => {
    it('should successfully play through dealing → bidding → trump → folding → playing → scoring', async () => {
      console.log('\n🎮 Full Game Flow Test\n');

      // Create 4 players
      console.log('Creating players...');
      const player1 = await createPlayer('Alice');
      const player2 = await createPlayer('Bob');
      const player3 = await createPlayer('Charlie');
      const player4 = await createPlayer('Diana');
      players = [player1, player2, player3, player4];

      // Create and join game
      const gameId = await createGame(player1.token);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      // DEALING PHASE
      console.log('Waiting for DEALING phase...');
      const dealState = await waitForPhase(players, 'DEALING', 10000);
      expect(dealState.phase).toBe('DEALING');
      expect(dealState.blind).toHaveLength(4);
      expect(dealState.turnUpCard).toBeTruthy();
      console.log(`✓ Dealing complete (turn-up: ${dealState.turnUpCard?.rank} of ${dealState.turnUpCard?.suit})`);

      // BIDDING PHASE
      console.log('Waiting for BIDDING phase...');
      const bidState = await waitForPhase(players, 'BIDDING', 10000);
      expect(bidState.phase).toBe('BIDDING');
      expect(bidState.currentBidder).toBeDefined();

      const firstBidder = bidState.currentBidder!;
      const bidder = getPlayerByPosition(players, bidState, firstBidder);
      expect(bidder).not.toBeNull();

      console.log(`✓ Bidding started (first bidder: position ${firstBidder})`);

      // Place bids
      bidder!.socket.emit('PLACE_BID', { gameId, amount: 3 });

      await waitForGameState(players, state =>
        state.phase === 'BIDDING' && state.currentBidder === (firstBidder + 1) % 4
      );

      // Other players pass
      for (let i = 1; i < 4; i++) {
        const nextPos = (firstBidder + i) % 4;
        const currentPlayer = getPlayerByPosition(players, players[0].gameState!, nextPos);
        currentPlayer!.socket.emit('PLACE_BID', { gameId, amount: 'PASS' });

        if (i < 3) {
          await waitForGameState(players, state =>
            state.phase === 'BIDDING' && state.currentBidder === (firstBidder + i + 1) % 4
          );
        }
      }

      // TRUMP DECLARATION
      console.log('Waiting for DECLARING_TRUMP phase...');
      const trumpState = await waitForPhase(players, 'DECLARING_TRUMP', 10000);
      expect(trumpState.phase).toBe('DECLARING_TRUMP');
      expect(trumpState.highestBid).toBe(3);
      console.log('✓ Trump declaration phase reached');

      bidder!.socket.emit('DECLARE_TRUMP', { gameId, trumpSuit: 'HEARTS' });

      // FOLDING DECISION (if not dirty clubs)
      if (!trumpState.isClubsTurnUp) {
        console.log('Waiting for FOLDING_DECISION phase...');
        const foldState = await waitForPhase(players, 'FOLDING_DECISION', 10000);
        expect(foldState.phase).toBe('FOLDING_DECISION');
        console.log('✓ Folding decision phase reached');

        // Non-bidders make folding decisions
        for (let i = 0; i < 4; i++) {
          if (i !== firstBidder) {
            const player = getPlayerByPosition(players, foldState, i);
            player!.socket.emit('FOLD_DECISION', { gameId, folded: false });
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      } else {
        console.log('✓ Dirty clubs - skipping folding phase');
      }

      // PLAYING PHASE
      console.log('Waiting for PLAYING phase...');
      const playState = await waitForPhase(players, 'PLAYING', 10000);
      expect(playState.phase).toBe('PLAYING');
      expect(playState.trumpSuit).toBe('HEARTS');
      console.log('✓ Playing phase started');

      // Play tricks
      let tricksCompleted = 0;
      while (tricksCompleted < 5) {
        const currentState = players[0].gameState!;

        if (currentState.phase === 'ROUND_OVER') {
          break;
        }

        const currentPos = currentState.currentPlayerPosition;
        if (currentPos === null) break;

        const currentPlayer = getPlayerByPosition(players, currentState, currentPos);
        if (!currentPlayer) break;

        const hand = getPlayerHand(currentState, currentPlayer.playerId);
        const cardToPlay = findValidCard(hand, currentState);

        if (cardToPlay) {
          currentPlayer.socket.emit('PLAY_CARD', { gameId, cardId: cardToPlay.id });

          const prevTrickCount = currentState.tricks.length;
          await waitForGameState(players, state =>
            state.currentPlayerPosition !== currentPos ||
            state.tricks.length > prevTrickCount ||
            state.phase === 'ROUND_OVER'
          , 3000);

          if (players[0].gameState!.tricks.length > prevTrickCount) {
            tricksCompleted++;
            console.log(`✓ Trick ${tricksCompleted} completed`);
          }
        }
      }

      // ROUND OVER (Scoring)
      console.log('Waiting for ROUND_OVER phase...');
      const scoreState = await waitForPhase(players, 'ROUND_OVER', 10000);
      expect(scoreState.phase).toBe('ROUND_OVER');
      console.log('✓ Round over - scoring complete');

      // Verify scoring
      const bidderPlayer = scoreState.players[firstBidder];
      expect(bidderPlayer.score).toBeGreaterThanOrEqual(0);
      console.log(`Bidder score: ${bidderPlayer.score}`);

      console.log('\n✅ FULL GAME FLOW COMPLETE\n');
    }, TIMEOUT);
  });

  describe('Edge Case: All Players Pass', () => {
    it('should handle all players passing and deal new round', async () => {
      console.log('\n🎮 All Players Pass Test\n');

      const player1 = await createPlayer('Pass1');
      const player2 = await createPlayer('Pass2');
      const player3 = await createPlayer('Pass3');
      const player4 = await createPlayer('Pass4');
      players = [player1, player2, player3, player4];

      const gameId = await createGame(player1.token);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      await waitForPhase(players, 'DEALING');
      const bidState = await waitForPhase(players, 'BIDDING');

      const firstBidder = bidState.currentBidder!;
      console.log('All players passing...');

      // All pass
      for (let i = 0; i < 4; i++) {
        const currentPos = (firstBidder + i) % 4;
        const currentPlayer = getPlayerByPosition(players, players[0].gameState!, currentPos);
        currentPlayer!.socket.emit('PLACE_BID', { gameId, amount: 'PASS' });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Should deal new round
      console.log('Waiting for new DEALING phase...');
      const newDealState = await waitForPhase(players, 'DEALING', 10000);
      expect(newDealState.round).toBe(2);
      console.log('✓ New round dealt after all players passed');

      console.log('\n✅ ALL PLAYERS PASS TEST COMPLETE\n');
    }, TIMEOUT);
  });

  describe('Reconnection Scenarios', () => {
    it('should allow player to reconnect and rejoin game', async () => {
      console.log('\n🎮 Reconnection Test\n');

      const player1 = await createPlayer('Reconnect1');
      const player2 = await createPlayer('Reconnect2');
      const player3 = await createPlayer('Reconnect3');
      const player4 = await createPlayer('Reconnect4');
      players = [player1, player2, player3, player4];

      const gameId = await createGame(player1.token);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      await waitForPhase(players, 'DEALING');
      console.log('✓ Game started');

      // Disconnect player 2
      console.log('Disconnecting player 2...');
      player2.socket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(player2.socket.connected).toBe(false);

      // Reconnect player 2
      console.log('Reconnecting player 2...');
      await new Promise<void>((resolve, reject) => {
        player2.socket.once('connect', () => resolve());
        player2.socket.once('connect_error', reject);
        player2.socket.connect();
        setTimeout(() => reject(new Error('Reconnect timeout')), 5000);
      });

      expect(player2.socket.connected).toBe(true);
      console.log('✓ Player reconnected');

      // Rejoin game
      console.log('Rejoining game...');
      player2.socket.emit('JOIN_GAME', { gameId });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should receive game state
      expect(player2.gameState).not.toBeNull();
      console.log('✓ Player rejoined and received game state');

      console.log('\n✅ RECONNECTION TEST COMPLETE\n');
    }, TIMEOUT);

    it('should maintain game state when one player disconnects temporarily', async () => {
      console.log('\n🎮 Temporary Disconnect Test\n');

      const player1 = await createPlayer('Temp1');
      const player2 = await createPlayer('Temp2');
      const player3 = await createPlayer('Temp3');
      const player4 = await createPlayer('Temp4');
      players = [player1, player2, player3, player4];

      const gameId = await createGame(player1.token);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const initialState = await waitForPhase(players, 'DEALING');
      const initialRound = initialState.round;
      console.log(`✓ Game started (round ${initialRound})`);

      // Disconnect player 3 temporarily
      player3.socket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Other players should still have game state
      expect(player1.gameState).not.toBeNull();
      expect(player1.gameState?.round).toBe(initialRound);
      console.log('✓ Other players maintain game state');

      // Reconnect player 3
      await new Promise<void>((resolve, reject) => {
        player3.socket.once('connect', () => resolve());
        player3.socket.connect();
        setTimeout(() => reject(new Error('Reconnect timeout')), 5000);
      });

      player3.socket.emit('JOIN_GAME', { gameId });
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(player3.gameState?.round).toBe(initialRound);
      console.log('✓ Reconnected player has correct game state');

      console.log('\n✅ TEMPORARY DISCONNECT TEST COMPLETE\n');
    }, TIMEOUT);
  });

  describe('Dirty Clubs Scenario', () => {
    it('should skip folding phase when clubs are turned up', async () => {
      console.log('\n🎮 Dirty Clubs Test\n');
      console.log('Note: This test requires clubs to be turned up (random)');
      console.log('The test will run but may not encounter dirty clubs');

      const player1 = await createPlayer('Clubs1');
      const player2 = await createPlayer('Clubs2');
      const player3 = await createPlayer('Clubs3');
      const player4 = await createPlayer('Clubs4');
      players = [player1, player2, player3, player4];

      const gameId = await createGame(player1.token);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      const dealState = await waitForPhase(players, 'DEALING');
      
      if (dealState.isClubsTurnUp) {
        console.log('✓ Clubs turned up (dirty clubs!)');
        
        // Go through bidding
        const bidState = await waitForPhase(players, 'BIDDING');
        const firstBidder = bidState.currentBidder!;
        const bidder = getPlayerByPosition(players, bidState, firstBidder);
        
        bidder!.socket.emit('PLACE_BID', { gameId, amount: 3 });
        
        for (let i = 1; i < 4; i++) {
          const nextPos = (firstBidder + i) % 4;
          const currentPlayer = getPlayerByPosition(players, players[0].gameState!, nextPos);
          currentPlayer!.socket.emit('PLACE_BID', { gameId, amount: 'PASS' });
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Declare trump
        await waitForPhase(players, 'DECLARING_TRUMP');
        bidder!.socket.emit('DECLARE_TRUMP', { gameId, trumpSuit: 'HEARTS' });
        
        // Should skip directly to PLAYING (no FOLDING_DECISION)
        const playState = await waitForPhase(players, 'PLAYING', 10000);
        expect(playState.phase).toBe('PLAYING');
        console.log('✓ Skipped folding phase (as expected for dirty clubs)');
      } else {
        console.log('⚠️  Clubs not turned up this time - test inconclusive');
      }

      console.log('\n✅ DIRTY CLUBS TEST COMPLETE\n');
    }, TIMEOUT);
  });
});
