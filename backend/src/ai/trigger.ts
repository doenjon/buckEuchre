/**
 * @module ai/trigger
 * @description Trigger AI actions when it's their turn
 * 
 * ROBUST DESIGN: No throttling, no complex keys.
 * Game state itself prevents duplicates via executeGameAction queue.
 */

import { Server } from 'socket.io';
import { GameState, AIAnalysisEvent } from '@buck-euchre/shared';
import { isAIPlayerByName, isAIPlayerAsync } from '../services/ai-player.service.js';
import { executeAITurn } from './executor.js';
import { analyzeHand, getBestCard, analyzeBids, getBestBid, analyzeFoldDecision, getBestFoldDecision, analyzeTrumpSelection, getBestSuit } from './analysis.service.js';
import { getActiveGameState } from '../services/state.service.js';

/**
 * Simple analysis cache with TTL
 * Key: `${gameId}:p${playerPosition}:${phase}`
 */
interface AnalysisCacheEntry {
  timestamp: number;
}

const analysisCache = new Map<string, AnalysisCacheEntry>();
const ANALYSIS_TTL_MS = 5000; // Analysis expires after 5 seconds

/**
 * Get analysis cache key that includes relevant state
 * This ensures analysis is refreshed when the situation changes
 */
function getAnalysisKey(gameId: string, playerPosition: number, gameState: GameState): string {
  const phase = gameState.phase;
  
  // Include state that affects analysis in the key
  switch (phase) {
    case 'BIDDING':
      // Include current bidder and highest bid - analysis changes as bidding progresses
      return `${gameId}:p${playerPosition}:${phase}:cb${gameState.currentBidder ?? -1}:hb${gameState.highestBid ?? 'N'}`;
    case 'PLAYING':
      // Include trick number and cards in trick - analysis changes each trick
      const trickNo = gameState.currentTrick?.number ?? (gameState.tricks.length + 1);
      const cardsInTrick = gameState.currentTrick?.cards?.length ?? 0;
      return `${gameId}:p${playerPosition}:${phase}:t${trickNo}:c${cardsInTrick}`;
    case 'FOLDING_DECISION':
      // Include player's decision state - analysis only needed when undecided
      const decision = gameState.players[playerPosition]?.foldDecision ?? 'UNDECIDED';
      return `${gameId}:p${playerPosition}:${phase}:d${decision}`;
    case 'DECLARING_TRUMP':
      // Include winning bidder - only that player needs analysis
      return `${gameId}:p${playerPosition}:${phase}:wb${gameState.winningBidderPosition ?? -1}`;
    default:
      return `${gameId}:p${playerPosition}:${phase}`;
  }
}

/**
 * Check if analysis should be sent (simple TTL cache with state-aware keys)
 */
function shouldSendAnalysis(
  gameId: string,
  playerPosition: number,
  gameState: GameState
): boolean {
  const key = getAnalysisKey(gameId, playerPosition, gameState);
  const cached = analysisCache.get(key);
  const now = Date.now();

  // Clean up expired entries
  if (cached && (now - cached.timestamp) > ANALYSIS_TTL_MS) {
    analysisCache.delete(key);
    return true; // Expired, can send new
  }

  // If cached and not expired, don't send
  if (cached) {
    return false;
  }

  // Not cached, can send - mark it
  analysisCache.set(key, { timestamp: now });
  return true;
}

/**
 * Get the current player who needs to act
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
          return null;
        }
        return player.id;
      }
      break;

    default:
      return null;
  }

  return null;
}

/**
 * Send AI analysis to human player
 * 
 * Always fetches fresh state from memory.
 */
