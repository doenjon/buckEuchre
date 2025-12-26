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
import { analyzeHand, getBestCard, analyzeBids, getBestBid, analyzeFoldDecision, getBestFoldDecision, analyzeTrumpSelection, getBestSuit } from './analysis.service';
import { getActiveGameState } from '../services/state.service';

/**
 * Track last analysis sent to prevent duplicate sends
 *
 * IMPORTANT: Analysis should run **once per decision point**, not on a timer.
 * We key analysis by a stable "situation id" so duplicate state updates while a
 * player is thinking don't repeatedly trigger expensive MCTS.
 */
const lastAnalysisKey = new Map<string, number>();

function getAnalysisSituationKey(gameId: string, gameState: GameState, playerPosition: number): string {
  switch (gameState.phase) {
    case 'PLAYING': {
      const round = gameState.round;
      const trickNo = gameState.currentTrick?.number ?? (gameState.tricks.length + 1);
      const cardsInTrick = gameState.currentTrick?.cards?.length ?? 0;
      const currentPlayer = gameState.currentPlayerPosition ?? -1;
      return `${gameId}:PLAYING:p${playerPosition}:r${round}:t${trickNo}:c${cardsInTrick}:cp${currentPlayer}`;
    }
    case 'BIDDING': {
      const round = gameState.round;
      const bidsLen = gameState.bids?.length ?? 0;
      const currentBidder = gameState.currentBidder ?? -1;
      const highestBid = gameState.highestBid ?? 'N';
      return `${gameId}:BIDDING:p${playerPosition}:r${round}:b${bidsLen}:cb${currentBidder}:hb${highestBid}`;
    }
    case 'FOLDING_DECISION': {
      const round = gameState.round;
      const winningBidder = gameState.winningBidderPosition ?? -1;
      // For folding decisions, we only care about THIS player's decision state, not others
      // This prevents the key from changing when other players decide, which would cause
      // the analysis to be re-sent unnecessarily or blocked incorrectly
      const thisPlayerDecision = gameState.players[playerPosition]?.foldDecision ?? 'UNDECIDED';
      return `${gameId}:FOLDING:p${playerPosition}:r${round}:wb${winningBidder}:d${thisPlayerDecision}`;
    }
    default:
      return `${gameId}:${gameState.phase}:p${playerPosition}:v${gameState.version}`;
  }
}

/**
 * Track last checkAndTriggerAI call to prevent excessive triggering
 * Key: `${gameId}`
 */
const lastTriggerCheck = new Map<string, number>();
const TRIGGER_COOLDOWN_MS = 50; // Don't check triggers more than once per 50ms for the same situation

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
 * Check if analysis should be sent for a player
 *
 * This function checks the cooldown and marks analysis as sent if it should run.
 * This prevents race conditions where multiple analyses are scheduled before any execute.
 *
 * @param gameId - ID of the game
 * @param gameState - Current game state
 * @param playerPosition - Position of the player
 * @returns true if analysis should be sent, false if already sent recently
 */
function shouldSendAnalysis(
  gameId: string,
  gameState: GameState,
  playerPosition: number
): boolean {
  // Only analyze during specific phases
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'BIDDING' && gameState.phase !== 'FOLDING_DECISION' && gameState.phase !== 'DECLARING_TRUMP') {
    return false;
  }

  // Check if it's actually this player's turn based on phase
  const currentPlayerPos = gameState.currentPlayerPosition ?? gameState.currentBidder ?? -1;
  let isPlayersTurn = false;
  if (gameState.phase === 'PLAYING') {
    isPlayersTurn = currentPlayerPos === playerPosition;
  } else if (gameState.phase === 'BIDDING') {
    isPlayersTurn = gameState.currentBidder === playerPosition;
  } else if (gameState.phase === 'FOLDING_DECISION') {
    // In folding phase, check if this player needs to make a decision
    const player = gameState.players[playerPosition];
    isPlayersTurn = player.foldDecision === 'UNDECIDED' && playerPosition !== gameState.winningBidderPosition;
  } else if (gameState.phase === 'DECLARING_TRUMP') {
    // In trump selection phase, only the winning bidder selects trump
    isPlayersTurn = gameState.winningBidderPosition === playerPosition;
  }

  if (!isPlayersTurn) {
    return false;
  }

  // Build a stable "decision point" key so analysis runs once per turn/decision.
  const analysisKey = getAnalysisSituationKey(gameId, gameState, playerPosition);

  // Check if we've already sent analysis for this exact decision point.
  const lastSent = lastAnalysisKey.get(analysisKey);
  const now = Date.now();

  if (lastSent) {
    // Already sent analysis for this decision point - skip
    return false;
  }

  // Mark that we're sending analysis for this key NOW (before it actually runs)
  // This prevents race conditions where multiple calls check the cooldown before any set it
  lastAnalysisKey.set(analysisKey, now);

  // Clean up old entries (keep only last 100)
  if (lastAnalysisKey.size > 100) {
    const entries = Array.from(lastAnalysisKey.entries());
    entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
    lastAnalysisKey.clear();
    entries.slice(0, 50).forEach(([key, time]) => lastAnalysisKey.set(key, time));
  }

  return true;
}

