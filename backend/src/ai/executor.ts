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
} from '../game/state';
import { decideBid, decideTrump, decideFold, decideCardToPlay } from './decision-engine';
import { Server } from 'socket.io';
import { canFold, canPlaceBid, canPlayCard } from '../game/validation';
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
    const initialState = getActiveGameState(gameId);
    if (!initialState) {
      console.error(`[AI] Game ${gameId} not found`);
      return;
    }

    const initialPosition = findPlayerPosition(initialState, aiPlayerId);
    if (initialPosition === null) {
      console.error(`[AI] Player ${aiPlayerId} not found in game ${gameId}`);
      return;
    }

    const initialPlayer = initialState.players[initialPosition];
    const initialPhase = initialState.phase;

    console.log(`[AI] ${initialPlayer.name} is thinking (phase: ${initialPhase})...`);

    // Simulate thinking time
    const thinkingTime = getThinkingDelay();
    await delay(thinkingTime);

    const state = getActiveGameState(gameId);
    if (!state) {
      console.error(`[AI] Game ${gameId} not found after delay`);
      return;
    }

    const aiPosition = findPlayerPosition(state, aiPlayerId);
    if (aiPosition === null) {
      console.error(`[AI] Player ${aiPlayerId} not found in game ${gameId}`);
      return;
    }

    const aiPlayer = state.players[aiPosition];
    const phase = state.phase;

    // Execute action based on current phase
    switch (phase) {
      case 'BIDDING':
        if (state.currentBidder === aiPosition) {
          await executeAIBid(gameId, aiPlayerId, io);
        }
        break;

      case 'DECLARING_TRUMP':
        if (state.winningBidderPosition === aiPosition) {
          await executeAIDeclareTrump(gameId, aiPlayerId, io);
        }
        break;

      case 'FOLDING_DECISION':
        if (state.winningBidderPosition !== aiPosition && aiPlayer.foldDecision === 'UNDECIDED') {
          await executeAIFoldDecision(gameId, aiPlayerId, io);
        }
        break;

      case 'PLAYING':
        if (state.currentPlayerPosition === aiPosition) {
          await executeAICardPlay(gameId, aiPlayerId, io);
        }
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
  io: Server
): Promise<void> {
  let bidPlaced: {
    playerPosition: PlayerPosition;
    playerName: string;
    amount: BidAmount;
  } | null = null;

  const newState = await executeGameAction(gameId, async (currentState) => {
    const player = currentState.players.find((p: any) => p.id === aiPlayerId);
    if (!player) {
      console.warn(`[AI] Player ${aiPlayerId} missing during bid execution for game ${gameId}`);
      return currentState;
    }

    if (currentState.phase !== 'BIDDING') {
      console.log(`[AI] ${player.name} skipping bid - phase is ${currentState.phase}`);
      return currentState;
    }

    if (currentState.currentBidder !== player.position) {
      console.log(`[AI] ${player.name} skipping bid - not current bidder`);
      return currentState;
    }

    if (!currentState.turnUpCard) {
      console.warn(`[AI] ${player.name} cannot bid - missing turn up card`);
      return currentState;
    }

    const bid = decideBid(player.hand, currentState.turnUpCard, currentState.highestBid);

    const validation = canPlaceBid(
      bid,
      currentState.highestBid,
      currentState.bids.some((b: any) => b.playerPosition === player.position && b.amount === 'PASS'),
      currentState.bids.filter((b: any) => b.amount === 'PASS').length === 3
    );

    if (!validation.valid) {
      console.warn(`[AI] ${player.name} produced invalid bid ${bid}: ${validation.reason}`);
      return currentState;
    }

    console.log(`[AI] ${player.name} bids: ${bid}`);

    bidPlaced = {
      playerPosition: player.position,
      playerName: player.name,
      amount: bid,
    };

    return applyBid(currentState, player.position, bid);
  });

  if (!bidPlaced) {
    return;
  }

  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: newState,
    event: 'BID_PLACED',
    data: bidPlaced,
  });

  await checkAndTriggerAI(gameId, newState, io);
}

/**
 * Execute AI trump declaration
 */
async function executeAIDeclareTrump(
  gameId: string,
  aiPlayerId: string,
  io: Server
): Promise<void> {
  let declaration: {
    playerPosition: PlayerPosition;
    playerName: string;
    trumpSuit: Suit;
  } | null = null;

  const newState = await executeGameAction(gameId, async (currentState) => {
    const player = currentState.players.find((p: any) => p.id === aiPlayerId);
    if (!player) {
      console.warn(`[AI] Player ${aiPlayerId} missing during trump declaration for game ${gameId}`);
      return currentState;
    }

    if (currentState.phase !== 'DECLARING_TRUMP') {
      console.log(`[AI] ${player.name} skipping trump declaration - phase is ${currentState.phase}`);
      return currentState;
    }

    if (currentState.winningBidderPosition !== player.position) {
      console.log(`[AI] ${player.name} skipping trump declaration - not winning bidder`);
      return currentState;
    }

    if (!currentState.turnUpCard) {
      console.warn(`[AI] ${player.name} cannot declare trump - missing turn up card`);
      return currentState;
    }

    const trumpSuit = decideTrump(player.hand, currentState.turnUpCard);

    console.log(`[AI] ${player.name} declares trump: ${trumpSuit}`);

    declaration = {
      playerPosition: player.position,
      playerName: player.name,
      trumpSuit,
    };

    return applyTrumpDeclaration(currentState, trumpSuit);
  });

  if (!declaration) {
    return;
  }

  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: newState,
    event: 'TRUMP_DECLARED',
    data: declaration,
  });

  await checkAndTriggerAI(gameId, newState, io);
}