async function sendAIAnalysis(
  gameId: string,
  playerPosition: number,
  io: Server
): Promise<void> {
  try {
    // Always fetch fresh state
    const gameState = getActiveGameState(gameId);
    if (!gameState) {
      return;
    }

    // Validate player still needs analysis FIRST (before cache check)
    // This prevents caching analysis for situations that are no longer valid
    if (gameState.phase === 'FOLDING_DECISION') {
      const player = gameState.players[playerPosition];
      if (playerPosition === gameState.winningBidderPosition || player.foldDecision !== 'UNDECIDED') {
        console.log(`[AI Analysis] Player ${playerPosition} no longer needs fold analysis`);
        return; // No longer needs analysis
      }
    } else if (gameState.phase === 'PLAYING') {
      if (gameState.currentPlayerPosition !== playerPosition) {
        console.log(`[AI Analysis] Player ${playerPosition} not current player (current: ${gameState.currentPlayerPosition})`);
        return; // Not this player's turn anymore
      }
    } else if (gameState.phase === 'BIDDING') {
      if (gameState.currentBidder !== playerPosition) {
        console.log(`[AI Analysis] Player ${playerPosition} not current bidder (current: ${gameState.currentBidder})`);
        return; // Not this player's turn anymore
      }
    } else if (gameState.phase === 'DECLARING_TRUMP') {
      if (gameState.winningBidderPosition !== playerPosition) {
        console.log(`[AI Analysis] Player ${playerPosition} not winning bidder (winner: ${gameState.winningBidderPosition})`);
        return; // Not this player's turn anymore
      }
    }

    // Check if we should send (state-aware TTL cache)
    // Only check cache AFTER validating the player still needs analysis
    if (!shouldSendAnalysis(gameId, playerPosition, gameState)) {
      console.log(`[AI Analysis] Analysis already cached for player ${playerPosition} in phase ${gameState.phase}`);
      return; // Already sent recently for this exact situation
    }

    console.log(`[AI Analysis] Analyzing for player at position ${playerPosition} in phase ${gameState.phase}`);

    // Run analysis
    const analysisConfig = { simulations: 5000, verbose: false };
    let analysisEvent: AIAnalysisEvent;

    if (gameState.phase === 'PLAYING') {
      const analyses = await analyzeHand(gameState, playerPosition as any, analysisConfig);
      if (analyses.length === 0) return;

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'card',
        cards: analyses,
        totalSimulations: analysisConfig.simulations,
        bestCardId: getBestCard(analyses) || '',
      };
    } else if (gameState.phase === 'BIDDING') {
      const analyses = await analyzeBids(gameState, playerPosition as any, analysisConfig);
      if (analyses.length === 0) return;

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'bid',
        bids: analyses,
        totalSimulations: analysisConfig.simulations,
        bestBid: getBestBid(analyses) ?? undefined,
      };
    } else if (gameState.phase === 'FOLDING_DECISION') {
      const analyses = await analyzeFoldDecision(gameState, playerPosition as any, analysisConfig);
      if (analyses.length === 0) return;

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'fold',
        foldOptions: analyses,
        totalSimulations: analysisConfig.simulations,
        bestFoldDecision: getBestFoldDecision(analyses) ?? undefined,
      };
    } else if (gameState.phase === 'DECLARING_TRUMP') {
      const analyses = await analyzeTrumpSelection(gameState, playerPosition as any, analysisConfig);
      if (analyses.length === 0) return;

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'suit',
        suits: analyses,
        totalSimulations: analysisConfig.simulations,
        bestSuit: getBestSuit(analyses) ?? undefined,
      };
    } else {
      return;
    }

    // Send it
    console.log(`[AI Analysis] Broadcasting ${analysisEvent.analysisType} analysis to game ${gameId}`);
    io.to(`game:${gameId}`).emit('AI_ANALYSIS_UPDATE', analysisEvent);
  } catch (error: any) {
    console.error(`[AI Analysis] Error:`, error);
  }
}

/**
 * Check if AI should act and trigger if needed
 *
 * ROBUST: No throttling. Game state prevents duplicates.
 * Always fetches fresh state from memory.
 *
 * @param gameId - ID of the game
 * @param _gameState - DEPRECATED: Ignored, fresh state is fetched from memory
 * @param io - Socket.io server for broadcasting
 */
