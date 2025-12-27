/**
 * @module ai/executor
 * @description Execute AI decisions with realistic timing
 *
 * This module takes AI decisions and executes them through the game's
 * action system, simulating human-like thinking delays.
 */

import { GameState, PlayerPosition, BidAmount, Suit, Card, Player } from '@buck-euchre/shared';
import { executeGameAction, getActiveGameState } from '../services/state.service.js';
import {
  applyBid,
  applyTrumpDeclaration,
  applyFoldDecision,
  applyCardPlay,
  finishRound,
} from '../game/state.js';
import { displayStateManager } from '../game/display.js';
import { Server } from 'socket.io';
import { canFold, canPlaceBid, canPlayCard } from '../game/validation.js';
import { checkAndTriggerAI } from './trigger.js';
import { scheduleAutoStartNextRound } from '../services/round.service.js';
import { aiProviderCache } from './provider-cache.js';
import type { AIProvider } from './types.js';
import { buildRoundCompletionPayload, persistRoundCompletionStats } from '../sockets/game.js';
import { isAIPlayerByName } from '../services/ai-player.service.js';

/**
 * Delay for a specified amount of time
 *
 * @param ms - Milliseconds to delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get AI thinking delay (constant 1s)
 *
 * @returns Delay in milliseconds
 */
function getThinkingDelay(): number {
  return 1000;
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
 * Get AI provider for a player
 *
 * Uses cached provider if available, otherwise creates a new one.
 * Defaults to 'medium' difficulty for now.
 *
 * @param playerId - Player ID
 * @returns AI provider instance
 */
async function getAIProvider(playerId: string): Promise<AIProvider> {
  // TODO: Get difficulty from player settings/database
  // For now, default to 'medium'
  return await aiProviderCache.getProvider(playerId, 'medium');
}

// Maximum time an AI turn can take before we consider it hung
const AI_TURN_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Execute AI turn based on current game phase with timeout protection
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
  // Wrap the actual execution with timeout protection
  return Promise.race([
    executeAITurnInternal(gameId, aiPlayerId, io),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('AI turn timeout - exceeded 15 seconds')), AI_TURN_TIMEOUT_MS)
    ),
  ]).catch(async (error) => {
    console.error(`[AI Executor] ❌ AI turn failed or timed out:`, error.message);
    // On timeout or error, trigger recovery to continue the game
    await triggerRecoveryCheck(gameId, io);
    throw error;
  });
}

/**
 * Internal function that executes the AI turn
 */
