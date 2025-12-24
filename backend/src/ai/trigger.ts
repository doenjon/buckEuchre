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
import { analyzeHand, getBestCard, analyzeBids, getBestBid, analyzeFoldDecision, getBestFoldDecision } from './analysis.service';

/**
 * Track last analysis sent to prevent duplicate sends
 * Key: `${gameId}:${playerPosition}:${currentPlayerPosition}:${trickNumber}`
 */
const lastAnalysisKey = new Map<string, number>();
const ANALYSIS_COOLDOWN_MS = 2000; // Don't send analysis again within 2 seconds

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
        // Use Promise.all to ensure all AI decisions complete, even if one fails
        const aiPromises = aiPlayersToAct.map((playerId, i) => {
          return new Promise<void>((resolve) => {
            setTimeout(async () => {
              try {
                await executeAITurn(gameId, playerId, io);
                console.log(`[AI Trigger] AI player ${playerId} completed fold decision`);
              } catch (err) {
                console.error(`[AI Trigger] Error triggering AI fold decision for ${playerId}:`, err);
                // Don't throw - let other AI players continue even if one fails
              } finally {
                resolve();
              }
            }, i * 200); // 200ms delay between each AI
          });
        });

        // Don't await here - let AI decisions process asynchronously
        // but ensure all promises are tracked to prevent unhandled rejections
        Promise.all(aiPromises).catch(err => {
          console.error(`[AI Trigger] Unexpected error in AI fold decision batch:`, err);
        });
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

    // If name doesn't match known AI names, check username from database (fallback for old games)
    if (!isAI) {
      console.log(`[AI Trigger] Name "${currentPlayer.name}" doesn't match AI name list, checking database...`);
      isAI = await isAIPlayerAsync(currentPlayerId);
    }
    
    console.log(`[AI Trigger] Current acting player: ${currentPlayer.name} (${currentPlayerId}), isAI: ${isAI}`);

    if (!isAI) {
      // Current player is human, send AI analysis.
      // IMPORTANT: Don't await analysis here — it can be expensive (MCTS simulations) and will
      // block the event loop, causing noticeable lag after actions like PLAY_CARD.
      console.log(`[AI Trigger] Current player ${currentPlayer.name} is human, scheduling AI analysis`);
      setTimeout(() => {
        sendAIAnalysis(gameId, gameState, currentPlayer.position, io).catch(err => {
          console.error(`[AI Trigger] Error sending AI analysis:`, err);
        });
      }, 0);
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
 * Analyzes the player's options (cards, bids, or fold decision) and sends statistics
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
    // Only analyze during specific phases
    if (gameState.phase !== 'PLAYING' && gameState.phase !== 'BIDDING' && gameState.phase !== 'FOLDING_DECISION') {
      return;
    }

    // Create a unique key for this analysis request
    const currentPlayerPos = gameState.currentPlayerPosition ?? gameState.currentBidder ?? -1;
    const trickNumber = gameState.tricks.length;
    const analysisKey = `${gameId}:${playerPosition}:${currentPlayerPos}:${trickNumber}:${gameState.phase}`;

    // Check if we've already sent analysis for this exact situation recently
    const lastSent = lastAnalysisKey.get(analysisKey);
    const now = Date.now();

    if (lastSent && (now - lastSent) < ANALYSIS_COOLDOWN_MS) {
      // Already sent analysis recently for this turn - skip
      return;
    }

    // Check if it's actually this player's turn based on phase
    let isPlayersTurn = false;
    if (gameState.phase === 'PLAYING') {
      isPlayersTurn = currentPlayerPos === playerPosition;
    } else if (gameState.phase === 'BIDDING') {
      isPlayersTurn = gameState.currentBidder === playerPosition;
    } else if (gameState.phase === 'FOLDING_DECISION') {
      // In folding phase, check if this player needs to make a decision
      const player = gameState.players[playerPosition];
      isPlayersTurn = player.foldDecision === 'UNDECIDED' && playerPosition !== gameState.winningBidderPosition;
    }

    if (!isPlayersTurn) {
      return;
    }

    console.log(`[AI Analysis] Analyzing for player at position ${playerPosition} in phase ${gameState.phase}`);

    // Run analysis with high quality (10000 simulations)
    const analysisConfig = {
      simulations: 10000,
      verbose: false,
    };

    let analysisEvent: AIAnalysisEvent;

    // Analyze based on game phase
    if (gameState.phase === 'PLAYING') {
      const analyses = await analyzeHand(gameState, playerPosition as any, analysisConfig);

      if (analyses.length === 0) {
        console.log(`[AI Analysis] No card analysis available for player ${playerPosition}`);
        return;
      }

      const bestCardId = getBestCard(analyses);

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'card',
        cards: analyses,
        totalSimulations: analysisConfig.simulations,
        bestCardId: bestCardId || '',
      };

      console.log(`[AI Analysis] Sent card analysis for ${analyses.length} cards to game ${gameId}`);
    } else if (gameState.phase === 'BIDDING') {
      const analyses = await analyzeBids(gameState, playerPosition as any, analysisConfig);

      if (analyses.length === 0) {
        console.log(`[AI Analysis] No bid analysis available for player ${playerPosition}`);
        return;
      }

      const bestBid = getBestBid(analyses);

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'bid',
        bids: analyses,
        totalSimulations: analysisConfig.simulations,
        bestBid: bestBid ?? undefined,
      };

      console.log(`[AI Analysis] Sent bid analysis for ${analyses.length} bids to game ${gameId}`);
    } else if (gameState.phase === 'FOLDING_DECISION') {
      const analyses = await analyzeFoldDecision(gameState, playerPosition as any, analysisConfig);

      if (analyses.length === 0) {
        console.log(`[AI Analysis] No fold analysis available for player ${playerPosition}`);
        return;
      }

      const bestFold = getBestFoldDecision(analyses);

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'fold',
        foldOptions: analyses,
        totalSimulations: analysisConfig.simulations,
        bestFoldDecision: bestFold ?? undefined,
      };

      console.log(`[AI Analysis] Sent fold analysis for ${analyses.length} options to game ${gameId}`);
    } else {
      return;
    }

    // Mark that we've sent analysis for this key
    lastAnalysisKey.set(analysisKey, now);

    // Clean up old entries (keep only last 100)
    if (lastAnalysisKey.size > 100) {
      const entries = Array.from(lastAnalysisKey.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
      lastAnalysisKey.clear();
      entries.slice(0, 50).forEach(([key, time]) => lastAnalysisKey.set(key, time));
    }

    // Broadcast to the game room
    io.to(`game:${gameId}`).emit('AI_ANALYSIS_UPDATE', analysisEvent);
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