export async function checkAndTriggerAI(
  gameId: string,
  _gameState: GameState, // Deprecated - always fetch fresh
  io: Server
): Promise<void> {
  try {
    console.log(`[AI Trigger] 🔍 ENTRY: gameId=${gameId}`);
    logToFile(`[AI Trigger] 🔍 ENTRY: gameId=${gameId}`);
    // Always fetch fresh state
    const gameState = getActiveGameState(gameId);
    if (!gameState) {
      console.log(`[AI Trigger] ❌ Game ${gameId} not found in memory`);
      logToFile(`[AI Trigger] ❌ Game ${gameId} not found in memory`);
      return;
    }
    console.log(`[AI Trigger] 📊 Game state: phase=${gameState.phase}, version=${gameState.version}`);
    logToFile(`[AI Trigger] 📊 Game state: phase=${gameState.phase}, version=${gameState.version}`);

    // Special handling for FOLDING_DECISION phase
    if (gameState.phase === 'FOLDING_DECISION') {
      // Check all non-bidders
      for (let pos = 0; pos < 4; pos++) {
        const player = gameState.players[pos];
        
        // Skip bidder and already-decided players
        if (pos === gameState.winningBidderPosition || player.foldDecision !== 'UNDECIDED') {
          continue;
        }

        // Check if AI or human
        const isAI = isAIPlayerByName(player.name);
        
        if (isAI) {
          // AI needs to act - trigger it (no delay, no throttle - game state prevents duplicates)
          console.log(`[AI Trigger] Triggering AI fold decision for ${player.name} at position ${pos}`);
          executeAITurn(gameId, player.id, io).catch(err => 
            console.error(`[AI Trigger] Error:`, err)
          );
        } else {
          // Human needs analysis - send it
          console.log(`[AI Trigger] Sending fold analysis for human player ${player.name} at position ${pos}`);
          sendAIAnalysis(gameId, pos, io).catch(err =>
            console.error(`[AI Trigger] Analysis error:`, err)
          );
        }
      }
      return;
    }

    // For other phases, check current acting player
    const currentPlayerId = getCurrentActingPlayer(gameState);
    console.log(`[AI Trigger] 🎯 Current acting player ID: ${currentPlayerId || 'NONE'}`);
    
    if (!currentPlayerId) {
      console.log(`[AI Trigger] ⚠️ No current acting player (phase: ${gameState.phase})`);
      if (gameState.phase === 'PLAYING') {
        console.log(`[AI Trigger] PLAYING phase details: currentPlayerPosition=${gameState.currentPlayerPosition}, players=${gameState.players.map(p => `${p.name}(${p.position})`).join(', ')}`);
      } else if (gameState.phase === 'BIDDING') {
        console.log(`[AI Trigger] BIDDING phase details: currentBidder=${gameState.currentBidder}, players=${gameState.players.map(p => `${p.name}(${p.position})`).join(', ')}`);
      }
      return; // No one needs to act
    }

    const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
    if (!currentPlayer) {
      console.error(`[AI Trigger] ❌ Current player ${currentPlayerId} not found in game state`);
      console.error(`[AI Trigger] Available players: ${gameState.players.map(p => `${p.id}(${p.name})`).join(', ')}`);
      return;
    }

    console.log(`[AI Trigger] 👤 Current player: ${currentPlayer.name} (${currentPlayerId}) at position ${currentPlayer.position}`);

    // Check if AI (try name first, then database)
    let isAI = isAIPlayerByName(currentPlayer.name);
    console.log(`[AI Trigger] 🤖 isAIPlayerByName("${currentPlayer.name}") = ${isAI}`);
    
    if (!isAI) {
      console.log(`[AI Trigger] 🔍 Checking database for player ${currentPlayerId}...`);
      isAI = await isAIPlayerAsync(currentPlayerId);
      console.log(`[AI Trigger] 🤖 isAIPlayerAsync("${currentPlayerId}") = ${isAI}`);
    }

    if (isAI) {
      // AI needs to act - trigger it (no delay, no throttle - game state prevents duplicates)
      console.log(`[AI Trigger] ✅ AI player detected - triggering turn for ${currentPlayer.name} (${currentPlayerId}) in phase ${gameState.phase}`);
      executeAITurn(gameId, currentPlayerId, io)
        .then(() => {
          console.log(`[AI Trigger] ✅ AI turn promise resolved for ${currentPlayer.name}`);
        })
        .catch(err => {
          console.error(`[AI Trigger] ❌ AI turn promise rejected for ${currentPlayer.name}:`, err);
          console.error(`[AI Trigger] Error stack:`, err.stack);
        });
    } else {
      // Human needs analysis - send it
      console.log(`[AI Trigger] 👤 Human player - sending analysis for ${currentPlayer.name} at position ${currentPlayer.position}`);
      sendAIAnalysis(gameId, currentPlayer.position, io).catch(err =>
        console.error(`[AI Trigger] ❌ Analysis error:`, err)
      );
    }
  } catch (error: any) {
    console.error(`[AI Trigger] ❌ FATAL ERROR in checkAndTriggerAI:`, error);
    console.error(`[AI Trigger] Error message:`, error.message);
    console.error(`[AI Trigger] Error stack:`, error.stack);
  }
}

/**
 * Setup AI triggers for game state updates
 */
export function setupAITriggers(io: Server): (gameId: string, gameState: GameState) => void {
  return (gameId: string, gameState: GameState) => {
    // Trigger AI check asynchronously
    checkAndTriggerAI(gameId, gameState, io).catch(err =>
      console.error('[AI Trigger] Error in trigger handler:', err)
    );
  };
}
