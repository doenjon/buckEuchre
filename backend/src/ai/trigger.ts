/**
 * @module ai/trigger
 * @description Trigger AI actions when it's their turn
 * 
 * This module monitors game state updates and automatically
 * triggers AI player actions when appropriate.
 */

import { Server } from 'socket.io';
import { GameState } from '@buck-euchre/shared';
import { isAIPlayer } from '../services/ai-player.service';
import { executeAITurn } from './executor';

/**
 * Get the current player who needs to act
 * 
 * @param gameState - Current game state
 * @returns Player ID who should act, or null if no action needed
 */
function getCurrentActingPlayer(gameState: GameState): string | null {
  switch (gameState.phase) {
    case 'BIDDING':
      if (gameState.currentBidder !== null) {
        return gameState.players[gameState.currentBidder].id;
      }
      break;

    case 'DECLARING_TRUMP':
      if (gameState.winningBidderPosition !== null) {
        return gameState.players[gameState.winningBidderPosition].id;
      }
      break;

    case 'FOLDING_DECISION':
      // In folding phase, check which non-bidders haven't decided yet
      for (let i = 0; i < 4; i++) {
        const player = gameState.players[i];
        if (i !== gameState.winningBidderPosition && player.foldDecision === 'UNDECIDED') {
          return player.id;
        }
      }
      break;

    case 'PLAYING':
      if (gameState.currentPlayerPosition !== null) {
        return gameState.players[gameState.currentPlayerPosition].id;
      }
      break;

    default:
      // No action needed in other phases
      return null;
  }

  return null;
}

/**
 * Get all AI players who need to make fold decisions
 * 
 * @param gameState - Current game state
 * @returns Array of AI player IDs who need to decide
 */
function getAIPlayersNeedingFoldDecision(gameState: GameState): string[] {
  if (gameState.phase !== 'FOLDING_DECISION') {
    return [];
  }

  const aiPlayers: string[] = [];

  for (let i = 0; i < 4; i++) {
    const player = gameState.players[i];
    
    // Skip the bidder
    if (i === gameState.winningBidderPosition) {
      continue;
    }

    // Check if this player hasn't decided yet
    if (player.foldDecision === 'UNDECIDED' && isAIPlayer(player.id)) {
      aiPlayers.push(player.id);
    }
  }

  return aiPlayers;
}

/**
 * Check if AI should act and trigger if needed
 * 
 * This function is called after every game state update to check
 * if an AI player needs to take an action.
 * 
 * @param gameId - ID of the game
 * @param gameState - Current game state
 * @param io - Socket.io server for broadcasting
 */
export async function checkAndTriggerAI(
  gameId: string,
  gameState: GameState,
  io: Server
): Promise<void> {
  try {
    console.log(`[AI Trigger] Checking AI trigger for game ${gameId}, phase: ${gameState.phase}, currentBidder: ${gameState.currentBidder}`);
    
    // Special handling for FOLDING_DECISION phase
    // All non-bidders need to decide, and they can all decide simultaneously
    if (gameState.phase === 'FOLDING_DECISION') {
      const aiPlayersToAct = getAIPlayersNeedingFoldDecision(gameState);
      
      if (aiPlayersToAct.length > 0) {
        console.log(`[AI Trigger] ${aiPlayersToAct.length} AI player(s) need to make fold decisions`);
        
        // Trigger all AI fold decisions with slight delays to seem natural
        for (let i = 0; i < aiPlayersToAct.length; i++) {
          const playerId = aiPlayersToAct[i];
          
          // Stagger the AI actions slightly
          setTimeout(() => {
            executeAITurn(gameId, playerId, io).catch(err =>
              console.error(`[AI Trigger] Error triggering AI fold decision:`, err)
            );
          }, i * 200); // 200ms delay between each AI
        }
      }
      return;
    }

    // For other phases, check if current acting player is AI
    const currentPlayerId = getCurrentActingPlayer(gameState);

    console.log(`[AI Trigger] Current acting player: ${currentPlayerId}, isAI: ${currentPlayerId ? isAIPlayer(currentPlayerId) : 'N/A'}`);

    if (!currentPlayerId) {
      // No one needs to act right now
      console.log(`[AI Trigger] No current acting player found`);
      return;
    }

    if (!isAIPlayer(currentPlayerId)) {
      // Current player is human, don't trigger
      console.log(`[AI Trigger] Current player ${currentPlayerId} is human, not triggering AI`);
      return;
    }

    // Current player is AI - trigger after brief delay
    console.log(`[AI Trigger] AI player ${currentPlayerId} needs to act in phase ${gameState.phase}`);
    
    setTimeout(() => {
      executeAITurn(gameId, currentPlayerId, io).catch(err =>
        console.error(`[AI Trigger] Error triggering AI turn:`, err)
      );
    }, 100); // Small delay to let state stabilize
  } catch (error: any) {
    console.error(`[AI Trigger] Error in checkAndTriggerAI:`, error.message || error);
  }
}

/**
 * Setup AI triggers for game state updates
 * 
 * This should be called once during server initialization.
 * It doesn't actually hook into events, but provides the function
 * that should be called after every state update.
 * 
 * @param io - Socket.io server
 * @returns Function to call after state updates
 */
export function setupAITriggers(io: Server): (gameId: string, gameState: GameState) => void {
  return (gameId: string, gameState: GameState) => {
    // Trigger AI check asynchronously
    checkAndTriggerAI(gameId, gameState, io).catch(err =>
      console.error('[AI Trigger] Error in trigger handler:', err)
    );
  };
}
