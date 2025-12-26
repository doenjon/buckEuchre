import { prisma } from '../db/client.js';
import { Game, GameStatus, GamePlayer } from '@prisma/client';
import { GameState, Player } from '@buck-euchre/shared';
import { initializeGame, dealNewRound } from '../game/state.js';
import { executeGameActionWithInit, getActiveGameState, loadGameState, setActiveGameState } from './state.service.js';

// Lightweight in-memory cache to reduce DB load when many clients poll the lobby.
// Short TTL keeps the list fresh while preventing stampedes during overload.
let availableGamesCache: { at: number; data: GameSummary[] } | null = null;
let availableGamesInFlight: Promise<GameSummary[]> | null = null;
const AVAILABLE_GAMES_CACHE_TTL_MS = 1000;

/**
 * Game summary for listing available games
 */
export interface GameSummary {
  gameId: string;
  createdAt: number;
  playerCount: number;
  maxPlayers: 4;
  status: GameStatus;
  creatorId: string;
  creatorName: string;
}

/**
 * Game with players included
 */
export interface GameWithPlayers extends Game {
  players: GamePlayer[];
}

/**
 * Create a new game
 * 
 * Creates a game record and adds the creator as the first player (position 0).
 * 
 * @param creatorId - ID of the player creating the game
 * @returns Created game with creator as first player
 */
export async function createGame(creatorId: string): Promise<GameWithPlayers> {
  if (!creatorId) {
    throw new Error('Creator ID is required');
  }

  // Verify creator exists and is valid
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
  });

  if (!creator) {
    throw new Error('Creator user not found');
  }

  // Check if creator is already in another active game
  const existingGame = await prisma.gamePlayer.findFirst({
    where: {
      userId: creatorId,
      game: {
        status: {
          in: [GameStatus.WAITING, GameStatus.IN_PROGRESS],
        },
      },
    },
  });

  if (existingGame) {
    throw new Error('User is already in an active game');
  }

  // Create game and add creator as first player
  const game = await prisma.game.create({
    data: {
      creatorId,
      status: GameStatus.WAITING,
      players: {
        create: {
          userId: creatorId,
          position: 0,
        },
      },
    },
    include: {
      players: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              isGuest: true,
            },
          },
        },
      },
    },
  });

  console.log(`[createGame] Game ${game.id} created with creatorId: ${creatorId}`);
  console.log(`[createGame] Players in game:`, game.players.map(p => ({ userId: p.userId, position: p.position })));

  // Invalidate lobby cache so the game shows up immediately.
  availableGamesCache = null;
  return game;
}

/**
 * Create a rematch game with the same 4 players from a completed game
 * 
 * Creates a new game and adds all 4 players from the previous game.
 * 
 * @param oldGameId - ID of the completed game
 * @param requestingUserId - ID of the user requesting the rematch (must be in the old game)
 * @returns Created game with all 4 players
 */
