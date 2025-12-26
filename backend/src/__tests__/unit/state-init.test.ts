/**
 * Unit tests for the state initialization + action queue design.
 *
 * These tests specifically cover the historical brittleness:
 * - State used to be initialized outside the queue (race-prone)
 * - The queue couldn't initialize because it required state to exist
 *
 * We mock Prisma so these tests don't require a running database.
 */

jest.mock('../../db/client', () => {
  return {
    prisma: {
      gameState: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      game: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
  };
});

import { initializeGame, dealNewRound } from '../../game/state.js';
import {
  cleanupGameState,
  executeGameAction,
  executeGameActionWithInit,
  getActiveGameState,
} from '../../services/state.service.js';

describe('state.service initialization + queue', () => {
  afterEach(() => {
    // Best-effort cleanup for any test game IDs we used.
    cleanupGameState('test-game-init');
    cleanupGameState('test-game-queue');
  });

  it('initializes state exactly once under concurrent executeGameActionWithInit calls', async () => {
    const gameId = 'test-game-init';
    const playerIds: [string, string, string, string] = ['p1', 'p2', 'p3', 'p4'];

    let initCalls = 0;
    const initializer = () => {
      initCalls += 1;
      const s = initializeGame(playerIds);
      s.gameId = gameId;
      return s;
    };

    const startAction = (state: any) => {
      // Idempotent: only deal if still DEALING
      if (state.phase !== 'DEALING') return state;
      return dealNewRound(state);
    };

    await Promise.all(
      Array.from({ length: 20 }).map(() =>
        executeGameActionWithInit(gameId, initializer, startAction)
      )
    );

    expect(initCalls).toBe(1);

    const finalState = getActiveGameState(gameId);
    expect(finalState).not.toBeNull();
    expect(finalState!.phase).not.toBe('DEALING');
  });

  it('serializes concurrent actions after initialization (no lost updates)', async () => {
    const gameId = 'test-game-queue';
    const playerIds: [string, string, string, string] = ['p1', 'p2', 'p3', 'p4'];

    const initializer = () => {
      const s = initializeGame(playerIds);
      s.gameId = gameId;
      return s;
    };

    await executeGameActionWithInit(gameId, initializer, (s) => s);
    const before = getActiveGameState(gameId)!;
    const startVersion = before.version;

    const bumps = 50;
    await Promise.all(
      Array.from({ length: bumps }).map(() =>
        executeGameAction(gameId, (s) => ({
          ...s,
          version: s.version + 1,
          updatedAt: Date.now(),
        }))
      )
    );

    const after = getActiveGameState(gameId)!;
    expect(after.version).toBe(startVersion + bumps);
  });
});


