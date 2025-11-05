/**
 * @module ai/trigger
 * @description Trigger AI actions when it's their turn
 * 
 * This module monitors game state updates and automatically
 * triggers AI player actions when appropriate.
 */

import { Server } from 'socket.io';
import { GameState, AIAnalysisEvent } from '@buck-euchre/shared';
import { isAIPlayerByName, isAIPlayerAsync } from '../services/ai-player.service';
import { executeAITurn } from './executor';
import { analyzeHand, getBestCard } from './analysis.service';

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
        const player = gameState.players[gameState.currentPlayerPosition];
        // Don't trigger AI if player has no cards left
        if (!player.hand || player.hand.length === 0) {
          console.log(`[AI Trigger] Player ${player.id} has no cards left, skipping AI trigger`);
          return null;
        }
        return player.id;
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
    if (player.foldDecision === 'UNDECIDED' && isAIPlayerByName(player.name)) {
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

    if (!currentPlayerId) {
      // No one needs to act right now
      console.log(`[AI Trigger] No current acting player found`);
      return;
    }

    // Find the player in game state to check their name
    const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
    
    if (!currentPlayer) {
      console.log(`[AI Trigger] Current player ${currentPlayerId} not found in game state`);
      return;
    }

    // Check if AI by name (fast check)
    let isAI = isAIPlayerByName(currentPlayer.name);
    
    // If name doesn't match pattern, check username from database (fallback for old games)
    if (!isAI) {
      console.log(`[AI Trigger] Name "${currentPlayer.name}" doesn't match Bot pattern, checking database...`);
      isAI = await isAIPlayerAsync(currentPlayerId);
    }
    
    console.log(`[AI Trigger] Current acting player: ${currentPlayer.name} (${currentPlayerId}), isAI: ${isAI}`);

    if (!isAI) {
      // Current player is human, send AI analysis
      console.log(`[AI Trigger] Current player ${currentPlayer.name} is human, sending AI analysis`);
      await sendAIAnalysis(gameId, gameState, currentPlayer.position, io);
      return;
    }

    // Current player is AI - trigger after brief delay
    console.log(`[AI Trigger] AI player ${currentPlayer.name} needs to act in phase ${gameState.phase}`);
    
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
 * Send AI analysis to human player
 *
 * Analyzes the player's hand and sends statistics about each card
 * to help them make decisions.
 *
 * @param gameId - ID of the game
 * @param gameState - Current game state
 * @param playerPosition - Position of the human player
 * @param io - Socket.io server for broadcasting
 */
async function sendAIAnalysis(
  gameId: string,
  gameState: GameState,
  playerPosition: number,
  io: Server
): Promise<void> {
  try {
    // Only send analysis during PLAYING phase
    if (gameState.phase !== 'PLAYING') {
      return;
    }

    console.log(`[AI Analysis] Analyzing hand for player at position ${playerPosition}`);

    // Run analysis
    const analyses = await analyzeHand(gameState, playerPosition as any, {
      simulations: 500, // Moderate quality for real-time
      verbose: false,
    });

    if (analyses.length === 0) {
      console.log(`[AI Analysis] No analysis available for player ${playerPosition}`);
      return;
    }

    const bestCardId = getBestCard(analyses);

    const analysisEvent: AIAnalysisEvent = {
      playerPosition: playerPosition as any,
      cards: analyses,
      totalSimulations: 500,
      bestCardId: bestCardId || '',
    };

    // Broadcast to the game room
    io.to(`game:${gameId}`).emit('AI_ANALYSIS_UPDATE', analysisEvent);

    console.log(`[AI Analysis] Sent analysis for ${analyses.length} cards to game ${gameId}`);
  } catch (error: any) {
    console.error(`[AI Analysis] Error sending analysis:`, error.message || error);
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
