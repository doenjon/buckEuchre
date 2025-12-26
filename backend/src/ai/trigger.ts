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
import { getUserSettings } from '../services/settings.service';

/**
 * Track last analysis sent to prevent duplicate sends
 *
 * IMPORTANT: Analysis should run **once per decision point**, not on a timer.
 * We key analysis by a stable "situation id" so duplicate state updates while a
 * player is thinking don't repeatedly trigger expensive MCTS.
 */
const lastAnalysisKey = new Map<string, number>();

/**
 * Cache `showCardOverlay` per userId so we don't hit the DB on every state update.
 * This directly controls whether we run *human* analysis (advisory overlays).
 *
 * Bot AI decisions are NOT gated by this flag.
 */
const overlayEnabledCache = new Map<string, { value: boolean; ts: number }>();
const OVERLAY_CACHE_TTL_MS = 15_000;

async function isOverlayEnabledForUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const now = Date.now();
  const cached = overlayEnabledCache.get(userId);
  if (cached && now - cached.ts < OVERLAY_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const settings = await getUserSettings(userId);
    const value = settings.showCardOverlay === true;
    overlayEnabledCache.set(userId, { value, ts: now });

    // Prevent unbounded growth
    if (overlayEnabledCache.size > 500) {
      const entries = Array.from(overlayEnabledCache.entries());
      entries.sort((a, b) => b[1].ts - a[1].ts);
      overlayEnabledCache.clear();
      entries.slice(0, 250).forEach(([k, v]) => overlayEnabledCache.set(k, v));
    }

    return value;
  } catch (err) {
    console.warn('[AI Trigger] Failed to load user settings for overlay gate; defaulting showCardOverlay=false', {
      userId,
      error: (err as any)?.message || err,
    });
    overlayEnabledCache.set(userId, { value: false, ts: now });
    return false;
  }
}

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
      const player = gameState.players[playerPosition];
      // Only include THIS player's decision state in the key, not all players
      // This ensures the key is stable until THIS player makes a decision
      const thisPlayerDecision = player?.foldDecision?.[0] ?? 'U';
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
const TRIGGER_COOLDOWN_MS = 100; // Don't check triggers more than once per 100ms per game

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
 * Returns true only if the player is at a real decision point for the current phase.
 * This prevents analysis from running during transitional states (e.g., right after Pass before
 * FOLDING_DECISION actually begins).
 */
