/**
 * @jest-environment node
 */

import {
  initializeGame,
  dealNewRound,
  applyBid,
  handleAllPlayersPass,
  applyTrumpDeclaration,
  applyFoldDecision,
  applyCardPlay,
  finishRound,
  startNextRound,
} from '../state';
import { GameState, PlayerPosition } from '../../../../shared/src/types/game';

describe('state.ts - State Transitions', () => {
  const playerIds: [string, string, string, string] = ['p1', 'p2', 'p3', 'p4'];

  describe('initializeGame', () => {
    it('should create initial game state', () => {
      const state = initializeGame(playerIds);
      
      expect(state.players).toHaveLength(4);
      expect(state.phase).toBe('DEALING');
      expect(state.round).toBe(0);
      expect(state.gameOver).toBe(false);
    });

    it('should initialize all players with score 15', () => {
      const state = initializeGame(playerIds);
      
      state.players.forEach(player => {
        expect(player.score).toBe(15);
        expect(player.tricksTaken).toBe(0);
        expect(player.folded).toBe(false);
        expect(player.foldDecision).toBe('UNDECIDED');
      });
    });

    it('should assign positions 0-3', () => {
      const state = initializeGame(playerIds);
      
      expect(state.players[0].position).toBe(0);
      expect(state.players[1].position).toBe(1);
      expect(state.players[2].position).toBe(2);
      expect(state.players[3].position).toBe(3);
    });

    it('should randomly select dealer position', () => {
      const positions = new Set<number>();
      for (let i = 0; i < 20; i++) {
        const state = initializeGame(playerIds);
        positions.add(state.dealerPosition);
      }
      // Should see multiple different positions
      expect(positions.size).toBeGreaterThan(1);
    });
  });

  describe('dealNewRound', () => {
    it('should increment round number', () => {
      let state = initializeGame(playerIds);
      expect(state.round).toBe(0);
      
      state = dealNewRound(state);
      expect(state.round).toBe(1);
    });

    it('should deal 5 cards to each player', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);
      
      state.players.forEach(player => {
        expect(player.hand).toHaveLength(5);
      });
    });

    it('should create 4-card blind', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);
      
      expect(state.blind).toHaveLength(4);
      expect(state.turnUpCard).toBe(state.blind[0]);
    });

    it('should set isClubsTurnUp correctly', () => {
      let state = initializeGame(playerIds);
      
      // Deal until we get a Clubs turn-up (or test both cases)
      for (let i = 0; i < 10; i++) {
        state = dealNewRound(state);
        if (state.turnUpCard!.suit === 'CLUBS') {
          expect(state.isClubsTurnUp).toBe(true);
          break;
        } else {
          expect(state.isClubsTurnUp).toBe(false);
        }
      }
    });

    it('should reset player states', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);
      
      // Modify player states
      state.players[0].tricksTaken = 3;
      state.players[0].folded = true;
      state.players[0].foldDecision = 'FOLD';

      // Deal new round
      state = dealNewRound(state);
      
      state.players.forEach(player => {
        expect(player.tricksTaken).toBe(0);
        expect(player.folded).toBe(false);
        expect(player.foldDecision).toBe('UNDECIDED');
      });
    });

    it('should transition to BIDDING phase', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);
      
      expect(state.phase).toBe('BIDDING');
    });

    it('should set currentBidder to left of dealer', () => {
      let state = initializeGame(playerIds);
      state.dealerPosition = 0;
      state = dealNewRound(state);
      
      expect(state.currentBidder).toBe(1);
    });
  });

  describe('applyBid', () => {
    let state: GameState;

    beforeEach(() => {
      state = initializeGame(playerIds);
      state = dealNewRound(state);
    });

    it('should add bid to bids array', () => {
      state = applyBid(state, 1, 2);
      
      expect(state.bids).toHaveLength(1);
      expect(state.bids[0]).toEqual({ playerPosition: 1, amount: 2 });
    });

    it('should update highest bid and winner', () => {
      state = applyBid(state, 1, 2);
      
      expect(state.highestBid).toBe(2);
      expect(state.winningBidderPosition).toBe(1);
    });

    it('should not update highest bid on PASS', () => {
      state = applyBid(state, 1, 'PASS');
      
      expect(state.highestBid).toBeNull();
      expect(state.winningBidderPosition).toBeNull();
    });

    it('should rotate to next bidder', () => {
      state = applyBid(state, 1, 2);
      
      expect(state.currentBidder).toBe(2);
    });

    it('should skip passed players', () => {
      state = applyBid(state, 1, 'PASS');
      state = applyBid(state, 2, 3);
      state = applyBid(state, 3, 'PASS');
      state = applyBid(state, 0, 'PASS');
      
      expect(state.phase).toBe('DECLARING_TRUMP');
      expect(state.currentBidder).toBeNull();
    });

    it('should transition to DECLARING_TRUMP when bidding complete', () => {
      state = applyBid(state, 1, 2);
      state = applyBid(state, 2, 'PASS');
      state = applyBid(state, 3, 'PASS');
      state = applyBid(state, 0, 'PASS');
      
      expect(state.phase).toBe('DECLARING_TRUMP');
    });

    it('should transition to DEALING when all pass', () => {
      state.dealerPosition = 0 as PlayerPosition;
      state.currentBidder = 1 as PlayerPosition;

      state = applyBid(state, 1, 'PASS');
      state = applyBid(state, 2, 'PASS');
      state = applyBid(state, 3, 'PASS');
      state = applyBid(state, 0, 'PASS');

      expect(state.phase).toBe('DEALING');
      expect(state.dealerPosition).toBe(1);
      expect(state.bids).toHaveLength(0);
      expect(state.highestBid).toBeNull();
      expect(state.winningBidderPosition).toBeNull();
      expect(state.currentBidder).toBeNull();
    });
  });

  describe('handleAllPlayersPass', () => {
    it('should rotate dealer', () => {
      let state = initializeGame(playerIds);
      state.dealerPosition = 1;
      
      state = handleAllPlayersPass(state);
      
      expect(state.dealerPosition).toBe(2);
    });

    it('should wrap dealer position', () => {
      let state = initializeGame(playerIds);
      state.dealerPosition = 3;
      
      state = handleAllPlayersPass(state);
      
      expect(state.dealerPosition).toBe(0);
    });

    it('should reset bidding state', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);
      state = applyBid(state, 1, 2);
      
      state = handleAllPlayersPass(state);
      
      expect(state.bids).toHaveLength(0);
      expect(state.highestBid).toBeNull();
      expect(state.winningBidderPosition).toBeNull();
    });

    it('should set phase to DEALING', () => {
      let state = initializeGame(playerIds);
      state.phase = 'BIDDING';
      
      state = handleAllPlayersPass(state);
      
      expect(state.phase).toBe('DEALING');
    });
  });

  describe('applyTrumpDeclaration', () => {
    it('should set trump suit', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);
      state = applyBid(state, 1, 3);
      
      state = applyTrumpDeclaration(state, 'HEARTS');
      
      expect(state.trumpSuit).toBe('HEARTS');
    });

    it('should transition to FOLDING_DECISION phase', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);
      
      // Ensure clubs are not turned up (otherwise it skips folding)
      state.isClubsTurnUp = false;
      
      state = applyTrumpDeclaration(state, 'SPADES');
      
      expect(state.phase).toBe('FOLDING_DECISION');
    });
  });

  describe('applyFoldDecision', () => {
    let state: GameState;

    beforeEach(() => {
      state = initializeGame(playerIds);
      state = dealNewRound(state);
      state = applyBid(state, 1, 3);
      state = applyBid(state, 2, 'PASS');
      state = applyBid(state, 3, 'PASS');
      state = applyBid(state, 0, 'PASS');
      state = applyTrumpDeclaration(state, 'HEARTS');
    });

    it('should set player folded status', () => {
      state = applyFoldDecision(state, 0, true);

      expect(state.players[0].folded).toBe(true);
      expect(state.players[0].foldDecision).toBe('FOLD');
    });

    it('should transition to PLAYING when all decided', () => {
      state = applyFoldDecision(state, 0, true);
      state = applyFoldDecision(state, 2, false);
      state = applyFoldDecision(state, 3, true);

      expect(state.phase).toBe('PLAYING');
    });

    it('should not transition until every non-bidder decides', () => {
      state = applyFoldDecision(state, 0, true);
      expect(state.phase).toBe('FOLDING_DECISION');

      state = applyFoldDecision(state, 2, false);
      expect(state.phase).toBe('FOLDING_DECISION');
    });

    it('should set currentPlayerPosition to bidder when playing starts', () => {
      state = applyFoldDecision(state, 0, true);
      state = applyFoldDecision(state, 2, false);
      state = applyFoldDecision(state, 3, true);

      expect(state.currentPlayerPosition).toBe(1);
    });

    it('should record stay decisions distinctly', () => {
      state = applyFoldDecision(state, 0, false);
      expect(state.players[0].folded).toBe(false);
      expect(state.players[0].foldDecision).toBe('STAY');
    });

    it('should prevent players from changing decisions', () => {
      state = applyFoldDecision(state, 0, true);
      expect(() => applyFoldDecision(state, 0, false)).toThrow('already recorded');
    });
  });

  describe('applyCardPlay', () => {
    let state: GameState;

    beforeEach(() => {
      state = initializeGame(playerIds);
      state = dealNewRound(state);
      state = applyBid(state, 1, 3);
      state = applyBid(state, 2, 'PASS');
      state = applyBid(state, 3, 'PASS');
      state = applyBid(state, 0, 'PASS');
      state = applyTrumpDeclaration(state, 'HEARTS');
      state = applyFoldDecision(state, 0, false);
      state = applyFoldDecision(state, 2, false);
      state = applyFoldDecision(state, 3, false);
    });

    it('should remove card from hand', () => {
      const cardId = state.players[1].hand[0].id;
      const initialHandSize = state.players[1].hand.length;
      
      state = applyCardPlay(state, 1, cardId);
      
      expect(state.players[1].hand).toHaveLength(initialHandSize - 1);
      expect(state.players[1].hand.some(c => c.id === cardId)).toBe(false);
    });

    it('should add card to current trick', () => {
      const cardId = state.players[1].hand[0].id;
      
      state = applyCardPlay(state, 1, cardId);
      
      expect(state.currentTrick.cards).toHaveLength(1);
      expect(state.currentTrick.cards[0].card.id).toBe(cardId);
    });

    it('should rotate to next player', () => {
      const cardId = state.players[1].hand[0].id;
      
      state = applyCardPlay(state, 1, cardId);
      
      expect(state.currentPlayerPosition).toBe(2);
    });

    it('should complete trick when all active players play', () => {
      // All 4 players active
      const card1 = state.players[1].hand[0].id;
      const card2 = state.players[2].hand[0].id;
      const card3 = state.players[3].hand[0].id;
      const card4 = state.players[0].hand[0].id;
      
      state = applyCardPlay(state, 1, card1);
      state = applyCardPlay(state, 2, card2);
      state = applyCardPlay(state, 3, card3);
      state = applyCardPlay(state, 0, card4);
      
      expect(state.tricks).toHaveLength(1);
      expect(state.tricks[0].winner).not.toBeNull();
    });

    it('should start new trick after completion', () => {
      const card1 = state.players[1].hand[0].id;
      const card2 = state.players[2].hand[0].id;
      const card3 = state.players[3].hand[0].id;
      const card4 = state.players[0].hand[0].id;
      
      state = applyCardPlay(state, 1, card1);
      state = applyCardPlay(state, 2, card2);
      state = applyCardPlay(state, 3, card3);
      state = applyCardPlay(state, 0, card4);
      
      expect(state.currentTrick.number).toBe(2);
      expect(state.currentTrick.cards).toHaveLength(0);
    });

    it('should transition to ROUND_OVER after 5 tricks', () => {
      // Play 5 complete tricks
      for (let trick = 0; trick < 5; trick++) {
        // Play one complete trick (4 cards)
        for (let cardNum = 0; cardNum < 4; cardNum++) {
          if (state.phase === 'ROUND_OVER') break;
          
          const currentPlayer = state.currentPlayerPosition!;
          const cardToPlay = state.players[currentPlayer].hand[0].id;
          state = applyCardPlay(state, currentPlayer, cardToPlay);
        }
        
        if (state.phase === 'ROUND_OVER') break;
      }
      
      expect(state.phase).toBe('ROUND_OVER');
      expect(state.tricks).toHaveLength(5);
    });
  });

  describe('finishRound', () => {
    let state: GameState;

    beforeEach(() => {
      state = initializeGame(playerIds);
      state = dealNewRound(state);
      state = applyBid(state, 1, 3);
      state.phase = 'ROUND_OVER';
      state.highestBid = 3;
      state.winningBidderPosition = 1;
      
      // Set tricks taken
      state.players[1].tricksTaken = 3;
      state.players[0].tricksTaken = 1;
      state.players[2].tricksTaken = 1;
      state.players[3].tricksTaken = 0;
    });

    it('should update player scores', () => {
      const initialScores = state.players.map(p => p.score);
      
      state = finishRound(state);
      
      // Scores should have changed
      expect(state.players[0].score).not.toBe(initialScores[0]);
      expect(state.players[1].score).not.toBe(initialScores[1]);
    });

    it('should transition to ROUND_OVER', () => {
      state = finishRound(state);
      
      expect(state.phase).toBe('ROUND_OVER');
    });

    it('should not rotate dealer yet (happens in startNextRound)', () => {
      const initialDealer = state.dealerPosition;
      
      state = finishRound(state);
      
      // Dealer position unchanged until startNextRound is called
      expect(state.dealerPosition).toBe(initialDealer);
    });

    it('should transition to GAME_OVER when player reaches 0', () => {
      state.players[1].score = 3; // Bidder will go to 0 or below
      
      state = finishRound(state);
      
      expect(state.phase).toBe('GAME_OVER');
      expect(state.gameOver).toBe(true);
      expect(state.winner).toBe(1);
    });

    it('should set winner to lowest score', () => {
      state.players[0].score = 0;
      state.players[1].score = -2;
      state.players[2].score = 1;
      
      state = finishRound(state);
      
      expect(state.winner).toBe(1); // Lowest score
      expect(state.gameOver).toBe(true);
    });
  });

  describe('startNextRound', () => {
    it('should transition from ROUND_OVER to DEALING', () => {
      let state = initializeGame(playerIds);
      state.phase = 'ROUND_OVER';
      const initialDealer = state.dealerPosition;
      
      state = startNextRound(state);
      
      expect(state.phase).toBe('DEALING');
      expect(state.dealerPosition).toBe((initialDealer + 1) % 4);
    });

    it('should throw error if not in ROUND_OVER phase', () => {
      let state = initializeGame(playerIds);
      state.phase = 'PLAYING';
      
      expect(() => startNextRound(state)).toThrow('Can only start next round from ROUND_OVER phase');
    });
  });

  describe('Complete game flow', () => {
    it('should handle full round cycle', () => {
      let state = initializeGame(playerIds);
      expect(state.phase).toBe('DEALING');
      
      state = dealNewRound(state);
      expect(state.phase).toBe('BIDDING');
      expect(state.round).toBe(1);
      
      state = applyBid(state, 1, 2);
      state = applyBid(state, 2, 'PASS');
      state = applyBid(state, 3, 'PASS');
      state = applyBid(state, 0, 'PASS');
      expect(state.phase).toBe('DECLARING_TRUMP');
      
      state = applyTrumpDeclaration(state, 'HEARTS');
      expect(state.phase).toBe('FOLDING_DECISION');
      
      state = applyFoldDecision(state, 0, false);
      state = applyFoldDecision(state, 2, false);
      state = applyFoldDecision(state, 3, false);
      expect(state.phase).toBe('PLAYING');
      
      // Play 5 tricks
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 4; j++) {
          if (state.phase !== 'PLAYING') break;
          const currentPlayer = state.currentPlayerPosition!;
          const card = state.players[currentPlayer].hand[0];
          state = applyCardPlay(state, currentPlayer, card.id);
        }
      }
      
      expect(state.phase).toBe('ROUND_OVER');
      
      state = finishRound(state);
      expect(state.phase).toBe('ROUND_OVER');

      state = startNextRound(state);
      expect(state.phase).toBe('DEALING');
    });

    it('should handle all players pass scenario', () => {
      let state = initializeGame(playerIds);
      state = dealNewRound(state);

      const initialDealer = state.dealerPosition;

      state = applyBid(state, 1, 'PASS');
      state = applyBid(state, 2, 'PASS');
      state = applyBid(state, 3, 'PASS');
      state = applyBid(state, 0, 'PASS');

      expect(state.phase).toBe('DEALING');
      expect(state.dealerPosition).toBe(((initialDealer + 1) % 4) as PlayerPosition);
    });
  });
});
