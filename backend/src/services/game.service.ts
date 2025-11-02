import { prisma } from '../db/client';
import { Game, GameStatus, GamePlayer } from '@prisma/client';
import { GameState, Player } from '@buck-euchre/shared';
import { initializeGame, dealNewRound } from '../game/state';
import { setActiveGameState, getActiveGameState, loadGameState } from './state.service';

/**
 * Game summary for listing available games
 */
export interface GameSummary {
  gameId: string;
  createdAt: number;
  playerCount: number;
  maxPlayers: 4;
  status: GameStatus;
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

  return game;
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

  // Check if user is already in another active game (different from this one)
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

  if (existingGame && existingGame.gameId !== gameId) {
    throw new Error('User is already in a different active game');
  }
  
  // If user is already in THIS game, check if game has started
  if (existingGame && existingGame.gameId === gameId) {
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
    
    if (!game) {
      throw new Error('Game not found');
    }
    
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
      // All 4 players present! Initialize game
      const playerIds = game.players.map((gp) => gp.user!.id) as [string, string, string, string];
      let initialState = initializeGame(playerIds);
      
      // CRITICAL: Set the gameId on the state object
      initialState.gameId = gameId;
      
      // Deal the first round (moves from DEALING → BIDDING and deals cards)
      initialState = dealNewRound(initialState);
      
      // Store in memory
      setActiveGameState(gameId, initialState);
      
      // Update game status to IN_PROGRESS
      await prisma.game.update({
        where: { id: gameId },
        data: { status: GameStatus.IN_PROGRESS },
      });
      
      console.log(`[joinGame] Game ${gameId} started with 4 players!`);
      return initialState;
    }
    
    // Game exists but no state yet (still in WAITING, not enough players)
    return null;
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

      // Find next available position
      const takenPositions = freshGame.players.map((p) => p.position);
      let nextPosition = 0;
      while (takenPositions.includes(nextPosition) && nextPosition < 4) {
        nextPosition++;
      }

      if (nextPosition >= 4) {
        throw new Error('Game is full');
      }

      // Try to add user (may fail if another user took this position)
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
      if (error.code === 'P2002' && attempts < maxAttempts - 1) {
        // Unique constraint violation - another player took this position
        // Retry after a short delay
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 50 * attempts)); // Exponential backoff
      } else {
        throw error;
      }
    }
  }

  if (!playerAdded) {
    throw new Error('Failed to join game after multiple attempts (race condition)');
  }

  // If game is now full (4 players), initialize game state
  if (game.players.length + 1 === 4) {
    // Get all user IDs in position order
    const updatedGame = await prisma.game.findUnique({
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

    if (!updatedGame) {
      throw new Error('Failed to retrieve updated game');
    }

    if (updatedGame.players.length !== 4) {
      throw new Error('Game does not have exactly 4 players');
    }

    // Get user IDs as a tuple
    const playerIds = updatedGame.players.map((gp) => gp.user!.id) as [string, string, string, string];

    // Initialize game state using pure function from game/state.ts
    let initialState = initializeGame(playerIds);
    
    // CRITICAL: Set the gameId on the state object
    initialState.gameId = gameId;
    
    // Update player names from database
    initialState.players = initialState.players.map((p, index) => {
      const gamePlayer = updatedGame.players[index];
      const displayName = gamePlayer.user?.displayName || gamePlayer.guestName || `Player ${index + 1}`;
      
      console.log(`[joinGame] Setting player ${index} name: ${displayName} (user: ${gamePlayer.user?.id}, username: ${gamePlayer.user?.username})`);
      
      return {
        ...p,
        name: displayName,
        foldDecision: p.foldDecision, // Ensure foldDecision is preserved
      };
    }) as [Player, Player, Player, Player];

    // Store initial state in memory (DEALING phase)
    // Socket handler will deal cards and transition to BIDDING
    setActiveGameState(gameId, initialState);

    // Update game status to IN_PROGRESS
    await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.IN_PROGRESS },
    });

    console.log(`[joinGame] Game ${gameId} started! 4 players joined.`);
    // Return initial state in DEALING phase - socket handler will deal and transition
    return initialState;
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

  return games.map((game) => ({
    gameId: game.id,
    createdAt: game.createdAt.getTime(),
    playerCount: game.players.length,
    maxPlayers: 4,
    status: game.status,
    creatorName: game.creator.displayName,
  }));
}

export async function leaveGame(gameId: string, userId: string): Promise<void> {
  if (!gameId || !userId) {
    throw new Error('Game ID and User ID are required');
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
    },
  });

  if (!game) {
    throw new Error('Game not found');
  }

  const gamePlayer = game.players.find((gp) => gp.userId === userId);

  if (!gamePlayer) {
    throw new Error('User is not in this game');
  }

  // Remove player from game
  // Handle race condition: player might already be deleted
  try {
    await prisma.gamePlayer.delete({
      where: { id: gamePlayer.id },
    });
  } catch (error: any) {
    // P2025 = Record not found (already deleted in concurrent request)
    if (error.code !== 'P2025') {
      throw error; // Re-throw if it's a different error
    }
    // Otherwise, player already left - this is fine, continue cleanup
    console.log(`[leaveGame] Player ${userId} already removed from game ${gameId}`);
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
}

/**
 * List available games
 * 
 * Returns games that are waiting for players (not full).
 * 
 * @returns Array of game summaries
 */
export async function listAvailableGames(): Promise<GameSummary[]> {
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

  return games
    .filter((game) => game.players.length < 4)
    .map((game) => ({
      gameId: game.id,
      createdAt: game.createdAt.getTime(),
      playerCount: game.players.length,
      maxPlayers: 4,
      status: game.status,
      creatorName: game.creator.displayName,
    }));
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
