import { GameState } from '@buck-euchre/shared';
import { prisma } from '../db/client';

/**
 * In-memory game state store
 * 
 * This is the SOURCE OF TRUTH for active games.
 * Database writes are asynchronous backups only.
 */
const activeGames = new Map<string, GameState>();

/**
 * Action queue per game to prevent race conditions
 * 
 * Each game has its own Promise chain that ensures actions
 * are processed sequentially for that game.
 * Different games can process actions in parallel.
 */
const gameActionQueues = new Map<string, Promise<any>>();

/**
 * Initialization queue per game to prevent double-initialization races.
 *
 * This solves the "chicken-and-egg" problem: executeGameAction() requires an
 * in-memory state to exist, but game start/recovery sometimes needs to create it.
 *
 * All callers that might initialize state concurrently should go through
 * ensureGameStateInitialized() / executeGameActionWithInit().
 */
const gameInitLocks = new Map<string, Promise<void>>();

/**
 * Execute an action on a game state, ensuring sequential processing
 * 
 * This prevents race conditions when multiple players act simultaneously.
 * All state mutations for a game are serialized through this function.
 * 
 * IMPORTANT: In-memory Map is SOURCE OF TRUTH. Database is backup only.
 * 
 * @param gameId - The game ID
 * @param action - A function that takes current state and returns new state
 * @returns The new game state after applying the action
 * 
 * @example
 * ```typescript
 * const newState = await executeGameAction(gameId, async (currentState) => {
 *   // Apply game logic (pure function)
 *   return playCard(currentState, playerId, card);
 * });
 * ```
 */
export async function executeGameAction<T = GameState>(
  gameId: string,
  action: (currentState: GameState) => Promise<GameState> | GameState
): Promise<GameState> {
  const callStack = new Error().stack?.split('\n').slice(2, 5).join(' | ') || 'unknown';
  console.log(`[STATE:executeGameAction] ENTRY gameId=${gameId} stack=${callStack}`);
  
  // Get or create queue for this game
  const currentQueue = gameActionQueues.get(gameId) || Promise.resolve();
  const queueExists = gameActionQueues.has(gameId);
  console.log(`[STATE:executeGameAction] gameId=${gameId} queueExists=${queueExists} activeGames.has=${activeGames.has(gameId)}`);

  // Chain this action to the queue
  const newQueue = currentQueue.then(async () => {
    console.log(`[STATE:executeGameAction] EXECUTING gameId=${gameId} - action starting`);
    const state = activeGames.get(gameId);
    if (!state) {
      console.error(`[STATE:executeGameAction] ERROR gameId=${gameId} - state not found in activeGames!`);
      throw new Error('Game not found in active games');
    }
    console.log(`[STATE:executeGameAction] gameId=${gameId} currentPhase=${state.phase} version=${state.version} players=${state.players.length}`);

    // Execute action (pure function from game logic)
    const newState = await action(state);
    console.log(`[STATE:executeGameAction] gameId=${gameId} action completed - newPhase=${newState.phase} newVersion=${newState.version}`);

    // Update in-memory state (SOURCE OF TRUTH)
    activeGames.set(gameId, newState);
    console.log(`[STATE:executeGameAction] gameId=${gameId} state updated in memory`);

    // Persist to database as backup (fire-and-forget, async)
    // Use setImmediate to defer database write to next event loop tick
    // This prevents database writes from blocking the action queue
    setImmediate(() => {
      saveGameState(gameId, newState).catch((err) =>
        console.error(`Failed to persist game state for ${gameId}:`, err)
      );
    });

    return newState;
  });

  // Update queue
  gameActionQueues.set(gameId, newQueue.catch(() => undefined));

  // Wait for this action to complete and return the new state
  const result = await newQueue;
  console.log(`[STATE:executeGameAction] EXIT gameId=${gameId} resultPhase=${result.phase} resultVersion=${result.version}`);
  return result;
}

/**
 * Ensure a game has an in-memory state, creating it at most once.
 *
 * IMPORTANT:
 * - This does NOT run through the action queue because the queue needs state first.
 * - It *does* serialize initialization using a per-game init lock.
 * - After this resolves, it is safe to call executeGameAction().
 */