/**
 * Check if AI should act and trigger if needed
 *
 * This function is called after every game state update to check
 * if an AI player needs to take an action.
 *
 * IMPORTANT: Always fetches fresh state from memory to avoid stale state issues.
 * This prevents race conditions where passed state is outdated (e.g., after async delays).
 * The gameState parameter is kept for backwards compatibility but is ignored.
 *
 * @param gameId - ID of the game
 * @param gameState - DEPRECATED: Ignored, fresh state is fetched from memory
 * @param io - Socket.io server for broadcasting
 */
export async function checkAndTriggerAI(
  gameId: string,
  _gameState: GameState, // Deprecated - kept for backwards compatibility
  io: Server
): Promise<void> {
  try {
    // Always use fresh state from memory to avoid stale state issues
    // This prevents race conditions where passed state is outdated (e.g., after async delays)
    const gameState = getActiveGameState(gameId);
    if (!gameState) {
      console.log(`[AI Trigger] Game ${gameId} not found in memory, skipping trigger`);
      return;
    }

    // Get current acting player early to create throttle key
    const currentPlayerIdForThrottle = getCurrentActingPlayer(gameState);
    const throttleKey = `${gameId}:${gameState.phase}:${currentPlayerIdForThrottle || 'none'}`;
    
    // Throttle: Don't check triggers more than once per TRIGGER_COOLDOWN_MS for the same situation
    const now = Date.now();
    const lastCheck = lastTriggerCheck.get(throttleKey);
    if (lastCheck && (now - lastCheck) < TRIGGER_COOLDOWN_MS) {
      // Too soon since last check for this exact situation, skip
      console.log(`[AI Trigger] Throttled: same situation checked ${now - lastCheck}ms ago`);
      return;
    }
    lastTriggerCheck.set(throttleKey, now);

    // Clean up old entries (keep only last 100)
    if (lastTriggerCheck.size > 100) {
      const entries = Array.from(lastTriggerCheck.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
      lastTriggerCheck.clear();
      entries.slice(0, 50).forEach(([key, time]) => lastTriggerCheck.set(key, time));
    }

    console.log(`[AI Trigger] Checking AI trigger for game ${gameId}, phase: ${gameState.phase}, currentBidder: ${gameState.currentBidder}, currentPlayer: ${currentPlayerIdForThrottle}`);

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

      // ALSO send analysis to any human players who are currently deciding to fold/stay.
      // (Previously we returned early and never emitted fold analysis events for humans.)
      for (let pos = 0; pos < 4; pos++) {
        const player = gameState.players[pos];

        // Skip bidder and already-decided players
        if (pos === gameState.winningBidderPosition || player.foldDecision !== 'UNDECIDED') {
          continue;
        }

        // Skip AI players (they'll act automatically)
        if (isAIPlayerByName(player.name)) {
          continue;
        }

        if (shouldSendAnalysis(gameId, gameState, pos as any)) {
          console.log(`[AI Trigger] Scheduling fold analysis for human player at position ${pos}`);
          setTimeout(() => {
            sendAIAnalysis(gameId, gameState, pos, io).catch(err => {
              console.error(`[AI Trigger] Error sending fold analysis:`, err);
            });
          }, 0);
        } else {
          console.log(`[AI Trigger] Fold analysis already sent recently for player at position ${pos}, skipping`);
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
      console.log(`[AI Trigger] Current player ${currentPlayer.name} is human, checking if analysis needed`);

      // Check cooldown BEFORE scheduling to prevent race condition
      // where multiple analyses are scheduled before any execute
      if (shouldSendAnalysis(gameId, gameState, currentPlayer.position)) {
        console.log(`[AI Trigger] Scheduling AI analysis for player ${currentPlayer.name} at position ${currentPlayer.position}`);
        setTimeout(() => {
          sendAIAnalysis(gameId, gameState, currentPlayer.position, io).catch(err => {
            console.error(`[AI Trigger] Error sending AI analysis:`, err);
          });
        }, 0);
      } else {
        console.log(`[AI Trigger] Analysis already sent recently for player ${currentPlayer.name} at position ${currentPlayer.position}, skipping`);
      }
      return;
    }

    // Current player is AI - trigger after brief delay
    console.log(`[AI Trigger] AI player ${currentPlayer.name} (${currentPlayerId}) needs to act in phase ${gameState.phase}`);
    
    // Use setTimeout with a small delay to let state stabilize, but don't block
    setTimeout(() => {
      console.log(`[AI Trigger] Executing AI turn for ${currentPlayer.name} (${currentPlayerId})`);
      executeAITurn(gameId, currentPlayerId, io)
        .then(() => {
          console.log(`[AI Trigger] ✅ AI turn completed for ${currentPlayer.name} (${currentPlayerId})`);
        })
        .catch(err => {
          console.error(`[AI Trigger] ❌ Error triggering AI turn for ${currentPlayer.name} (${currentPlayerId}):`, err);
        });
    }, 50); // Reduced delay to 50ms for faster response
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
 * NOTE: Cooldown check is done in shouldSendAnalysis() before this is called
 *
 * @param gameId - ID of the game
 * @param gameState - Current game state
 * @param playerPosition - Position of the human player
 * @param io - Socket.io server for broadcasting
 */
async function sendAIAnalysis(
  gameId: string,
  _gameState: GameState, // Deprecated - fetch fresh state from memory
  playerPosition: number,
  io: Server
): Promise<void> {
  try {
    // Always fetch fresh state from memory to avoid stale state issues
    // This prevents race conditions where state changes between scheduling and execution
    const gameState = getActiveGameState(gameId);
    if (!gameState) {
      console.log(`[AI Analysis] Game ${gameId} not found in memory, skipping analysis`);
      return;
    }

    // Double-check that we're still in the right phase and it's still this player's turn
    if (gameState.phase === 'FOLDING_DECISION') {
      const player = gameState.players[playerPosition];
      if (playerPosition === gameState.winningBidderPosition || player.foldDecision !== 'UNDECIDED') {
        console.log(`[AI Analysis] Player ${playerPosition} no longer needs fold analysis (already decided or is bidder)`);
        return;
      }
    }

    console.log(`[AI Analysis] Analyzing for player at position ${playerPosition} in phase ${gameState.phase}`);

    // Run analysis with high quality (5000 simulations)
    const analysisConfig = {
      simulations: 5000,
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
    } else if (gameState.phase === 'DECLARING_TRUMP') {
      const analyses = await analyzeTrumpSelection(gameState, playerPosition as any, analysisConfig);

      if (analyses.length === 0) {
        console.log(`[AI Analysis] No trump suit analysis available for player ${playerPosition}`);
        return;
      }

      const bestSuit = getBestSuit(analyses);

      analysisEvent = {
        playerPosition: playerPosition as any,
        analysisType: 'suit',
        suits: analyses,
        totalSimulations: analysisConfig.simulations,
        bestSuit: bestSuit ?? undefined,
      };

      console.log(`[AI Analysis] Sent suit analysis for ${analyses.length} suits to game ${gameId}`);
    } else {
      return;
    }

    // Broadcast to the game room
    console.log(`[AI Analysis] Broadcasting ${analysisEvent.analysisType} analysis to game ${gameId}`, {
      playerPosition: analysisEvent.playerPosition,
      analysisType: analysisEvent.analysisType,
      ...(analysisEvent.analysisType === 'fold' && { foldOptionsCount: analysisEvent.foldOptions?.length ?? 0 }),
      ...(analysisEvent.analysisType === 'card' && { cardsCount: analysisEvent.cards?.length ?? 0 }),
      ...(analysisEvent.analysisType === 'bid' && { bidsCount: analysisEvent.bids?.length ?? 0 }),
      ...(analysisEvent.analysisType === 'suit' && { suitsCount: analysisEvent.suits?.length ?? 0 }),
    });
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
