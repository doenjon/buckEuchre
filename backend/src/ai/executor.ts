/**
 * @module ai/executor
 * @description Execute AI decisions with realistic timing
 * 
 * This module takes AI decisions and executes them through the game's
 * action system, simulating human-like thinking delays.
 */

import { GameState, PlayerPosition, BidAmount, Suit, Card } from '@buck-euchre/shared';
import { executeGameAction, getActiveGameState } from '../services/state.service';
import {
  applyBid,
  applyTrumpDeclaration,
  applyFoldDecision,
  applyCardPlay,
  finishRound,
  startNextRound,
  dealNewRound,
} from '../game/state';
import { decideBid, decideTrump, decideFold, decideCardToPlay } from './decision-engine';
import { Server } from 'socket.io';
import { checkAndTriggerAI } from './trigger';

/**
 * Delay for a specified amount of time
 * 
 * @param ms - Milliseconds to delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get a random thinking delay (500-2000ms)
 * 
 * @returns Delay in milliseconds
 */
function getThinkingDelay(): number {
  return 500 + Math.random() * 1500;
}

/**
 * Find player position by ID
 * 
 * @param gameState - Current game state
 * @param playerId - Player ID to find
 * @returns Player position, or null if not found
 */
function findPlayerPosition(gameState: GameState, playerId: string): PlayerPosition | null {
  const player = gameState.players.find((p: any) => p.id === playerId);
  return player ? player.position : null;
}

/**
 * Execute AI turn based on current game phase
 * 
 * @param gameId - ID of the game
 * @param aiPlayerId - ID of the AI player
 * @param io - Socket.io server for broadcasting updates
 */
export async function executeAITurn(
  gameId: string,
  aiPlayerId: string,
  io: Server
): Promise<void> {
  try {
    const state = getActiveGameState(gameId);
    if (!state) {
      console.error(`[AI] Game ${gameId} not found`);
      return;
    }

    const aiPosition = findPlayerPosition(state, aiPlayerId);
    if (aiPosition === null) {
      console.error(`[AI] Player ${aiPlayerId} not found in game ${gameId}`);
      return;
    }

    const aiPlayer = state.players[aiPosition];
    const phase = state.phase;

    console.log(`[AI] ${aiPlayer.name} is thinking (phase: ${phase})...`);

    // Simulate thinking time
    const thinkingTime = getThinkingDelay();
    await delay(thinkingTime);

    // Execute action based on phase
    switch (phase) {
      case 'BIDDING':
        await executeAIBid(gameId, aiPlayerId, aiPosition, state, io);
        break;

      case 'DECLARING_TRUMP':
        await executeAIDeclareTrump(gameId, aiPlayerId, aiPosition, state, io);
        break;

      case 'FOLDING_DECISION':
        await executeAIFoldDecision(gameId, aiPlayerId, aiPosition, state, io);
        break;

      case 'PLAYING':
        await executeAICardPlay(gameId, aiPlayerId, aiPosition, state, io);
        break;

      default:
        // AI doesn't need to act in other phases
        break;
    }
  } catch (error: any) {
    console.error(`[AI] Error executing turn for ${aiPlayerId}:`, error.message || error);
  }
}

/**
 * Execute AI bidding decision
 */
async function executeAIBid(
  gameId: string,
  aiPlayerId: string,
  aiPosition: PlayerPosition,
  state: GameState,
  io: Server
): Promise<void> {
  // Check if it's AI's turn
  if (state.currentBidder !== aiPosition) {
    return;
  }

  const aiPlayer = state.players[aiPosition];
  const bid = decideBid(aiPlayer.hand, state.turnUpCard!, state.highestBid);

  console.log(`[AI] ${aiPlayer.name} bids: ${bid}`);

  // Apply bid through action queue
  const newState = await executeGameAction(gameId, async (currentState) => {
    return applyBid(currentState, aiPosition, bid);
  });

  // Broadcast update
  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: newState,
    event: 'BID_PLACED',
    data: {
      playerPosition: aiPosition,
      playerName: aiPlayer.name,
      amount: bid,
    },
  });

  // Trigger next AI if needed
  await checkAndTriggerAI(gameId, newState, io);
}

/**
 * Execute AI trump declaration
 */
