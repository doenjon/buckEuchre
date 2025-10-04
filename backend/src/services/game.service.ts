import { prisma } from '../db/client';
import { Game, GameStatus, GamePlayer } from '@prisma/client';
import { GameState } from '@buck-euchre/shared';
import { initializeGame } from '../game/state';
import { setActiveGameState, getActiveGameState, loadGameState } from './state.service';

/**
 * Game summary for listing available games
 */
export interface GameSummary {
  id: string;
  createdAt: Date;
  playerCount: number;
  maxPlayers: number;
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
  const creator = await prisma.player.findUnique({
    where: { id: creatorId },
  });

  if (!creator) {
    throw new Error('Creator player not found');
  }

  // Check if creator is already in another active game
  const existingGame = await prisma.gamePlayer.findFirst({
    where: {
      playerId: creatorId,
      game: {
        status: {
          in: [GameStatus.WAITING, GameStatus.IN_PROGRESS],
        },
      },
    },
  });

  if (existingGame) {
    throw new Error('Player is already in an active game');
  }

  // Create game and add creator as first player
  const game = await prisma.game.create({
    data: {
      creatorId,
      status: GameStatus.WAITING,
      players: {
        create: {
          playerId: creatorId,
          position: 0,
        },
      },
    },
    include: {
      players: true,
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

  // Verify player exists
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Check if player is already in another active game (different from this one)
  const existingGame = await prisma.gamePlayer.findFirst({
    where: {
      playerId,
      game: {
        status: {
          in: [GameStatus.WAITING, GameStatus.IN_PROGRESS],
        },
      },
    },
  });

  if (existingGame && existingGame.gameId !== gameId) {
    throw new Error('Player is already in a different active game');
  }
  
  // If player is already in THIS game, check if game has started
  if (existingGame && existingGame.gameId === gameId) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { position: 'asc' },
          include: { player: true },
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
      const playerIds = game.players.map((gp) => gp.player.id) as [string, string, string, string];
      const initialState = initializeGame(playerIds);
      
      // CRITICAL: Set the gameId on the state object
      initialState.gameId = gameId;
      
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
  const game = await prisma.game.findUnique({
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

  // Find next available position
  const takenPositions = game.players.map((p) => p.position);
  let nextPosition = 0;
  while (takenPositions.includes(nextPosition)) {
    nextPosition++;
  }

  // Add player to game
  await prisma.gamePlayer.create({
    data: {
      gameId,
      playerId,
      position: nextPosition,
    },
  });

  // If game is now full (4 players), initialize game state
  if (game.players.length + 1 === 4) {
    // Get all player IDs in position order
    const updatedGame = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { position: 'asc' },
          include: { player: true },
        },
      },
    });

    if (!updatedGame) {
      throw new Error('Failed to retrieve updated game');
    }

    if (updatedGame.players.length !== 4) {
      throw new Error('Game does not have exactly 4 players');
    }

    // Get player IDs as a tuple
    const playerIds = updatedGame.players.map((gp) => gp.player.id) as [string, string, string, string];

    // Initialize game state using pure function from game/state.ts
    const initialState = initializeGame(playerIds);
    
    // CRITICAL: Set the gameId on the state object
    initialState.gameId = gameId;

    // Update game status to IN_PROGRESS
    await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.IN_PROGRESS },
    });

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
export async function leaveGame(gameId: string, playerId: string): Promise<void> {
  if (!gameId || !playerId) {
    throw new Error('Game ID and Player ID are required');
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

  const gamePlayer = game.players.find((gp) => gp.playerId === playerId);

  if (!gamePlayer) {
    throw new Error('Player is not in this game');
  }

  // Remove player from game
  await prisma.gamePlayer.delete({
    where: { id: gamePlayer.id },
  });

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
          player: true,
        },
      },
      creator: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return games
    .filter((game) => game.players.length < 4)
    .map((game) => ({
      id: game.id,
      createdAt: game.createdAt,
      playerCount: game.players.length,
      maxPlayers: 4,
      status: game.status,
      creatorName: game.creator.name,
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
      },
    },
  });

  return game;
}