function isDecisionPoint(gameState: GameState, playerPosition: number): boolean {
  switch (gameState.phase) {
    case 'BIDDING': {
      return gameState.currentBidder === playerPosition;
    }
    case 'DECLARING_TRUMP': {
      // Only the winning bidder declares trump
      return gameState.winningBidderPosition === playerPosition && gameState.highestBid !== null;
    }
    case 'FOLDING_DECISION': {
      // Only non-bidders who haven't decided yet; ensure trump is chosen and bidder exists
      if (gameState.winningBidderPosition === null || !gameState.trumpSuit) {
        return false;
      }
      const player = gameState.players[playerPosition];
      if (!player) return false;
      return playerPosition !== gameState.winningBidderPosition && player.foldDecision === 'UNDECIDED';
    }
    case 'PLAYING': {
      // Current player, not folded, has cards to play
      if (gameState.currentPlayerPosition !== playerPosition) return false;
      const player = gameState.players[playerPosition];
      if (!player) return false;
      if (player.folded) return false;
      return Array.isArray(player.hand) && player.hand.length > 0;
    }
    default:
      return false;
  }
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
const ANALYSIS_RESEND_TTL_MS = 10_000; // allow resend after 10s (helps reconnects)

function shouldSendAnalysis(
  gameId: string,
  gameState: GameState,
  playerPosition: number
): boolean {
  // Only analyze during specific phases
  if (
    gameState.phase !== 'PLAYING' &&
    gameState.phase !== 'BIDDING' &&
    gameState.phase !== 'FOLDING_DECISION' &&
    gameState.phase !== 'DECLARING_TRUMP'
  ) {
    return false;
  }

  // Strict decision-point guard to avoid running analysis during transitions
  if (!isDecisionPoint(gameState, playerPosition)) {
    return false;
  }

  // Build a stable "decision point" key so analysis runs once per turn/decision.
  const analysisKey = getAnalysisSituationKey(gameId, gameState, playerPosition);

  // Check if we've already sent analysis for this exact decision point.
  const lastSent = lastAnalysisKey.get(analysisKey);
  const now = Date.now();

  if (lastSent) {
    // If we sent very recently, skip; otherwise allow resend for clients that reconnected
    if ((now - lastSent) < ANALYSIS_RESEND_TTL_MS) {
      return false;
    }
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
    // This prevents race conditions where passed state is outdated
    const gameState = getActiveGameState(gameId);
    if (!gameState) {
      console.log(`[AI Trigger] Game ${gameId} not found in memory, skipping trigger`);
      return;
    }
    
    // Throttle: Don't check triggers more than once per TRIGGER_COOLDOWN_MS per game
    const now = Date.now();
    const lastCheck = lastTriggerCheck.get(gameId);
    if (lastCheck && (now - lastCheck) < TRIGGER_COOLDOWN_MS) {
      // Too soon since last check, skip
      return;
    }
    lastTriggerCheck.set(gameId, now);

    // Clean up old entries (keep only last 100 games)
    if (lastTriggerCheck.size > 100) {
      const entries = Array.from(lastTriggerCheck.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
      lastTriggerCheck.clear();
      entries.slice(0, 50).forEach(([key, time]) => lastTriggerCheck.set(key, time));
    }

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
      // Human analysis overlays are computed client-side now (to reduce server CPU).
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
 * NOTE: Cooldown check is done in shouldSendAnalysis() before this is called
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
  const startTime = Date.now();
  const player = gameState.players[playerPosition];
  try {
    console.log(`[AI Analysis] STARTING analysis for player ${player?.name || 'unknown'} (pos ${playerPosition}) in phase ${gameState.phase} at ${new Date().toISOString()}`);

    // Run analysis with high quality (5000 simulations)
    const analysisConfig = {
      simulations: 5000,
      verbose: false,
    };

    let analysisEvent: AIAnalysisEvent;

    // Analyze based on game phase
    if (gameState.phase === 'PLAYING') {
      console.log(`[AI Analysis] Running analyzeHand with ${analysisConfig.simulations} simulations...`);
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
      console.log(`[AI Analysis] Running analyzeBids with ${analysisConfig.simulations} simulations...`);
      const bidStartTime = Date.now();
      const analyses = await analyzeBids(gameState, playerPosition as any, analysisConfig);
      console.log(`[AI Analysis] analyzeBids completed in ${Date.now() - bidStartTime}ms`);

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

      console.log(`[AI Analysis] Sent fold analysis for ${analyses.length} options to game ${gameId}`, {
        playerPosition,
        playerName: player?.name,
        playerId: player?.id,
        analyses: analyses.map(a => ({ fold: a.fold, winProb: a.winProbability, isBest: a.isBest })),
      });
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
    const room = io.sockets.adapter.rooms.get(`game:${gameId}`);
    const clientCount = room ? room.size : 0;
    console.log(`[AI Analysis] Emitting AI_ANALYSIS_UPDATE to game:${gameId}`, {
      playerPosition: analysisEvent.playerPosition,
      analysisType: analysisEvent.analysisType,
      hasFoldOptions: analysisEvent.analysisType === 'fold' && !!analysisEvent.foldOptions,
      foldOptionsCount: analysisEvent.analysisType === 'fold' ? analysisEvent.foldOptions?.length : 0,
      clientsInRoom: clientCount,
    });
    io.to(`game:${gameId}`).emit('AI_ANALYSIS_UPDATE', analysisEvent);
    const duration = Date.now() - startTime;
    console.log(`[AI Analysis] COMPLETED analysis for player ${player?.name || 'unknown'} (pos ${playerPosition}) in ${duration}ms`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[AI Analysis] ERROR after ${duration}ms:`, error.message || error);
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