export async function createRematchGame(oldGameId: string, requestingUserId: string): Promise<GameWithPlayers> {
  if (!oldGameId || !requestingUserId) {
    throw new Error('Game ID and user ID are required');
  }

  // Get the old game with all players
  const oldGame = await prisma.game.findUnique({
    where: { id: oldGameId },
    include: {
      players: {
        orderBy: { position: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              isGuest: true,
            },
          },
        },
      },
    },
  });

  if (!oldGame) {
    throw new Error('Original game not found');
  }

  // Verify requesting user was in the old game
  const requestingUserInGame = oldGame.players.some(p => p.userId === requestingUserId);
  if (!requestingUserInGame) {
    throw new Error('You were not in the original game');
  }

  // Verify we have exactly 4 players
  if (oldGame.players.length !== 4) {
    throw new Error('Original game must have exactly 4 players');
  }

  // Get all player IDs in order
  const playerIds = oldGame.players.map(p => p.userId);

  // Check if any player is already in an active game
  for (const playerId of playerIds) {
    const existingGame = await prisma.gamePlayer.findFirst({
      where: {
        userId: playerId,
        game: {
          status: {
            in: [GameStatus.WAITING, GameStatus.IN_PROGRESS],
          },
        },
      },
    });

    if (existingGame) {
      throw new Error(`Player ${playerId} is already in an active game`);
    }
  }

  // Create new game with the first player as creator
  const firstPlayerId = playerIds[0];
  if (!firstPlayerId) {
    throw new Error('Cannot create rematch: no players found');
  }

  const newGame = await prisma.game.create({
    data: {
      creatorId: firstPlayerId,
      status: GameStatus.WAITING,
      players: {
        create: playerIds.map((playerId, index) => ({
          userId: playerId,
          position: index as 0 | 1 | 2 | 3,
        })),
      },
    },
    include: {
      players: {
        orderBy: { position: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              isGuest: true,
            },
          },
        },
      },
    },
  });

  console.log(`[createRematchGame] Rematch game ${newGame.id} created from game ${oldGameId}`);
  console.log(`[createRematchGame] Players in rematch:`, newGame.players.map((p: any) => ({ userId: p.userId, position: p.position })));

  return newGame as GameWithPlayers;
}

/**
 * Join an existing game
 * 
 * Adds a player to a game in the next available position.
 * If the game becomes full (4 players), initializes the game state.
 * 
 * @param gameId - ID of the game to join
 * @param playerId - ID of the player joining
 * @returns Current game state after joining (only if game is full)
 */
