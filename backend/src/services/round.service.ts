import { Server } from 'socket.io';
import type { GameState } from '@buck-euchre/shared';
import { executeGameAction, getActiveGameState } from './state.service';
import { getConnectedPlayersInGame } from './connection.service';
import { startNextRound, dealNewRound } from '../game/state';

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

export function scheduleAutoStartNextRound(
  gameId: string,
  io: Server,
  snapshot: RoundSnapshot,
  triggerAI: (gameId: string, state: GameState, io: Server) => Promise<void>,
  delayMs: number = AUTO_START_DELAY_MS
): void {
  cancelAutoStartNextRound(gameId);

  const timer = setTimeout(async () => {
    autoStartTimers.delete(gameId);

    try {
      const activeState = getActiveGameState(gameId);
      if (!activeState) {
        return;
      }

      if (
        activeState.phase !== 'ROUND_OVER' ||
        activeState.round !== snapshot.round ||
        activeState.version !== snapshot.version ||
        activeState.gameOver
      ) {
        return;
      }

      const connectedPlayers = getConnectedPlayersInGame(gameId);
      if (connectedPlayers.length === 0) {
        console.log(`[ROUND] Skipping auto-start for game ${gameId} (no connected players)`);
        return;
      }

      const roundState = await executeGameAction(gameId, (currentState) => {
        if (
          currentState.phase !== 'ROUND_OVER' ||
          currentState.round !== snapshot.round ||
          currentState.version !== snapshot.version ||
          currentState.gameOver
        ) {
          return currentState;
        }

        const dealingState = startNextRound(currentState);
        return dealNewRound(dealingState);
      });

      if (roundState.round <= snapshot.round) {
        return;
      }

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
}