async function executeAITurnInternal(
  gameId: string,
  aiPlayerId: string,
  io: Server
): Promise<void> {
  const startTime = Date.now();
  let actionTaken = false; // Track if AI actually did something

  try {
    console.log(`[AI Executor] 🚀 STARTING AI turn for player ${aiPlayerId} in game ${gameId}`);
    const initialState = getActiveGameState(gameId);
    if (!initialState) {
      console.error(`[AI Executor] ❌ Game ${gameId} not found in memory`);
      return;
    }

    const initialPosition = findPlayerPosition(initialState, aiPlayerId);
    if (initialPosition === null) {
      console.error(`[AI Executor] ❌ Player ${aiPlayerId} not found in game ${gameId}`);
      console.error(`[AI Executor] Available players: ${initialState.players.map(p => `${p.id}(${p.name})`).join(', ')}`);
      // Trigger recovery to ensure game continues
      await triggerRecoveryCheck(gameId, io);
      return;
    }

    const initialPlayer = initialState.players[initialPosition];
    const initialPhase = initialState.phase;

    console.log(`[AI Executor] 💭 ${initialPlayer.name} is thinking (phase: ${initialPhase}, position: ${initialPosition})...`);

    // Simulate thinking time
    const thinkingTime = getThinkingDelay();
    console.log(`[AI Executor] ⏱️ Thinking delay: ${thinkingTime}ms`);
    await delay(thinkingTime);

    const state = getActiveGameState(gameId);
    if (!state) {
      console.error(`[AI Executor] ❌ Game ${gameId} not found after delay`);
      return;
    }

    const aiPosition = findPlayerPosition(state, aiPlayerId);
    if (aiPosition === null) {
      console.error(`[AI Executor] ❌ Player ${aiPlayerId} not found after delay`);
      await triggerRecoveryCheck(gameId, io);
      return;
    }

    const aiPlayer = state.players[aiPosition];
    const phase = state.phase;

    console.log(`[AI Executor] 📊 After delay: phase=${phase}, aiPosition=${aiPosition}, currentBidder=${state.currentBidder}, currentPlayer=${state.currentPlayerPosition}`);

    // Execute action based on current phase
    switch (phase) {
      case 'BIDDING':
        console.log(`[AI Executor] 🎯 BIDDING phase: aiPosition=${aiPosition}, currentBidder=${state.currentBidder}`);
        if (state.currentBidder === aiPosition) {
          console.log(`[AI Executor] ✅ Executing bid for AI at position ${aiPosition}`);
          await executeAIBid(gameId, aiPlayerId, io);
          actionTaken = true;
        } else {
          console.log(`[AI Executor] ⚠️ AI at position ${aiPosition} but currentBidder is ${state.currentBidder} - state changed during thinking`);
          // State changed during thinking - trigger recovery to ensure game continues
          await triggerRecoveryCheck(gameId, io);
        }
        break;

      case 'DECLARING_TRUMP':
        console.log(`[AI Executor] 🎯 DECLARING_TRUMP phase: aiPosition=${aiPosition}, winningBidder=${state.winningBidderPosition}`);
        if (state.winningBidderPosition === aiPosition) {
          console.log(`[AI Executor] ✅ Executing trump declaration for AI at position ${aiPosition}`);
          await executeAIDeclareTrump(gameId, aiPlayerId, io);
          actionTaken = true;
        } else {
          console.log(`[AI Executor] ⚠️ AI at position ${aiPosition} but winningBidder is ${state.winningBidderPosition} - state changed during thinking`);
          await triggerRecoveryCheck(gameId, io);
        }
        break;

      case 'FOLDING_DECISION':
        console.log(`[AI Executor] 🎯 FOLDING_DECISION phase: aiPosition=${aiPosition}, winningBidder=${state.winningBidderPosition}, foldDecision=${aiPlayer.foldDecision}`);
        if (state.winningBidderPosition !== aiPosition && aiPlayer.foldDecision === 'UNDECIDED') {
          console.log(`[AI Executor] ✅ Executing fold decision for AI at position ${aiPosition}`);
          await executeAIFoldDecision(gameId, aiPlayerId, io);
          actionTaken = true;
        } else {
          console.log(`[AI Executor] ⚠️ AI cannot fold: winningBidder=${state.winningBidderPosition}, foldDecision=${aiPlayer.foldDecision}`);
          await triggerRecoveryCheck(gameId, io);
        }
        break;

      case 'PLAYING':
        console.log(`[AI Executor] 🎯 PLAYING phase: aiPosition=${aiPosition}, currentPlayer=${state.currentPlayerPosition}`);
        if (state.currentPlayerPosition === aiPosition) {
          console.log(`[AI Executor] ✅ Executing card play for AI at position ${aiPosition}`);
          await executeAICardPlay(gameId, aiPlayerId, io);
          actionTaken = true;
        } else {
          console.log(`[AI Executor] ⚠️ AI at position ${aiPosition} but currentPlayer is ${state.currentPlayerPosition} - state changed during thinking`);
          await triggerRecoveryCheck(gameId, io);
        }
        break;

      default:
        console.log(`[AI Executor] ⚠️ ${aiPlayer.name} doesn't need to act in phase ${phase}`);
        await triggerRecoveryCheck(gameId, io);
        break;
    }

    const duration = Date.now() - startTime;
    console.log(`[AI Executor] ✅ COMPLETED AI turn for player ${aiPlayerId} in ${duration}ms (actionTaken=${actionTaken})`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[AI Executor] ❌ FATAL ERROR executing AI turn for player ${aiPlayerId} after ${duration}ms:`);
    console.error(`[AI Executor] Error message:`, error.message);
    console.error(`[AI Executor] Error stack:`, error.stack);
    // On error, try to trigger recovery to continue the game
    await triggerRecoveryCheck(gameId, io);
    throw error;
  }
}

/**
 * Trigger a recovery check to ensure the game continues
 * This is called when an AI turn fails or state changes unexpectedly
 */
async function triggerRecoveryCheck(gameId: string, io: Server): Promise<void> {
  console.log(`[AI Executor] 🔄 Triggering recovery check for game ${gameId}`);
  // Small delay to prevent tight loops
  await delay(500);
  // Re-trigger AI check to continue the game
  try {
    const freshState = getActiveGameState(gameId);
    if (freshState) {
      await checkAndTriggerAI(gameId, freshState, io);
    }
  } catch (err) {
    console.error(`[AI Executor] Recovery check failed:`, err);
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

    // Get AI provider and make decision
    const aiProvider = await getAIProvider(aiPlayerId);
    const bid = await aiProvider.decideBid(
      player.hand,
      currentState.turnUpCard,
      currentState.highestBid,
      currentState
    );

    const validation = canPlaceBid(
      bid,
      currentState.highestBid,
      currentState.bids.some((b: any) => b.playerPosition === player.position && b.amount === 'PASS'),
      currentState.bids.filter((b: any) => b.amount === 'PASS').length === 3,
      currentState.bids.some((b: any) => b.playerPosition === player.position)
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

    // Get AI provider and make decision
    const aiProvider = await getAIProvider(aiPlayerId);
    const trumpSuit = await aiProvider.decideTrump(
      player.hand,
      currentState.turnUpCard,
      currentState
    );

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

    // Get AI provider and make decision
    const aiProvider = await getAIProvider(aiPlayerId);
    const shouldFold = await aiProvider.decideFold(
      player.hand,
      currentState.trumpSuit,
      currentState.isClubsTurnUp,
      currentState
    );

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

  let tricksBeforePlay = 0;
  let willCompleteTrick = false;
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

    if (!player.hand || player.hand.length === 0) {
      console.log(`[AI] ${player.name} has no cards left to play`);
      return currentState;
    }

    if (!currentState.trumpSuit) {
      console.warn(`[AI] ${player.name} cannot play - missing trump suit`);
      return currentState;
    }

    // Check if this card will complete the trick BEFORE applying it
    const cardsInTrickBefore = currentState.currentTrick.cards.length + 1;
    const activePlayersBefore = currentState.players.filter((p: Player) => p.folded !== true);
    willCompleteTrick = cardsInTrickBefore === activePlayersBefore.length;
    tricksBeforePlay = currentState.tricks.length;

    // Get AI provider and make decision
    const aiProvider = await getAIProvider(aiPlayerId);
    const card = await aiProvider.decideCardToPlay(currentState, player.position);

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

    const nextState = applyCardPlay(currentState, player.position, card.id);
    return nextState;
  });

  if (!play) {
    return;
  }

  // Check if trick was completed by comparing tricks count before and after
  let finalState = postPlayState;
  const trickWasCompleted = willCompleteTrick || finalState.tricks.length > tricksBeforePlay;

  if (trickWasCompleted) {
    // The completed trick is now the last one in the tricks array
    const completedTrick = finalState.tricks[finalState.tricks.length - 1];
    io.to(`game:${gameId}`).emit('TRICK_COMPLETE', {
      trick: completedTrick,
      delayMs: 3000,
    });
    console.log(`[AI] [TRICK_COMPLETE] Emitted for trick ${completedTrick.number}`, {
      winner: completedTrick.winner,
      cardsPlayed: completedTrick.cards.length,
    });

    if (finalState.tricks.length === 5) {
      // Capture state before finishRound for stats
      const stateBeforeScoring = { ...finalState };
      
      finalState = await executeGameAction(gameId, (currentState) => finishRound(currentState));
      
      // Build and persist stats
      console.log(`[AI] Round completed, building stats payload...`);
      const statsPayload = buildRoundCompletionPayload(gameId, stateBeforeScoring, finalState);
      if (statsPayload) {
        console.log(`[AI] Stats payload built with ${statsPayload.roundUpdates.length} updates`);
        void persistRoundCompletionStats(statsPayload);
      } else {
        console.log(`[AI] Stats payload returned null`);
      }
      
      io.to(`game:${gameId}`).emit('ROUND_COMPLETE', {
        roundNumber: finalState.round,
      });

      if (finalState.phase === 'ROUND_OVER' && !finalState.gameOver) {
        scheduleAutoStartNextRound(
          gameId,
          io,
          { round: finalState.round, version: finalState.version },
          checkAndTriggerAI
        );
      }
    }

    // Calculate delay based on next player - only delay for AI players (same logic as human handler)
    const nextPlayerPos = finalState.currentPlayerPosition;
    const nextPlayerIsAI = nextPlayerPos !== null && finalState.players[nextPlayerPos] 
      ? isAIPlayerByName(finalState.players[nextPlayerPos].name) 
      : false;
    const trickCompleteDelay = nextPlayerIsAI ? 3000 : 0;

    // Create display state showing completed trick
    const displayState = displayStateManager.createTrickCompleteDisplay(finalState, trickCompleteDelay);
    
    // Validate display state before emitting
    if (!displayState || !displayState.gameId) {
      console.error(`[AI] Invalid display state for game ${gameId}:`, displayState);
      // Fallback: emit the actual state
      io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
        gameState: finalState,
        event: 'CARD_PLAYED',
        data: play,
      });
    } else {
      // Emit display state immediately so all cards are visible
      io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
        gameState: displayState,
        event: 'CARD_PLAYED',
        data: play,
      });
    }
    console.log(`[AI] [PLAY_CARD] Immediate broadcast showing all cards in completed trick`, {
      trickNumber: displayState.currentTrick.number,
      cardsInTrick: displayState.currentTrick.cards.length,
    });
    
    // Store finalState for fallback in case memory state is unavailable
    const stateForTransition = finalState;
    
    // Schedule transition to actual state after 3 seconds
    displayStateManager.scheduleTransition(gameId, async () => {
      console.log(`[AI] [PLAY_CARD] Transition callback starting for game ${gameId}`);
      try {
        // Get current state from memory (may have changed during delay)
        let currentState = getActiveGameState(gameId);

        // Fallback to the state we stored when creating the display
        if (!currentState) {
          console.warn(`[AI] Game ${gameId} not found in memory, using fallback state`);
          currentState = stateForTransition;
        }

        if (!currentState) {
          console.error(`[AI] No state available for game ${gameId} during transition - this should not happen`);
          return; // Can't emit without state
        }

        // Validate state before emitting
        if (!currentState || !currentState.gameId) {
          console.error(`[AI] Invalid state for game ${gameId} during transition:`, currentState);
          return;
        }

        // ALWAYS use fresh state from memory for both emission and AI trigger
        // State may have changed during the 3-second delay (e.g., player played a card)
        const freshState = getActiveGameState(gameId) || currentState;
        
        if (!freshState) {
          console.error(`[AI] No state available for game ${gameId} during transition - this should not happen`);
          return;
        }

        // Increment version for transition state - this signals the actual state after display
        // Display state used same version, so we increment here to show this is the real update
        const stateWithUpdatedTimestamp = {
          ...freshState,
          version: (freshState.version || 0) + 1,
          updatedAt: Date.now(),
        };

        io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
          gameState: stateWithUpdatedTimestamp,
          event: 'CARD_PLAYED',
          data: play,
        });
        console.log(`[AI] [PLAY_CARD] Delayed transition after showing completed trick`, {
          phase: freshState.phase,
          currentPlayerPosition: freshState.currentPlayerPosition,
          trickNumber: freshState.currentTrick.number,
          cardsInTrick: freshState.currentTrick.cards.length,
          tricksCompleted: freshState.tricks.length,
        });

        // Trigger AI after delay completes (only if round is still in progress)
        // Use the same fresh state we just emitted to ensure consistency
        if (freshState.phase === 'PLAYING') {
          console.log(`[AI] [PLAY_CARD] Triggering next AI after transition delay`);
          try {
            await checkAndTriggerAI(gameId, freshState, io);
          } catch (triggerError) {
            console.error(`[AI] [PLAY_CARD] Error triggering AI after transition:`, triggerError);
            // Schedule a retry after a short delay
            setTimeout(async () => {
              const retryState = getActiveGameState(gameId);
              if (retryState && retryState.phase === 'PLAYING') {
                console.log(`[AI] [PLAY_CARD] Retrying AI trigger after error`);
                await checkAndTriggerAI(gameId, retryState, io).catch(e =>
                  console.error(`[AI] [PLAY_CARD] Retry also failed:`, e)
                );
              }
            }, 1000);
          }
        } else {
          console.log(`[AI] [PLAY_CARD] Not triggering AI - phase is ${freshState.phase || 'unknown'}`);
        }
      } catch (error) {
        console.error(`[AI] [PLAY_CARD] Error in transition callback for game ${gameId}:`, error);
        // Try to recover by triggering AI check
        setTimeout(async () => {
          const recoveryState = getActiveGameState(gameId);
          if (recoveryState) {
            console.log(`[AI] [PLAY_CARD] Attempting recovery trigger after callback error`);
            await checkAndTriggerAI(gameId, recoveryState, io).catch(e =>
              console.error(`[AI] [PLAY_CARD] Recovery trigger failed:`, e)
            );
          }
        }, 500);
      }
    });
  } else {
    // Broadcast update immediately if trick not complete
    io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: finalState,
      event: 'CARD_PLAYED',
      data: play,
    });
    console.log(`[AI] [PLAY_CARD] Broadcast`, {
      phase: finalState.phase,
      currentPlayerPosition: finalState.currentPlayerPosition,
      trickNumber: finalState.currentTrick.number,
      cardsInTrick: finalState.currentTrick.cards.length,
      tricksCompleted: finalState.tricks.length,
    });
    
    // Trigger AI immediately if trick not complete
    // Use fresh state from memory to avoid stale state issues
    const freshState = getActiveGameState(gameId);
    if (freshState) {
      await checkAndTriggerAI(gameId, freshState, io);
    }
  }
}