export async function joinGame(gameId: string, playerId: string): Promise<GameState | null> {
  if (!gameId || !playerId) {
    throw new Error('Game ID and Player ID are required');
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: playerId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // First, check if user is already in THIS game (reconnection case)
  // Use a single query with include to get both the GamePlayer and Game in one go
  const inThisGame = await prisma.gamePlayer.findFirst({
    where: {
      userId: playerId,
      gameId: gameId,
    },
    include: {
      game: {
        include: {
          players: {
            orderBy: { position: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  isGuest: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (inThisGame && inThisGame.game) {
    // User is already in this game - handle reconnection
    const game = inThisGame.game;

    // Check if game state exists in memory
    let gameState = getActiveGameState(gameId);
    if (gameState) {
      return gameState;
    }

    // Check if game state exists in database
    const dbGameState = await loadGameState(gameId);
    if (dbGameState) {
      setActiveGameState(gameId, dbGameState);
      return dbGameState;
    }

    // No state yet - check if we should start the game
    if (game.players.length === 4 && game.status === GameStatus.WAITING) {
      // All 4 players present! Initialize game (atomic init + queue)
      const playerIds = game.players.map((gp) => gp.user!.id) as [string, string, string, string];
      const startedState = await executeGameActionWithInit(
        gameId,
        () => {
          let initialState = initializeGame(playerIds);
          // CRITICAL: Set the gameId on the state object
          initialState.gameId = gameId;

          // Update player names from database
          initialState.players = initialState.players.map((p: Player, index: number) => {
            const gamePlayer = game.players[index];
            const displayName = gamePlayer.user?.displayName || gamePlayer.guestName || `Player ${index + 1}`;
            return {
              ...p,
              name: displayName,
            };
          }) as [Player, Player, Player, Player];

          return initialState;
        },
        (currentState) => {
          // If already dealt by another concurrent starter, don't deal again.
          if (currentState.phase !== 'DEALING') {
            return currentState;
          }
          return dealNewRound(currentState);
        }
      );

      // Update game status to IN_PROGRESS (idempotent; safe if called multiple times)
      // Use fire-and-forget with retry to avoid blocking on connection pool exhaustion
      setImmediate(async () => {
        let retries = 3;
        while (retries > 0) {
          try {
      await prisma.game.update({
        where: { id: gameId },
        data: { status: GameStatus.IN_PROGRESS },
      });
            break; // Success
          } catch (error: any) {
            retries--;
            if (retries === 0 || error.code !== 'P2024') {
              // P2024 = connection pool timeout, retry; other errors log and fail
              console.error(`[JOIN_GAME] Failed to update game status for ${gameId} after retries:`, error.message);
              break;
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
          }
        }
      });

      return startedState;
    }

    // Game exists but no state yet (still in WAITING, not enough players)
    return null;
  }

  // Check if user is already in another active game (different from this one)
  // Use a more efficient query that filters by status at the database level
  const existingGame = await prisma.gamePlayer.findFirst({
    where: {
      userId: playerId,
      gameId: { not: gameId }, // Exclude this game
      game: {
        status: {
          in: [GameStatus.WAITING, GameStatus.IN_PROGRESS],
        },
      },
    },
  });

  if (existingGame) {
    // User is in a DIFFERENT game - this is an error
    console.log(`[joinGame] User ${playerId} is already in different game ${existingGame.gameId}, cannot join ${gameId}`);
    throw new Error('User is already in a different active game');
  }

  // Get game with current players
  let game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!game) {
    throw new Error('Game not found');
  }

  if (game.status !== GameStatus.WAITING) {
    throw new Error('Game is not accepting new players');
  }

  if (game.players.length >= 4) {
    throw new Error('Game is full');
  }

  // Check if user is already in THIS game (double-check to prevent duplicates)
  const alreadyInGame = game.players.some(p => p.userId === playerId);
  if (alreadyInGame) {
    return null;
  }

  // Find next available position and add player (with retry for race conditions)
  let attempts = 0;
  const maxAttempts = 5;
  let playerAdded = false;

  while (!playerAdded && attempts < maxAttempts) {
    try {
      // Get fresh player list to avoid race conditions
      const freshGame = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          players: {
            orderBy: { position: 'asc' },
          },
        },
      });

      if (!freshGame) {
        throw new Error('Game not found');
      }

      // Check if user is already in game (double-check in retry loop to prevent race conditions)
      const userAlreadyInGame = freshGame.players.some(p => p.userId === playerId);
      if (userAlreadyInGame) {
        console.log(`[joinGame] User ${playerId} already in game ${gameId} (detected in retry loop)`);
        playerAdded = true; // Consider it "added" since they're already there
        game = freshGame;
        break;
      }

      // Find next available position
      const takenPositions = freshGame.players.map((p) => p.position);
      let nextPosition = 0;
      while (takenPositions.includes(nextPosition) && nextPosition < 4) {
        nextPosition++;
      }

      if (nextPosition >= 4) {
        throw new Error('Game is full');
      }

      // Try to add user (may fail if another user took this position or user already in game)
      await prisma.gamePlayer.create({
        data: {
          gameId,
          userId: playerId,
          position: nextPosition,
        },
      });

      playerAdded = true;
      game = freshGame; // Update game reference for later use
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - could be position or userId
        // Check if it's because user is already in game
        const checkGame = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            players: {
              where: { userId: playerId },
            },
          },
        });
        
        if (checkGame && checkGame.players.length > 0) {
          // User is already in game - this is fine, treat as success
          console.log(`[joinGame] User ${playerId} already in game ${gameId} (unique constraint violation)`);
          playerAdded = true;
          game = checkGame;
          break; // Exit the while loop
        }
        
        // It's a position conflict - retry after a short delay
        if (attempts < maxAttempts - 1) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 50 * attempts)); // Exponential backoff
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  if (!playerAdded) {
    throw new Error('Failed to join game after multiple attempts (race condition)');
  }

  // Player count changed; invalidate lobby cache so lists refresh quickly.
  availableGamesCache = null;

  // Query fresh to check if game is now full (4 players)
  // This prevents race condition where multiple players join simultaneously
  const finalGame = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { position: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              isGuest: true,
            },
          },
        },
      },
    },
  });

  if (!finalGame) {
    throw new Error('Failed to retrieve updated game');
  }

  // If game is now full (4 players), initialize game state
  if (finalGame.players.length === 4) {
    // Use finalGame which we just queried, guaranteed to have all 4 players
    const updatedGame = finalGame;

    if (updatedGame.players.length !== 4) {
      throw new Error('Game does not have exactly 4 players');
    }

    // Get user IDs as a tuple
    const playerIds = updatedGame.players.map((gp) => gp.user!.id) as [string, string, string, string];

    // Initialize game state using pure function from game/state.ts
    const startedState = await executeGameActionWithInit(
      gameId,
      () => {
    let initialState = initializeGame(playerIds);
    
    // CRITICAL: Set the gameId on the state object
    initialState.gameId = gameId;
    
    // Update player names from database
    initialState.players = initialState.players.map((p: Player, index: number) => {
      const gamePlayer = updatedGame.players[index];
      const displayName = gamePlayer.user?.displayName || gamePlayer.guestName || `Player ${index + 1}`;
      
      return {
        ...p,
        name: displayName,
      };
    }) as [Player, Player, Player, Player];

        return initialState;
      },
      (currentState) => {
        if (currentState.phase !== 'DEALING') {
          return currentState;
        }
        return dealNewRound(currentState);
      }
    );

    // Update game status to IN_PROGRESS (fire-and-forget with retry to avoid blocking)
    setImmediate(async () => {
      let retries = 3;
      while (retries > 0) {
        try {
    await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.IN_PROGRESS },
    });
          break; // Success
        } catch (error: any) {
          retries--;
          if (retries === 0 || error.code !== 'P2024') {
            // P2024 = connection pool timeout, retry; other errors log and fail
            console.error(`[JOIN_GAME] Failed to update game status for ${gameId} after retries:`, error.message);
            break;
          }
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
        }
      }
    });

    return startedState;
  }

  // Game not full yet, return null (waiting for more players)
  return null;
}

