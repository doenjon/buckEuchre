/**
 * @module services/watchdog
 * @description Game watchdog service to detect and recover stuck games
 *
 * This service monitors active games and detects when they've been stuck
 * (no activity for too long). When a stuck game is detected, it triggers
 * an AI check to attempt recovery.
 */

import { Server } from 'socket.io';
import { getActiveGameState, getAllActiveGameIds } from './state.service.js';
import { checkAndTriggerAI } from '../ai/trigger.js';

// How long a game can be inactive before we consider it stuck (ms)
const STUCK_THRESHOLD_MS = 30000; // 30 seconds

// How often to check for stuck games (ms)
const CHECK_INTERVAL_MS = 10000; // 10 seconds

// Track last activity time for each game
const gameActivityTimestamps = new Map<string, number>();

// Track games that we've already attempted to recover
const recoveryAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Maximum recovery attempts before giving up
const MAX_RECOVERY_ATTEMPTS = 3;

// Cooldown between recovery attempts for the same game
const RECOVERY_COOLDOWN_MS = 15000; // 15 seconds

let watchdogInterval: NodeJS.Timeout | null = null;
let ioInstance: Server | null = null;

/**
 * Record activity for a game (call this whenever any action happens)
 */
export function recordGameActivity(gameId: string): void {
  gameActivityTimestamps.set(gameId, Date.now());
}

/**
 * Clear activity tracking for a game (call when game ends)
 */
export function clearGameActivity(gameId: string): void {
  gameActivityTimestamps.delete(gameId);
  recoveryAttempts.delete(gameId);
}

/**
 * Check if a game appears to be stuck and needs recovery
 */
function isGameStuck(gameId: string): boolean {
  const lastActivity = gameActivityTimestamps.get(gameId);
  if (!lastActivity) {
    // No recorded activity - check if game exists and is in an active phase
    const state = getActiveGameState(gameId);
    if (state && isActivePhase(state.phase)) {
      // Game exists in active phase but no activity tracked - mark it now
      recordGameActivity(gameId);
      return false;
    }
    return false;
  }

  const inactiveTime = Date.now() - lastActivity;
  return inactiveTime > STUCK_THRESHOLD_MS;
}

/**
 * Check if a game phase should have activity
 */
function isActivePhase(phase: string): boolean {
  return ['BIDDING', 'DECLARING_TRUMP', 'FOLDING_DECISION', 'PLAYING'].includes(phase);
}

/**
 * Check if we can attempt recovery for a game
 */
function canAttemptRecovery(gameId: string): boolean {
  const attempts = recoveryAttempts.get(gameId);
  if (!attempts) {
    return true;
  }

  // Check if we've exceeded max attempts
  if (attempts.count >= MAX_RECOVERY_ATTEMPTS) {
    return false;
  }

  // Check if enough time has passed since last attempt
  const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
  return timeSinceLastAttempt >= RECOVERY_COOLDOWN_MS;
}

/**
 * Record a recovery attempt for a game
 */
function recordRecoveryAttempt(gameId: string): void {
  const existing = recoveryAttempts.get(gameId);
  recoveryAttempts.set(gameId, {
    count: (existing?.count || 0) + 1,
    lastAttempt: Date.now(),
  });
}

/**
 * Attempt to recover a stuck game
 */
async function attemptRecovery(gameId: string): Promise<void> {
  if (!ioInstance) {
    console.warn(`[Watchdog] Cannot recover game ${gameId} - no IO instance`);
    return;
  }

  const state = getActiveGameState(gameId);
  if (!state) {
    console.log(`[Watchdog] Game ${gameId} no longer exists, clearing tracking`);
    clearGameActivity(gameId);
    return;
  }

  // Don't try to recover games that aren't in an active phase
  if (!isActivePhase(state.phase)) {
    console.log(`[Watchdog] Game ${gameId} is in ${state.phase} phase, not an active phase`);
    // Still update activity timestamp to prevent repeated checks
    recordGameActivity(gameId);
    return;
  }

  console.log(`[Watchdog] 🔄 Attempting recovery for stuck game ${gameId}`, {
    phase: state.phase,
    currentPlayer: state.currentPlayerPosition,
    currentBidder: state.currentBidder,
    version: state.version,
  });

  recordRecoveryAttempt(gameId);

  try {
    await checkAndTriggerAI(gameId, state, ioInstance);
    console.log(`[Watchdog] ✅ Recovery trigger sent for game ${gameId}`);
    // Record activity since we just triggered something
    recordGameActivity(gameId);
  } catch (error) {
    console.error(`[Watchdog] ❌ Recovery failed for game ${gameId}:`, error);
  }
}

/**
 * Check all active games for stuck state
 */
async function checkAllGames(): Promise<void> {
  const gameIds = getAllActiveGameIds();

  for (const gameId of gameIds) {
    if (isGameStuck(gameId) && canAttemptRecovery(gameId)) {
      console.log(`[Watchdog] ⚠️ Game ${gameId} appears stuck, attempting recovery`);
      await attemptRecovery(gameId);
    }
  }
}

/**
 * Start the watchdog service
 */
export function startWatchdog(io: Server): void {
  if (watchdogInterval) {
    console.log('[Watchdog] Already running');
    return;
  }

  ioInstance = io;
  watchdogInterval = setInterval(() => {
    checkAllGames().catch(err => {
      console.error('[Watchdog] Error in check cycle:', err);
    });
  }, CHECK_INTERVAL_MS);

  console.log('[Watchdog] 🐕 Started - checking for stuck games every', CHECK_INTERVAL_MS / 1000, 'seconds');
}

/**
 * Stop the watchdog service
 */
export function stopWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
    ioInstance = null;
    console.log('[Watchdog] Stopped');
  }
}

/**
 * Get watchdog status for debugging
 */
export function getWatchdogStatus(): {
  running: boolean;
  trackedGames: number;
  games: Array<{ gameId: string; lastActivity: number; inactiveMs: number; recoveryAttempts: number }>;
} {
  const now = Date.now();
  const games: Array<{ gameId: string; lastActivity: number; inactiveMs: number; recoveryAttempts: number }> = [];

  for (const [gameId, timestamp] of Array.from(gameActivityTimestamps.entries())) {
    games.push({
      gameId,
      lastActivity: timestamp,
      inactiveMs: now - timestamp,
      recoveryAttempts: recoveryAttempts.get(gameId)?.count || 0,
    });
  }

  return {
    running: watchdogInterval !== null,
    trackedGames: gameActivityTimestamps.size,
    games,
  };
}