/**
 * Execute AI fold decision
 */
async function executeAIFoldDecision(
  gameId: string,
  aiPlayerId: string,
  io: Server
): Promise<void> {
  let decision: {
    playerPosition: PlayerPosition;
    playerName: string;
    folded: boolean;
  } | null = null;

  const newState = await executeGameAction(gameId, async (currentState) => {
    const player = currentState.players.find((p: any) => p.id === aiPlayerId);
    if (!player) {
      console.warn(`[AI] Player ${aiPlayerId} missing during fold decision for game ${gameId}`);
      return currentState;
    }

    if (currentState.phase !== 'FOLDING_DECISION') {
      console.log(`[AI] ${player.name} skipping fold decision - phase is ${currentState.phase}`);
      return currentState;
    }

    if (currentState.winningBidderPosition === player.position) {
      console.log(`[AI] ${player.name} skipping fold decision - is winning bidder`);
      return currentState;
    }

    if (player.foldDecision !== 'UNDECIDED') {
      return currentState;
    }

    if (!currentState.trumpSuit) {
      console.warn(`[AI] ${player.name} cannot decide fold - missing trump suit`);
      return currentState;
    }

    const shouldFold = decideFold(player.hand, currentState.trumpSuit, currentState.isClubsTurnUp);

    const validation = canFold(
      currentState.isClubsTurnUp,
      player.position === currentState.winningBidderPosition,
      player.foldDecision,
      shouldFold
    );

    if (!validation.valid) {
      console.warn(`[AI] ${player.name} cannot fold: ${validation.reason}`);
      return currentState;
    }

    console.log(`[AI] ${player.name} decides to ${shouldFold ? 'fold' : 'stay'}`);

    decision = {
      playerPosition: player.position,
      playerName: player.name,
      folded: shouldFold,
    };

    return applyFoldDecision(currentState, player.position, shouldFold);
  });

  if (!decision) {
    return;
  }

  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: newState,
    event: 'FOLD_DECISION',
    data: decision,
  });

  await checkAndTriggerAI(gameId, newState, io);
}

/**
 * Execute AI card play
 */
async function executeAICardPlay(
  gameId: string,
  aiPlayerId: string,
  io: Server
): Promise<void> {
  let play: {
    playerPosition: PlayerPosition;
    playerName: string;
    card: Card;
  } | null = null;

  const postPlayState = await executeGameAction(gameId, async (currentState) => {
    const player = currentState.players.find((p: any) => p.id === aiPlayerId);
    if (!player) {
      console.warn(`[AI] Player ${aiPlayerId} missing during card play for game ${gameId}`);
      return currentState;
    }

    if (currentState.phase !== 'PLAYING') {
      console.log(`[AI] ${player.name} skipping card play - phase is ${currentState.phase}`);
      return currentState;
    }

    if (currentState.currentPlayerPosition !== player.position) {
      console.log(`[AI] ${player.name} skipping card play - not current player`);
      return currentState;
    }

    if (player.folded) {
      console.warn(`[AI] ${player.name} has folded and cannot play cards`);
      return currentState;
    }

    if (!currentState.trumpSuit) {
      console.warn(`[AI] ${player.name} cannot play - missing trump suit`);
      return currentState;
    }

    const card = decideCardToPlay(currentState, player.position);

    const validation = canPlayCard(
      card,
      player.hand,
      currentState.currentTrick,
      currentState.trumpSuit,
      !!player.folded
    );

    if (!validation.valid) {
      console.warn(`[AI] ${player.name} selected illegal card ${card.id}: ${validation.reason}`);
      return currentState;
    }

    console.log(`[AI] ${player.name} plays: ${card.rank} of ${card.suit}`);

    play = {
      playerPosition: player.position,
      playerName: player.name,
      card,
    };

    return applyCardPlay(currentState, player.position, card.id);
  });

  if (!play) {
    return;
  }

  let finalState = postPlayState;

  const activePlayers = finalState.players.filter(p => p.folded !== true);
  const cardsInTrick = finalState.currentTrick.cards.length;

  if (cardsInTrick === activePlayers.length) {
    io.to(`game:${gameId}`).emit('TRICK_COMPLETE', {
      trick: finalState.currentTrick,
      delayMs: 2000,
    });

    if (finalState.tricks.length === 5) {
      finalState = await executeGameAction(gameId, (currentState) => finishRound(currentState));
      io.to(`game:${gameId}`).emit('ROUND_COMPLETE', {
        roundNumber: finalState.round,
      });
    }
  }

  io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
    gameState: finalState,
    event: 'CARD_PLAYED',
    data: play,
  });

  await checkAndTriggerAI(gameId, finalState, io);
}
