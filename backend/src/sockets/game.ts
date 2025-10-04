/**
 * @module sockets/game
 * @description WebSocket event handlers for game actions
 * 
 * All handlers follow the same pattern:
 * 1. Validate payload (Zod)
 * 2. Execute action through queue (prevents race conditions)
 * 3. Validate action against current state
 * 4. Apply state transition (pure function)
 * 5. Broadcast update to room
 */

import { Server, Socket } from 'socket.io';
import {
  JoinGameSchema,
  LeaveGameSchema,
  PlaceBidSchema,
  DeclareTrumpSchema,
  FoldDecisionSchema,
  PlayCardSchema,
  StartNextRoundSchema
} from '../../../shared/src/validators/game';
import { executeGameAction, getActiveGameState } from '../services/state.service';
import { joinGame, leaveGame, getGame } from '../services/game.service';
import { 
  applyBid,
  applyTrumpDeclaration,
  applyFoldDecision,
  applyCardPlay,
  dealNewRound,
  finishRound,
  handleAllPlayersPass
} from '../game/state';
import { canPlayCard, canPlaceBid, canFold } from '../game/validation';
import { GameState, PlayerPosition, Player, Card, BidAmount } from '../../../shared/src/types/game';

/**
 * Register all game event handlers
 */
export function registerGameHandlers(io: Server, socket: Socket): void {
  socket.on('JOIN_GAME', (payload) => handleJoinGame(io, socket, payload));
  socket.on('LEAVE_GAME', (payload) => handleLeaveGame(io, socket, payload));
  socket.on('PLACE_BID', (payload) => handlePlaceBid(io, socket, payload));
  socket.on('DECLARE_TRUMP', (payload) => handleDeclareTrump(io, socket, payload));
  socket.on('FOLD_DECISION', (payload) => handleFoldDecision(io, socket, payload));
  socket.on('PLAY_CARD', (payload) => handlePlayCard(io, socket, payload));
  socket.on('START_NEXT_ROUND', (payload) => handleStartNextRound(io, socket, payload));
}

/**
 * Handle JOIN_GAME event
 */
async function handleJoinGame(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = JoinGameSchema.parse(payload);
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;

    console.log(`[JOIN_GAME] Player ${playerName} attempting to join game ${validated.gameId}`);

    // Add player to game (uses game service)
    const gameState = await joinGame(validated.gameId, playerId);

    // Join socket room regardless of whether game has started
    socket.join(`game:${validated.gameId}`);

    if (!gameState) {
      // Game exists but hasn't started yet (still in WAITING)
      console.log(`[JOIN_GAME] Game ${validated.gameId} is in WAITING status (no state yet)`);
      
      // Get game info from database to show player list
      const game = await getGame(validated.gameId);
      if (!game) {
        socket.emit('ERROR', {
          code: 'GAME_NOT_FOUND',
          message: 'Game not found'
        });
        return;
      }
      
      // Send a simple update to show players waiting
      socket.emit('GAME_WAITING', {
        gameId: validated.gameId,
        playerCount: game.players.length,
        playersNeeded: 4 - game.players.length,
        message: `Waiting for ${4 - game.players.length} more player(s)...`
      });
      
      console.log(`[JOIN_GAME] Player ${playerName} joined. ${game.players.length}/4 players`);
      return;
    }

    // Update player name in game state
    const updatedState = await executeGameAction(validated.gameId, async (currentState) => {
      const players = currentState.players.map((p: Player) => 
        p.id === playerId ? { ...p, name: playerName } : p
      ) as [Player, Player, Player, Player];
      return { ...currentState, players };
    });

    // Broadcast to all players in game
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: updatedState,
      event: 'PLAYER_JOINED'
    });

    console.log(`[JOIN_GAME] Player ${playerName} joined active game ${validated.gameId}`);
  } catch (error: any) {
    console.error('[JOIN_GAME] Error:', error);
    socket.emit('ERROR', {
      code: 'JOIN_GAME_FAILED',
      message: error.message || 'Failed to join game'
    });
  }
}

/**
 * Handle LEAVE_GAME event
 */
async function handleLeaveGame(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = LeaveGameSchema.parse(payload);
    const playerId = socket.data.playerId;

    // Remove player from game
    await leaveGame(validated.gameId, playerId);

    // Leave socket room
    socket.leave(`game:${validated.gameId}`);

    // Notify other players
    io.to(`game:${validated.gameId}`).emit('PLAYER_DISCONNECTED', {
      playerId
    });

    console.log(`Player ${socket.data.playerName} left game ${validated.gameId}`);
  } catch (error: any) {
    console.error('Error in LEAVE_GAME:', error);
    socket.emit('ERROR', {
      code: 'LEAVE_GAME_FAILED',
      message: error.message || 'Failed to leave game'
    });
  }
}

/**
 * Handle PLACE_BID event
 */
async function handlePlaceBid(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = PlaceBidSchema.parse(payload);
    const playerId = socket.data.playerId;

    // Execute action through queue
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === playerId);
      if (!player) {
        throw new Error('Player not in game');
      }

      // Validate it's player's turn to bid
      if (currentState.currentBidder !== player.position) {
        throw new Error('Not your turn to bid');
      }

      // Validate phase
      if (currentState.phase !== 'BIDDING') {
        throw new Error('Not in bidding phase');
      }

      // Validate bid amount
      const validation = canPlaceBid(
        validated.amount,
        currentState.highestBid,
        currentState.bids.some((b: any) => b.playerPosition === player.position && b.amount === 'PASS'),
        currentState.bids.filter((b: any) => b.amount === 'PASS').length === 3
      );

      if (!validation.valid) {
        throw new Error(validation.reason || 'Invalid bid');
      }

      // Apply bid
      let nextState = applyBid(currentState, player.position, validated.amount);

      // Check if all players passed
      if (nextState.phase === 'BIDDING' && 
          nextState.bids.filter((b: { amount: BidAmount }) => b.amount === 'PASS').length === 4) {
        // All players passed - redeal
        nextState = handleAllPlayersPass(nextState);
        nextState = dealNewRound(nextState);
      }

      return nextState;
    });

    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'BID_PLACED'
    });
  } catch (error: any) {
    console.error('Error in PLACE_BID:', error);
    socket.emit('ERROR', {
      code: 'BID_FAILED',
      message: error.message || 'Failed to place bid'
    });
  }
}