/**
 * Leave a game
 * 
 * Removes a player from a game. If the game is in progress, marks it as abandoned.
 * 
 * @param gameId - ID of the game
 * @param playerId - ID of the player leaving
 */
/**
 * Get user's active games
 * 
 * Returns all games where the user is a player and the game is still active.
 * 
 * @param userId - ID of the user
 * @returns Array of game summaries with player info
 */
export async function getUserActiveGames(userId: string): Promise<GameSummary[]> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  console.log(`[getUserActiveGames] Querying games for userId: ${userId}`);
  
  const games = await prisma.game.findMany({
    where: {
      players: {
        some: {
          userId: userId,
        },
      },
      status: {
        in: [GameStatus.WAITING, GameStatus.IN_PROGRESS],
      },
    },
    include: {
      players: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              isGuest: true,
            },
          },
        },
      },
      creator: {
        select: {
          id: true,
          username: true,
          displayName: true,
          isGuest: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`[getUserActiveGames] Found ${games.length} games for userId: ${userId}`);
  games.forEach((game, index) => {
    console.log(`[getUserActiveGames] Game ${index + 1}:`, {
      gameId: game.id,
      status: game.status,
      playerCount: game.players.length,
      playerUserIds: game.players.map(p => p.userId),
    });
  });

  return games.map((game) => ({
    gameId: game.id,
    createdAt: game.createdAt.getTime(),
    playerCount: game.players.length,
    maxPlayers: 4 as const,
    status: game.status,
    creatorId: game.creator.id,
    creatorName: game.creator.displayName,
  }));
}

