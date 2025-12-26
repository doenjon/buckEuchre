import { Server } from 'socket.io';
import type { GameState } from '@buck-euchre/shared';
import { executeGameAction, getActiveGameState } from './state.service.js';
import { getConnectedPlayersInGame } from './connection.service.js';
import { startNextRound, dealNewRound } from '../game/state.js';

const AUTO_START_DELAY_MS = 5000;
const autoStartTimers = new Map<string, NodeJS.Timeout>();

interface RoundSnapshot {
  round: number;
  version: number;
}

export function cancelAutoStartNextRound(gameId: string): void {
  const timer = autoStartTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    autoStartTimers.delete(gameId);
  }
}

/**
 * Check if an auto-start timer exists for a game
 */
export function hasAutoStartTimer(gameId: string): boolean {
  return autoStartTimers.has(gameId);
}

export function scheduleAutoStartNextRound(
  gameId: string,
  io: Server,
  snapshot: RoundSnapshot,
  triggerAI: (gameId: string, state: GameState, io: Server) => Promise<void>,
  delayMs: number = AUTO_START_DELAY_MS
): void {
  cancelAutoStartNextRound(gameId);

  console.log(`[ROUND] Scheduling auto-start timer for game ${gameId}`, {
    round: snapshot.round,
    version: snapshot.version,
    delayMs
  });

  const timer = setTimeout(async () => {
    console.log(`[ROUND] Auto-start timer fired for game ${gameId}`, {
      snapshotRound: snapshot.round,
      snapshotVersion: snapshot.version
    });

    autoStartTimers.delete(gameId);

    try {
      const activeState = getActiveGameState(gameId);
      if (!activeState) {
        console.log(`[ROUND] Auto-start cancelled: game ${gameId} not found in active games`);
        return;
      }

      console.log(`[ROUND] Current state for game ${gameId}:`, {
        phase: activeState.phase,
        round: activeState.round,
        version: activeState.version,
        gameOver: activeState.gameOver
      });

      if (
        activeState.phase !== 'ROUND_OVER' ||
        activeState.round !== snapshot.round ||
        activeState.version !== snapshot.version ||
        activeState.gameOver
      ) {
        console.log(`[ROUND] Auto-start cancelled: state mismatch for game ${gameId}`, {
          expectedPhase: 'ROUND_OVER',
          actualPhase: activeState.phase,
          expectedRound: snapshot.round,
          actualRound: activeState.round,
          expectedVersion: snapshot.version,
          actualVersion: activeState.version,
          gameOver: activeState.gameOver
        });
        return;
      }

      const connectedPlayers = getConnectedPlayersInGame(gameId);
      if (connectedPlayers.length === 0) {
        console.log(`[ROUND] Skipping auto-start for game ${gameId} (no connected players)`);
        return;
      }

      console.log(`[ROUND] Starting next round for game ${gameId}...`);

      const roundState = await executeGameAction(gameId, (currentState) => {
        if (
          currentState.phase !== 'ROUND_OVER' ||
          currentState.round !== snapshot.round ||
          currentState.version !== snapshot.version ||
          currentState.gameOver
        ) {
          console.log(`[ROUND] State changed during transaction for game ${gameId}, aborting`);
          return currentState;
        }

        const dealingState = startNextRound(currentState);
        return dealNewRound(dealingState);
      });

      if (roundState.round <= snapshot.round) {
        console.log(`[ROUND] Round did not advance for game ${gameId}, aborting`, {
          currentRound: roundState.round,
          expectedRound: snapshot.round + 1
        });
        return;
      }

      console.log(`[ROUND] Successfully started round ${roundState.round} for game ${gameId}`);

      io.to(`game:${gameId}`).emit('GAME_STATE_UPDATE', {
        gameState: roundState,
        event: 'ROUND_STARTED'
      });

      await triggerAI(gameId, roundState, io);
    } catch (error: any) {
      console.error(`[ROUND] Error auto-starting next round for game ${gameId}:`, error.message || error);
    }
  }, delayMs);

  autoStartTimers.set(gameId, timer);
  console.log(`[ROUND] Timer scheduled successfully for game ${gameId}`);
}