export async function ensureGameStateInitialized(
  gameId: string,
  initializer: () => Promise<GameState> | GameState
): Promise<GameState> {
  const callStack = new Error().stack?.split('\n').slice(2, 5).join(' | ') || 'unknown';
  console.log(`[STATE:ensureGameStateInitialized] ENTRY gameId=${gameId} stack=${callStack}`);
  
  const existing = activeGames.get(gameId);
  if (existing) {
    console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - state already exists phase=${existing.phase}`);
    return existing;
  }

  const currentLock = gameInitLocks.get(gameId);
  if (currentLock) {
    console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - waiting for existing init lock`);
    await currentLock;
    const after = activeGames.get(gameId);
    if (!after) {
      console.error(`[STATE:ensureGameStateInitialized] ERROR gameId=${gameId} - lock completed but no state!`);
      throw new Error(`Game ${gameId} failed to initialize state`);
    }
    console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - got state from concurrent init phase=${after.phase}`);
    return after;
  }

  console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - creating new init lock`);
  const lock = (async () => {
    try {
      // Double-check after acquiring the lock.
      const doubleCheck = activeGames.get(gameId);
      if (doubleCheck) {
        console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - double-check found existing state phase=${doubleCheck.phase}`);
        return;
      }
      console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - calling initializer`);
      const created = await initializer();
      console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - initializer returned phase=${created.phase} version=${created.version}`);
      activeGames.set(gameId, created);
      console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - state stored in activeGames`);
      // Persist as backup (fire-and-forget)
      setImmediate(() => {
        saveGameState(gameId, created).catch((err) =>
          console.error(`Failed to persist initialized game state for ${gameId}:`, err)
        );
      });
    } finally {
      gameInitLocks.delete(gameId);
      console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - init lock released`);
    }
  })();

  gameInitLocks.set(gameId, lock);
  console.log(`[STATE:ensureGameStateInitialized] gameId=${gameId} - waiting for init lock to complete`);
  await lock;

  const initialized = activeGames.get(gameId);
  if (!initialized) {
    console.error(`[STATE:ensureGameStateInitialized] ERROR gameId=${gameId} - lock completed but no state in activeGames!`);
    throw new Error(`Game ${gameId} failed to initialize state`);
  }
  console.log(`[STATE:ensureGameStateInitialized] EXIT gameId=${gameId} phase=${initialized.phase} version=${initialized.version}`);
  return initialized;
}

/**
 * Execute an action, initializing state first if needed (exactly once).
 *
 * Use this for lifecycle transitions like game start where state might not exist yet.
 */
export async function executeGameActionWithInit(
  gameId: string,
  initializer: () => Promise<GameState> | GameState,
  action: (currentState: GameState) => Promise<GameState> | GameState
): Promise<GameState> {
  const callStack = new Error().stack?.split('\n').slice(2, 5).join(' | ') || 'unknown';
  console.log(`[STATE:executeGameActionWithInit] ENTRY gameId=${gameId} stack=${callStack}`);
  await ensureGameStateInitialized(gameId, initializer);
  console.log(`[STATE:executeGameActionWithInit] gameId=${gameId} - state initialized, calling executeGameAction`);
  const result = await executeGameAction(gameId, action);
  console.log(`[STATE:executeGameActionWithInit] EXIT gameId=${gameId} resultPhase=${result.phase}`);
  return result;
}

/**
 * Get the current game state from memory
 * 
 * This is the fastest way to read state and should be used
 * for all gameplay operations.
 * 
 * @param gameId - The game ID
 * @returns Current game state, or null if not in memory
 */
export function getActiveGameState(gameId: string): GameState | null {
  return activeGames.get(gameId) || null;
}

/**
 * Set the active game state in memory
 * 
 * Use this to load a game into memory (e.g., on server startup).
 * For mutations during gameplay, use executeGameAction instead.
 * 
 * @param gameId - The game ID
 * @param state - The game state to store
 */
export function setActiveGameState(gameId: string, state: GameState): void {
  const callStack = new Error().stack?.split('\n').slice(2, 5).join(' | ') || 'unknown';
  console.log(`[STATE:setActiveGameState] WARNING: Direct state mutation! gameId=${gameId} phase=${state.phase} version=${state.version} stack=${callStack}`);
  activeGames.set(gameId, state);
}

/**
 * Save game state to database (async backup)
 *
 * This is called automatically by executeGameAction.
 * Database is a backup; in-memory state is the source of truth.
 *
 * Also updates the Game record status to COMPLETED when game ends.
 *
 * @param gameId - The game ID
 * @param state - The game state to persist
 */
export async function saveGameState(gameId: string, state: GameState): Promise<void> {
  try {
    await prisma.gameState.upsert({
      where: { gameId },
      update: {
        state: state as any, // Prisma will serialize to JSON
      },
      create: {
        gameId,
        state: state as any,
      },
    });

    // Update Game status to COMPLETED when game reaches GAME_OVER phase
    if (state.phase === 'GAME_OVER' && state.gameOver) {
      await prisma.game.update({
        where: { id: gameId },
        data: { status: 'COMPLETED' },
      });
      console.log(`[saveGameState] Updated game ${gameId} status to COMPLETED`);
    }
  } catch (error) {
    console.error(`Error saving game state for ${gameId}:`, error);
    throw error;
  }
}

/**
 * Load game state from database
 * 
 * Used on server startup to restore active games into memory.
 * 
 * @param gameId - The game ID
 * @returns Game state from database, or null if not found
 */
export async function loadGameState(gameId: string): Promise<GameState | null> {
  try {
    const gameState = await prisma.gameState.findUnique({
      where: { gameId },
    });

    if (!gameState) {
      return null;
    }

    return gameState.state as unknown as GameState;
  } catch (error) {
    console.error(`Error loading game state for ${gameId}:`, error);
    return null;
  }
}

/**
 * Delete game state from memory
 * 
 * Use this when a game ends or is abandoned.
 * Note: This does not delete from database.
 * 
 * @param gameId - The game ID
 */
export function deleteGameState(gameId: string): void {
  activeGames.delete(gameId);
}

/**
 * Clean up game state from memory and queues
 * 
 * Use this when a game is completely finished.
 * Removes from both active games map and action queues.
 * 
 * @param gameId - The game ID
 */
export function cleanupGameState(gameId: string): void {
  activeGames.delete(gameId);
  gameActionQueues.delete(gameId);
}

/**
 * Get all active game IDs
 * 
 * Useful for monitoring and debugging.
 * 
 * @returns Array of game IDs currently in memory
 */
export function getActiveGameIds(): string[] {
  return Array.from(activeGames.keys());
}

/**
 * Get count of active games
 * 
 * @returns Number of games currently in memory
 */
export function getActiveGameCount(): number {
  return activeGames.size;
}

/**
 * Load all in-progress games from database into memory
 * 
 * Should be called on server startup to restore state after a restart.
 * Only loads games that are IN_PROGRESS (not WAITING or COMPLETED).
 * 
 * @returns Number of games loaded into memory
 */
export async function loadActiveGamesFromDatabase(): Promise<number> {
  try {
    console.log('📥 Loading active games from database...');

    const games = await prisma.game.findMany({
      where: {
        status: 'IN_PROGRESS',
      },
      include: {
        gameState: true,
      },
    });

    let loadedCount = 0;

    for (const game of games) {
      if (game.gameState) {
        const state = game.gameState.state as unknown as GameState;
        setActiveGameState(game.id, state);
        loadedCount++;
      }
    }

    console.log(`✅ Loaded ${loadedCount} active game(s) into memory`);
    return loadedCount;
  } catch (error) {
    console.error('❌ Failed to load active games from database:', error);
    return 0;
  }
}

/**
 * Persist all active games to database
 * 
 * Can be called periodically or during graceful shutdown
 * to ensure all in-memory state is backed up.
 * 
 * @returns Number of games persisted
 */
export async function persistAllActiveGames(): Promise<number> {
  const gameIds = getActiveGameIds();
  let persistedCount = 0;

  for (const gameId of gameIds) {
    try {
      const state = getActiveGameState(gameId);
      if (state) {
        await saveGameState(gameId, state);
        persistedCount++;
      }
    } catch (error) {
      console.error(`Failed to persist game ${gameId}:`, error);
    }
  }

  return persistedCount;
}
