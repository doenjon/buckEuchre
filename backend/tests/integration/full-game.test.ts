/**
 * Full Game Flow Integration Tests
 * 
 * These tests simulate complete games of Buck Euchre from start to finish,
 * including all phases: dealing, bidding, trump, folding, playing, and scoring.
 */

import { io as ioClient, Socket } from 'socket.io-client';
import { GameState, GamePhase, Card, Suit } from '../../../shared/src/types/game';

const BACKEND_URL = 'http://localhost:3000';

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

/**
 * Wait for all players to have game state matching condition
 */
async function waitForGameState(
  players: Player[],
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
 * Find a valid card to play (following suit rules)
 */
function findValidCard(hand: Card[], gameState: GameState): Card | null {
  if (hand.length === 0) return null;
  
  // If leading the trick, any card is valid
  if (gameState.currentTrick.cards.length === 0) {
    return hand[0];
  }
  
  // Must follow suit if possible
  const leadSuit = gameState.currentTrick.cards[0].card.suit;
  const suitCards = hand.filter(c => c.suit === leadSuit);
  
  if (suitCards.length > 0) {
    return suitCards[0];
  }
  
  // Can't follow suit, play any card
  return hand[0];
}

function cleanup(players: Player[]) {
  players.forEach(p => p.socket?.disconnect());
}

describe('Full Game Flow', () => {
  let players: Player[] = [];

  afterEach(() => {
    cleanup(players);
    players = [];
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
      players = [alice, bob, charlie, diana];

      const gameId = await createGame(alice);
      await Promise.all(players.map(p => joinGame(p, gameId)));

      // DEALING PHASE
      console.log('\n📋 Phase: DEALING');
      const dealState = await waitForPhase(players, 'DEALING', 10000);
      
      expect(dealState.phase).toBe('DEALING');
      expect(dealState.round).toBe(1);
      expect(dealState.blind).toHaveLength(4);
      expect(dealState.turnUpCard).toBeTruthy();
      
      // Each player should have 5 cards
      dealState.players.forEach((p, i) => {
        expect(p.hand).toHaveLength(5);
        console.log(`  Player ${i} (${p.name}): ${p.hand.length} cards`);
      });

      console.log(`  Turn-up card: ${dealState.turnUpCard?.rank} of ${dealState.turnUpCard?.suit}`);
      console.log(`  Dirty clubs: ${dealState.isClubsTurnUp}`);

      // Game should auto-advance to BIDDING
      console.log('\n💰 Phase: BIDDING');
      const bidState = await waitForPhase(players, 'BIDDING', 10000);
      
      expect(bidState.phase).toBe('BIDDING');
      expect(bidState.currentBidder).toBeDefined();
      
      const dealerPos = bidState.dealerPosition;
      const firstBidder = (dealerPos + 1) % 4;
      expect(bidState.currentBidder).toBe(firstBidder);
      
      console.log(`  Dealer: Player ${dealerPos}`);
      console.log(`  First bidder: Player ${firstBidder}`);

      // Simulate bidding: Player after dealer bids 3, others pass
      const bidder = players[firstBidder];
      console.log(`  ${bidder.name} bids 3`);
      bidder.socket.emit('PLACE_BID', { bid: 3 });

      // Wait for next player's turn
      await waitForGameState(players, state => 
        state.phase === 'BIDDING' && state.currentBidder === (firstBidder + 1) % 4
      );

      // Other players pass
      for (let i = 1; i < 4; i++) {
        const currentPlayer = players[(firstBidder + i) % 4];
        console.log(`  ${currentPlayer.name} passes`);
        currentPlayer.socket.emit('PLACE_BID', { bid: 0 });
        
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
      bidder.socket.emit('DECLARE_TRUMP', { suit: 'HEARTS' });

      // FOLDING DECISION PHASE (if not dirty clubs)
      if (!trumpState.isClubsTurnUp) {
        console.log('\n🎴 Phase: FOLDING DECISION');
        const foldState = await waitForPhase(players, 'FOLDING_DECISION', 10000);
        
        expect(foldState.phase).toBe('FOLDING_DECISION');
        
        // Non-bidders make folding decisions
        for (let i = 0; i < 4; i++) {
          if (i !== firstBidder) {
            const shouldFold = i % 2 === 0; // Alternate fold/stay for testing
            console.log(`  Player ${i} (${players[i].name}): ${shouldFold ? 'FOLDS' : 'STAYS'}`);
            players[i].socket.emit('FOLD_DECISION', { fold: shouldFold });
            
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      } else {
        console.log('\n🎴 Dirty clubs - skipping folding phase');
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
        console.log(`\n  --- Trick ${trickNum} ---`);
        
        // Play cards for this trick (4 cards total, or fewer if players folded)
        const activePlayers = playState.players.filter(p => !p.folded);
        
        for (let cardNum = 0; cardNum < activePlayers.length; cardNum++) {
          const currentState = players[0].gameState!;
          const currentPlayerPos = currentState.currentPlayerPosition;
          
          if (currentPlayerPos === null) break;
          
          const currentPlayer = players[currentPlayerPos];
          const hand = getPlayerHand(currentState, currentPlayer.playerId);
          const cardToPlay = findValidCard(hand, currentState);
          
          if (cardToPlay) {
            console.log(`    Player ${currentPlayerPos} (${currentPlayer.name}) plays ${cardToPlay.rank} of ${cardToPlay.suit}`);
            currentPlayer.socket.emit('PLAY_CARD', { cardId: cardToPlay.id });
            
            // Wait for next player or trick completion
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        // Wait for trick to complete
        await waitForGameState(players, state => 
          state.tricks.length === trickNum || state.phase === 'ROUND_OVER'
        , 3000);
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
        console.log(`  ✅ Made bid! Score: 15 - ${bid} = ${15 - bid}`);
        expect(bidderPlayer.score).toBe(15 - bid);
      } else {
        console.log(`  ❌ Failed bid! Score: 15 + 5 = 20`);
        expect(bidderPlayer.score).toBe(20);
      }
      
      // Non-bidding players
      scoreState.players.forEach((p, i) => {
        if (i !== firstBidder && !p.folded) {
          console.log(`  Player ${i} (${p.name}): ${p.tricksTaken} tricks, score: ${p.score}`);
          expect(p.score).toBe(15 - p.tricksTaken);
        }
      });

      console.log('\n✅ GAME COMPLETE!');
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

      await waitForPhase(players, 'DEALING');
      const bidState = await waitForPhase(players, 'BIDDING');

      const firstBidder = bidState.currentBidder!;

      // All players pass
      console.log('All players passing...');
      for (let i = 0; i < 4; i++) {
        const currentPlayer = players[(firstBidder + i) % 4];
        console.log(`  ${currentPlayer.name} passes`);
        currentPlayer.socket.emit('PLACE_BID', { bid: 0 });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Should go back to DEALING (new round)
      const newState = await waitForPhase(players, 'DEALING', 10000);
      
      expect(newState.round).toBe(2);
      console.log('✅ New round dealt after all players passed');

      cleanup(players);
    }, 30000);

    it('should prevent folding when clubs are turned up (dirty clubs)', async () => {
      console.log('\n🎮 TEST: Dirty clubs (no folding allowed)\n');

      // Note: This test needs clubs to be turned up, which is random
      // In a real test suite, we'd either mock the dealing or run this test multiple times
      
      console.log('⚠️  This test requires clubs turn-up (random) - skipping for now');
      console.log('In production tests, mock the dealing function to force clubs');
      
      // Placeholder - would need to mock or retry until clubs appears
    }, 10000);
  });

  describe('Game Rules Validation', () => {
    it('should enforce following suit rules', async () => {
      console.log('\n🎮 TEST: Following suit rules\n');
      
      // This would test that players must follow suit if they have cards of the led suit
      // Would require inspecting player hands and validating card plays
      
      console.log('TODO: Implement suit-following validation test');
    }, 10000);

    it('should correctly determine trick winners', async () => {
      console.log('\n🎮 TEST: Trick winner determination\n');
      
      // Test trump beats non-trump
      // Test higher card of led suit wins
      // Test edge cases
      
      console.log('TODO: Implement trick winner test');
    }, 10000);

    it('should handle player reaching 0 or below (win condition)', async () => {
      console.log('\n🎮 TEST: Win condition\n');
      
      // Would need to play multiple rounds until a player reaches 0
      // Or mock initial scores to be close to 0
      
      console.log('TODO: Implement win condition test');
    }, 10000);
  });
});

describe('Multi-Round Games', () => {
  it('should handle dealer rotation across rounds', async () => {
    console.log('\n🎮 TEST: Dealer rotation\n');
    
    console.log('TODO: Play multiple rounds and verify dealer rotates');
  }, 10000);

  it('should persist scores across rounds', async () => {
    console.log('\n🎮 TEST: Score persistence\n');
    
    console.log('TODO: Verify scores carry over between rounds');
  }, 10000);
});