async function executeAIDeclareTrump(
  gameId: string,
  aiPlayerId: string,
  aiPosition: PlayerPosition,
  state: GameState,
  io: Server
): Promise<void> {
  // Check if AI is the winning bidder
  if (state.winningBidderPosition !== aiPosition) {
    return;
  }

  const aiPlayer = state.players[aiPosition];
  const trumpSuit = decideTrump(aiPlayer.hand, state.turnUpCard!);

  console.log(`[AI] ${aiPlayer.name} declares trump: ${trumpSuit}`);

  // Apply trump declaration through action queue
  const newState = await executeGameAction(gameId, async (currentState) => {
    return applyTrumpDeclaration(currentState, trumpSuit);
  });

  // Broadcast update
  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: newState,
    event: 'TRUMP_DECLARED',
    data: {
      playerPosition: aiPosition,
      playerName: aiPlayer.name,
      trumpSuit,
    },
  });

  // Trigger next AI if needed
  await checkAndTriggerAI(gameId, newState, io);
}

/**
 * Execute AI fold decision
 */
async function executeAIFoldDecision(
  gameId: string,
  aiPlayerId: string,
  aiPosition: PlayerPosition,
  state: GameState,
  io: Server
): Promise<void> {
  // Check if AI is not the bidder (only non-bidders can fold)
  if (state.winningBidderPosition === aiPosition) {
    return;
  }

  // Check if AI already made a fold decision
  const aiPlayer = state.players[aiPosition];
  if (aiPlayer.foldDecision !== 'UNDECIDED') {
    // Player already decided (either folded or explicitly stayed)
    return;
  }

  const shouldFold = decideFold(aiPlayer.hand, state.trumpSuit!, state.isClubsTurnUp);

  console.log(`[AI] ${aiPlayer.name} decides to ${shouldFold ? 'fold' : 'stay'}`);

  // Apply fold decision through action queue
  const newState = await executeGameAction(gameId, async (currentState) => {
    return applyFoldDecision(currentState, aiPosition, shouldFold);
  });

  // Broadcast update
  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: newState,
    event: 'FOLD_DECISION',
    data: {
      playerPosition: aiPosition,
      playerName: aiPlayer.name,
      folded: shouldFold,
    },
  });

  // Trigger next AI if needed
  await checkAndTriggerAI(gameId, newState, io);
}

/**
 * Execute AI card play
 */
async function executeAICardPlay(
  gameId: string,
  aiPlayerId: string,
  aiPosition: PlayerPosition,
  state: GameState,
  io: Server
): Promise<void> {
  // Check if it's AI's turn
  if (state.currentPlayerPosition !== aiPosition) {
    return;
  }

  const aiPlayer = state.players[aiPosition];

  // Check if AI has folded
  if (aiPlayer.folded) {
    console.error(`[AI] ${aiPlayer.name} has folded and cannot play cards`);
    return;
  }

  const card = decideCardToPlay(state, aiPosition);

  console.log(`[AI] ${aiPlayer.name} plays: ${card.rank} of ${card.suit}`);

  // Apply card play through action queue
  let newState = await executeGameAction(gameId, async (currentState) => {
    return applyCardPlay(currentState, aiPosition, card.id);
  });

  // Check if round ended and finish it
  if (newState.phase === 'ROUND_OVER') {
    newState = await executeGameAction(gameId, async (currentState) => {
      return finishRound(currentState);
    });
    
    console.log(`[AI] Round completed`, {
      gameOver: newState.gameOver,
      scores: newState.players.map(p => ({ name: p.name, score: p.score }))
    });

    // Emit round complete event
    io.to(`game:${gameId}`).emit('ROUND_COMPLETE', {
      roundNumber: newState.round,
      scores: newState.players.map(p => ({ name: p.name, score: p.score }))
    });
  }

  // Broadcast update
  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: newState,
    event: 'CARD_PLAYED',
    data: {
      playerPosition: aiPosition,
      playerName: aiPlayer.name,
      card,
    },
  });

  // Trigger next AI if needed
  await checkAndTriggerAI(gameId, newState, io);

  // If round just ended, automatically start next round after delay
  if (newState.phase === 'ROUND_OVER' && !newState.gameOver) {
    setTimeout(async () => {
      try {
        console.log(`[AI] Auto-starting next round for game ${gameId}`);
        
        // Transition to DEALING
        const dealingState = await executeGameAction(gameId, startNextRound);
        
        // Deal cards and transition to BIDDING
        const biddingState = await executeGameAction(gameId, dealNewRound);
        
        // Broadcast update
        io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
          gameState: biddingState,
          event: 'ROUND_STARTED'
        });
        
        console.log(`[AI] Auto-started round ${biddingState.round}`);
        
        // Trigger AI for next round
        await checkAndTriggerAI(gameId, biddingState, io);
      } catch (error: any) {
        console.error(`[AI] Error auto-starting next round:`, error.message);
      }
    }, 5000); // 5 second delay to show scores
  }
}