/**
 * Handle DECLARE_TRUMP event
 */
async function handleDeclareTrump(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = DeclareTrumpSchema.parse(payload);
    const playerId = socket.data.playerId;

    // Execute action through queue
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === playerId);
      if (!player) {
        throw new Error('Player not in game');
      }

      // Validate phase
      if (currentState.phase !== 'DECLARING_TRUMP') {
        throw new Error('Not in trump declaration phase');
      }

      // Validate player is winning bidder
      if (currentState.winningBidderPosition !== player.position) {
        throw new Error('Only winning bidder can declare trump');
      }

      // Apply trump declaration and transition to folding phase
      return applyTrumpDeclaration(currentState, validated.trumpSuit);
    });

    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'TRUMP_DECLARED'
    });
  } catch (error: any) {
    console.error('Error in DECLARE_TRUMP:', error);
    socket.emit('ERROR', {
      code: 'DECLARE_TRUMP_FAILED',
      message: error.message || 'Failed to declare trump'
    });
  }
}

/**
 * Handle FOLD_DECISION event
 */
async function handleFoldDecision(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = FoldDecisionSchema.parse(payload);
    const playerId = socket.data.playerId;

    // Execute action through queue
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === playerId);
      if (!player) {
        throw new Error('Player not in game');
      }

      // Validate phase
      if (currentState.phase !== 'FOLDING_DECISION') {
        throw new Error('Not in folding decision phase');
      }

      // Validate player can fold
      const validation = canFold(
        currentState.isClubsTurnUp,
        player.position === currentState.winningBidderPosition
      );

      if (!validation.valid) {
        throw new Error(validation.reason || 'Cannot fold');
      }

      // Apply fold decision
      return applyFoldDecision(currentState, player.position, validated.folded);
    });

    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'FOLD_DECISION_MADE'
    });
  } catch (error: any) {
    console.error('Error in FOLD_DECISION:', error);
    socket.emit('ERROR', {
      code: 'FOLD_DECISION_FAILED',
      message: error.message || 'Failed to make fold decision'
    });
  }
}

/**
 * Handle PLAY_CARD event
 */
async function handlePlayCard(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = PlayCardSchema.parse(payload);
    const playerId = socket.data.playerId;

    // Execute action through queue
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === playerId);
      if (!player) {
        throw new Error('Player not in game');
      }

      // Validate phase
      if (currentState.phase !== 'PLAYING') {
        throw new Error('Not in playing phase');
      }

      // Validate it's player's turn
      if (currentState.currentPlayerPosition !== player.position) {
        throw new Error('Not your turn');
      }

      // Find card in hand
      const card = player.hand.find((c: Card) => c.id === validated.cardId);
      if (!card) {
        throw new Error('Card not in hand');
      }

      // Validate card play
      const validation = canPlayCard(
        card,
        player.hand,
        currentState.currentTrick,
        currentState.trumpSuit!,
        player.folded
      );

      if (!validation.valid) {
        throw new Error(validation.reason || 'Invalid card play');
      }

      // Apply card play
      let nextState = applyCardPlay(currentState, player.position, validated.cardId);

      // Check if trick is complete (4 cards played by non-folded players)
      const activePlayers = nextState.players.filter((p: Player) => !p.folded);
      const cardsInTrick = nextState.currentTrick.cards.length;
      
      if (cardsInTrick === activePlayers.length) {
        // Emit trick complete event for animation
        io.to(`game:${validated.gameId}`).emit('TRICK_COMPLETE', {
          trick: nextState.currentTrick,
          delayMs: 2000
        });

        // Check if round is complete (5 tricks played)
        if (nextState.tricks.length === 5) {
          // Finish round and calculate scores
          nextState = finishRound(nextState);

          // Emit round complete event
          io.to(`game:${validated.gameId}`).emit('ROUND_COMPLETE', {
            roundNumber: nextState.round
          });
        }
      }

      return nextState;
    });

    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'CARD_PLAYED'
    });
  } catch (error: any) {
    console.error('Error in PLAY_CARD:', error);
    socket.emit('ERROR', {
      code: 'PLAY_CARD_FAILED',
      message: error.message || 'Failed to play card'
    });
  }
}

/**
 * Handle START_NEXT_ROUND event
 */
async function handleStartNextRound(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = StartNextRoundSchema.parse(payload);

    // Execute action through queue
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Validate phase
      if (currentState.phase !== 'ROUND_OVER' && currentState.phase !== 'GAME_OVER') {
        throw new Error('Round is not over');
      }

      // If game is over, don't start new round
      if (currentState.gameOver) {
        throw new Error('Game is over');
      }

      // Deal new round
      return dealNewRound(currentState);
    });

    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'ROUND_STARTED'
    });
  } catch (error: any) {
    console.error('Error in START_NEXT_ROUND:', error);
    socket.emit('ERROR', {
      code: 'START_NEXT_ROUND_FAILED',
      message: error.message || 'Failed to start next round'
    });
  }
}