export async function leaveGame(gameId: string, userId: string): Promise<void> {
  if (!gameId || !userId) {
    throw new Error('Game ID and User ID are required');
  }

  console.log(`[leaveGame] Attempting to leave game ${gameId} for userId: ${userId}`);

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
    },
  });

  if (!game) {
    console.log(`[leaveGame] Game ${gameId} not found`);
    throw new Error('Game not found');
  }

  console.log(`[leaveGame] Game found: ${game.id}, status: ${game.status}, players: ${game.players.map(p => p.userId).join(', ')}`);

  const gamePlayer = game.players.find((gp) => gp.userId === userId);

  if (!gamePlayer) {
    console.log(`[leaveGame] User ${userId} not found in game ${gameId}. Players in game: ${game.players.map(p => p.userId).join(', ')}`);
    throw new Error('User is not in this game');
  }

  console.log(`[leaveGame] Found gamePlayer ${gamePlayer.id} for userId ${userId}`);

  // Remove player from game
  // Handle race condition: player might already be deleted
  try {
    await prisma.gamePlayer.delete({
      where: { id: gamePlayer.id },
    });
    console.log(`[leaveGame] Successfully removed player ${userId} from game ${gameId}`);
  } catch (error: any) {
    // P2025 = Record not found (already deleted in concurrent request)
    if (error.code === 'P2025') {
      // Player already left - this is fine, continue cleanup
      console.log(`[leaveGame] Player ${userId} already removed from game ${gameId} (race condition)`);
    } else {
      console.error(`[leaveGame] Error deleting gamePlayer:`, error);
      throw error; // Re-throw if it's a different error
    }
  }

  // If game was in progress, mark as abandoned
  if (game.status === GameStatus.IN_PROGRESS) {
    await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.ABANDONED },
    });
  }

  // If game is now empty, we could delete it (or leave for cleanup later)
  const remainingPlayers = game.players.filter((gp) => gp.id !== gamePlayer.id);
  if (remainingPlayers.length === 0) {
    await prisma.game.delete({
      where: { id: gameId },
    });
  }

  // Invalidate lobby cache (player count / game existence may have changed).
  availableGamesCache = null;
}

/**
 * List available games
 * 
 * Returns games that are waiting for players (not full).
 * 
 * @returns Array of game summaries
 */
export async function listAvailableGames(): Promise<GameSummary[]> {
  const now = Date.now();
  if (availableGamesCache && now - availableGamesCache.at < AVAILABLE_GAMES_CACHE_TTL_MS) {
    return availableGamesCache.data;
  }

  if (availableGamesInFlight) {
    return availableGamesInFlight;
  }

  availableGamesInFlight = (async () => {
    const games = await prisma.game.findMany({
      where: {
        status: GameStatus.WAITING,
      },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                isGuest: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            isGuest: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result = games
      .filter((game) => game.players.length < 4)
      .map((game) => ({
        gameId: game.id,
        createdAt: game.createdAt.getTime(),
        playerCount: game.players.length,
        maxPlayers: 4 as const,
        status: game.status,
        creatorId: game.creator.id,
        creatorName: game.creator.displayName,
      }));

    availableGamesCache = { at: Date.now(), data: result };
    return result;
  })();

  try {
    return await availableGamesInFlight!;
  } finally {
    availableGamesInFlight = null;
  }
}

/**
 * Get game state from database
 * 
 * Note: In Phase 3, this retrieves from the database.
 * In Phase 4, the state service will manage in-memory state as the source of truth.
 * 
 * @param gameId - ID of the game
 * @returns Game state if found, null otherwise
 */
export async function getGameState(gameId: string): Promise<GameState | null> {
  if (!gameId) {
    return null;
  }

  const gameState = await prisma.gameState.findUnique({
    where: { gameId },
  });

  if (!gameState) {
    return null;
  }

  return gameState.state as unknown as GameState;
}

/**
 * Get game by ID with players
 * 
 * @param gameId - ID of the game
 * @returns Game with players, or null if not found
 */
export async function getGame(gameId: string): Promise<GameWithPlayers | null> {
  if (!gameId) {
    return null;
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { position: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              isGuest: true,
            },
          },
        },
      },
    },
  });

  return game;
}
