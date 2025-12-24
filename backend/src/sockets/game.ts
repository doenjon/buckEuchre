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
  StartNextRoundSchema,
  RequestStateSchema
} from '../../../shared/src/validators/game';
import { executeGameAction, getActiveGameState } from '../services/state.service';
import { joinGame, leaveGame, getGame } from '../services/game.service';
import { updateConnectionGame } from '../services/connection.service';
import { 
  applyBid,
  applyTrumpDeclaration,
  applyFoldDecision,
  applyCardPlay,
  dealNewRound,
  finishRound,
  startNextRound
} from '../game/state';
import { displayStateManager } from '../game/display';
import { statsQueue } from '../services/stats-queue.service';
import { canPlayCard, canPlaceBid, canFold } from '../game/validation';
import { getEffectiveSuit } from '../game/deck';
import { GameState, PlayerPosition, Player, Card } from '../../../shared/src/types/game';
import { checkAndTriggerAI } from '../ai/trigger';
import { scheduleAutoStartNextRound, cancelAutoStartNextRound, hasAutoStartTimer } from '../services/round.service';
import {
  updateRoundStats,
  updateGameStats,
  RoundStatsUpdate,
  GameStatsUpdate,
} from '../services/stats.service';

interface RoundCompletionPayload {
  gameId: string;
  roundUpdates: RoundStatsUpdate[];
  gameUpdates?: GameStatsUpdate[];
}

function countCardsPlayedByPlayer(state: GameState): Map<PlayerPosition, number> {
  const counts = new Map<PlayerPosition, number>();

  for (const trick of state.tricks) {
    for (const played of trick.cards) {
      counts.set(
        played.playerPosition,
        (counts.get(played.playerPosition) || 0) + 1
      );
    }
  }

  return counts;
}

export function buildRoundCompletionPayload(
  gameId: string,
  preScoreState: GameState,
  postScoreState: GameState
): RoundCompletionPayload | null {
  console.log('[STATS BUILD] Called with phases:', {
    gameId,
    prePhase: preScoreState.phase,
    postPhase: postScoreState.phase,
    gameOver: postScoreState.gameOver,
  });

  if (postScoreState.phase !== 'ROUND_OVER' && postScoreState.phase !== 'GAME_OVER') {
    console.log('[STATS BUILD] Returning null - not in ROUND_OVER or GAME_OVER phase');
    return null;
  }

  const scoreChanges = postScoreState.players.map((player, index) =>
    player.score - preScoreState.players[index].score
  );

  const bidderPosition = preScoreState.winningBidderPosition;
  const highestBid = preScoreState.highestBid;
  const isClubsTurnUp = preScoreState.isClubsTurnUp; // Check if this is Dirty Clubs (no actual bidding)
  const cardsPlayedLookup = countCardsPlayedByPlayer(postScoreState);

  const roundUpdates: RoundStatsUpdate[] = postScoreState.players
    .map((player, index) => {
      const userId = player.id;
      if (!userId) {
        console.log(`[STATS BUILD] Player ${index} (${player.name}) has no userId, skipping stats`);
        return null;
      }
      console.log(`[STATS BUILD] Processing stats for player ${index} (${player.name}), userId: ${userId}`);

      const cardsPlayed = cardsPlayedLookup.get(player.position) || 0;
      const autoWinTricks =
        cardsPlayed === 0 && postScoreState.tricks.length === 0 && player.tricksTaken > 0
          ? player.tricksTaken
          : 0;

      // totalTricks represents how many tricks the player participated in (not folded)
      // In Buck Euchre, each player plays one card per trick they participate in
      // If player folded before any tricks were played, totalTricks = 0
      // If all opponents folded and bidder auto-wins, totalTricks = 5 for bidder
      // Otherwise, totalTricks = number of cards played
      const totalTricks = player.folded ? 0 : (cardsPlayed || autoWinTricks);

      const wasBidder = bidderPosition !== null && player.position === bidderPosition;
      const scoreChange = scoreChanges[index];
      
      // For stats/leaderboards: higher is better, but negative values are allowed (for bucks)
      // pointsEarned = -scoreChange means:
      //   - If you won 5 tricks: scoreChange = -5, so pointsEarned = 5 (positive = good)
      //   - If you got bucked: scoreChange = +5, so pointsEarned = -5 (negative = bad)
      // This is consistent: higher is better, negative represents bucks
      const pointsEarned = -scoreChange;
      
      // Track fold stats: player could fold if they weren't the bidder/dealer and it wasn't Dirty Clubs
      const couldFold = !wasBidder && !isClubsTurnUp;
      const folded = player.folded === true;
      
      const update: RoundStatsUpdate = {
        userId,
        wasBidder,
        tricksWon: player.tricksTaken,
        totalTricks,
        pointsEarned,
        folded,
        couldFold,
      };

      // Only track bidAmount if this was a real bid (not Dirty Clubs)
      // In Dirty Clubs, winningBidderPosition and highestBid are set for scoring purposes,
      // but there was no actual bidding, so we shouldn't count it as a bid
      if (wasBidder && typeof highestBid === 'number' && !isClubsTurnUp) {
        update.bidAmount = highestBid;
        update.bidSuccess = player.tricksTaken >= highestBid;
      }

      return update;
    })
    .filter((update): update is RoundStatsUpdate => update !== null);

  if (roundUpdates.length === 0) {
    console.log('[STATS BUILD] Returning null - no round updates. Players:', postScoreState.players.map((p, i) => ({
      index: i,
      name: p.name,
      id: p.id,
      hasId: !!p.id
    })));
    return null;
  }

  console.log('[STATS BUILD] Built payload with', roundUpdates.length, 'round updates:', roundUpdates);
  const payload: RoundCompletionPayload = { gameId, roundUpdates };

  if (postScoreState.phase === 'GAME_OVER' && postScoreState.gameOver) {
    const winnerPosition = postScoreState.winner;
    payload.gameUpdates = postScoreState.players
      .filter((player) => !!player.id)
      .map((player) => ({
        userId: player.id!,
        won: winnerPosition !== null && player.position === winnerPosition,
        finalScore: player.score,
      }));
    console.log('[STATS BUILD] Added game updates:', payload.gameUpdates);
  }

  console.log('[STATS BUILD] Returning payload');
  return payload;
}

export async function persistRoundCompletionStats(payload: RoundCompletionPayload): Promise<void> {
  console.log('[STATS PERSIST] Called with:', {
    gameId: payload.gameId,
    roundUpdates: payload.roundUpdates.length,
    gameUpdates: payload.gameUpdates?.length || 0,
  });

  if (payload.roundUpdates.length === 0 && (!payload.gameUpdates || payload.gameUpdates.length === 0)) {
    console.log('[STATS PERSIST] No tasks to execute');
    return;
  }

  // Enqueue stats persistence (non-blocking, with retries)
  await statsQueue.enqueue({
    gameId: payload.gameId,
    roundNumber: Date.now(), // Use timestamp as unique identifier
    timestamp: Date.now(),
    updates: payload.roundUpdates,
    gameUpdates: payload.gameUpdates,
  });

  console.log('[STATS PERSIST] Enqueued stats for background processing');
}

/**
 * Register all game event handlers
 */
export function registerGameHandlers(io: Server, socket: Socket): void {
  // DEBUG: Log when handlers are registered
  process.stdout.write(`[WEBSOCKET_REGISTRATION] Registering handlers for socket ${socket.id}\n`);
  
  socket.on('JOIN_GAME', (payload) => handleJoinGame(io, socket, payload));
  socket.on('LEAVE_GAME', (payload) => handleLeaveGame(io, socket, payload));
  socket.on('PLACE_BID', (payload) => handlePlaceBid(io, socket, payload));
  socket.on('DECLARE_TRUMP', (payload) => handleDeclareTrump(io, socket, payload));
  socket.on('FOLD_DECISION', (payload) => handleFoldDecision(io, socket, payload));
  socket.on('PLAY_CARD', (payload, callback) => handlePlayCard(io, socket, payload, callback));
  socket.on('START_NEXT_ROUND', (payload) => {
    // DEBUG BREAKPOINT HERE - This should pause in debugger
    const debugBreakpoint = true; // Set breakpoint on this line
    process.stdout.write(`[WEBSOCKET] START_NEXT_ROUND event received! Payload: ${JSON.stringify(payload)}\n`);
    process.stdout.write(`[WEBSOCKET] Socket ID: ${socket.id}\n`);
    process.stdout.write(`[WEBSOCKET] About to call handleStartNextRound...\n`);
    handleStartNextRound(io, socket, payload).catch((error) => {
      process.stdout.write(`[WEBSOCKET] ERROR in handleStartNextRound: ${error.message}\n`);
      process.stdout.write(`[WEBSOCKET] Stack: ${error.stack}\n`);
    });
  });
  socket.on('REQUEST_STATE', (payload) => handleRequestState(socket, payload));
  
  // DEBUG: Log all registered events
  process.stdout.write(`[WEBSOCKET_REGISTRATION] Handlers registered for socket ${socket.id}\n`);
}

/**
 * Handle JOIN_GAME event
 */
async function handleJoinGame(io: Server, socket: Socket, payload: unknown): Promise<void> {
  try {
    // Validate payload
    const validated = JoinGameSchema.parse(payload);
    const userId = socket.data.userId;
    const displayName = socket.data.displayName;

    if (!userId) {
      socket.emit('ERROR', {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to join game'
      });
      return;
    }

    console.log(`[WS:JOIN_GAME] ENTRY userId=${userId} displayName=${displayName} gameId=${validated.gameId} socketId=${socket.id}`);

    // Add player to game (uses game service)
    console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - calling joinGame()`);
    const gameState = await joinGame(validated.gameId, userId);
    console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - joinGame() returned gameState=${gameState ? `phase=${gameState.phase} version=${gameState.version}` : 'null'}`);

    // Join socket room regardless of whether game has started
    socket.join(`game:${validated.gameId}`);
    
    // Update connection service to track this player's game
    updateConnectionGame(userId, validated.gameId);

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
      
      // Broadcast waiting status to all players in the room
      io.to(`game:${validated.gameId}`).emit('GAME_WAITING', {
        gameId: validated.gameId,
        playerCount: game.players.length,
        playersNeeded: 4 - game.players.length,
        message: `Waiting for ${4 - game.players.length} more player(s)...`
      });
      
      console.log(`[JOIN_GAME] User ${displayName} joined. ${game.players.length}/4 players`);
      return;
    }

    // Game has started or player is reconnecting
    // joinGame now deals cards directly, so gameState should already be in BIDDING phase
    // But handle DEALING phase for backwards compatibility (shouldn't happen anymore)
    console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - checking phase=${gameState.phase}`);
    if (gameState.phase === 'DEALING') {
      // This shouldn't happen anymore since joinGame deals cards directly
      // But handle it just in case for safety
      console.log(`[WS:JOIN_GAME] WARNING userId=${userId} gameId=${validated.gameId} - Game in DEALING phase! This shouldn't happen. Dealing cards...`);
      
      console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - calling executeGameAction to deal`);
      const dealtState = await executeGameAction(validated.gameId, async (currentState) => {
        console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - INSIDE executeGameAction currentPhase=${currentState.phase}`);
        if (currentState.phase !== 'DEALING') {
          console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - already dealt (phase: ${currentState.phase}), returning current`);
          return currentState;
        }
        console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - dealing cards`);
        const dealt = dealNewRound(currentState);
        console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - dealt cards newPhase=${dealt.phase}`);
        return dealt;
      });
      console.log(`[WS:JOIN_GAME] userId=${userId} gameId=${validated.gameId} - executeGameAction completed phase=${dealtState.phase}`);
      
      io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
        gameState: dealtState,
        event: 'GAME_STARTED'
      });
      console.log(`[JOIN_GAME] Cards dealt for game ${validated.gameId}, now in ${dealtState.phase} phase`);
      checkAndTriggerAI(validated.gameId, dealtState, io);
    } else {
      // Player reconnecting to game in progress - just send current state
      socket.emit('GAME_STATE_UPDATE', {
        gameState,
        event: 'PLAYER_RECONNECTED'
      });
      console.log(`[JOIN_GAME] User ${displayName} reconnected to game ${validated.gameId} (phase: ${gameState.phase})`);

      // Trigger AI if needed (game might be waiting for AI to act)
      checkAndTriggerAI(validated.gameId, gameState, io);

      // Only schedule auto-start timer if one doesn't already exist
      // This prevents resetting the timer when players reconnect
      if (gameState.phase === 'ROUND_OVER' && gameState.gameOver !== true && !hasAutoStartTimer(validated.gameId)) {
        scheduleAutoStartNextRound(
          validated.gameId,
          io,
          { round: gameState.round, version: gameState.version },
          checkAndTriggerAI
        );
      }
    }
  } catch (error: any) {
    console.error(`[JOIN_GAME] Error for user ${socket.data.displayName}:`, error.message || error);
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
    const userId = socket.data.userId;

    if (!userId) {
      socket.emit('ERROR', {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to leave game'
      });
      return;
    }

    // Remove player from game
    await leaveGame(validated.gameId, userId);

    // Leave socket room
    socket.leave(`game:${validated.gameId}`);
    
    // Update connection service to clear this player's game
    updateConnectionGame(userId, null);

    // Notify other players
    io.to(`game:${validated.gameId}`).emit('PLAYER_DISCONNECTED', {
      playerId: userId  // Keep as playerId for backward compatibility with client
    });

    console.log(`User ${socket.data.displayName} left game ${validated.gameId}`);
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
    const userId = socket.data.userId;

    if (!userId) {
      socket.emit('ERROR', {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to place bid'
      });
      return;
    }

    // Execute action through queue
    let illegalPlayAttempt = false;
    let illegalReason: string | null = null;
    let illegalPlayer: Player | null = null;

    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === userId);
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
        currentState.bids.filter((b: any) => b.amount === 'PASS').length === 3,
        currentState.bids.some((b: any) => b.playerPosition === player.position)
      );

      if (!validation.valid) {
        throw new Error(validation.reason || 'Invalid bid');
      }

      // Apply bid
      return applyBid(currentState, player.position, validated.amount);
    });

    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: newState.phase === 'DEALING' ? 'ALL_PASSED' : 'BID_PLACED'
    });
    
    // Trigger AI if needed
    checkAndTriggerAI(validated.gameId, newState, io);
    
    // If all players passed, send notification and deal new cards after a delay
    if (newState.phase === 'DEALING') {
      // Send notification immediately
      io.to(`game:${validated.gameId}`).emit('ALL_PLAYERS_PASSED', {
        message: 'Everyone passed. Dealing new hand...'
      });
      
      // Deal new cards after 2.5 second delay
      setTimeout(async () => {
        try {
          const dealtState = await executeGameAction(validated.gameId, dealNewRound);
          io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
            gameState: dealtState,
            event: 'CARDS_DEALT'
          });
          console.log(`[PLACE_BID] New round dealt for game ${validated.gameId} after all players passed`);
          
          // Trigger AI after dealing
          checkAndTriggerAI(validated.gameId, dealtState, io);
        } catch (error: any) {
          console.error(`[PLACE_BID] Failed to deal new round:`, error.message);
        }
      }, 2500);
    }
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
    const userId = socket.data.userId;

    if (!userId) {
      socket.emit('ERROR', {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to declare trump'
      });
      return;
    }

    // Execute action through queue
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === userId);
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
    
    // Trigger AI if needed
    checkAndTriggerAI(validated.gameId, newState, io);
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
    const userId = socket.data.userId;

    if (!userId) {
      socket.emit('ERROR', {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to make fold decision'
      });
      return;
    }

    // Execute action through queue
    let roundCompletionPayload: RoundCompletionPayload | null = null;
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === userId);
      if (!player) {
        throw new Error('Player not in game');
      }

      // Validate phase
      if (currentState.phase !== 'FOLDING_DECISION') {
        throw new Error('Not in folding decision phase');
      }

      if (player.foldDecision !== 'UNDECIDED') {
        throw new Error('You already made your decision');
      }

      // Validate player can fold
      const validation = canFold(
        currentState.isClubsTurnUp,
        player.position === currentState.winningBidderPosition,
        player.foldDecision,
        validated.folded
      );

      if (!validation.valid) {
        throw new Error(validation.reason || 'Cannot fold');
      }

      // Apply fold decision
      const nextState = applyFoldDecision(currentState, player.position, validated.folded);

      if (nextState.phase === 'ROUND_OVER' || nextState.phase === 'GAME_OVER') {
        const statsPayload = buildRoundCompletionPayload(validated.gameId, currentState, nextState);
        if (statsPayload) {
          roundCompletionPayload = statsPayload;
        }
      }

      return nextState;
    });

    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: newState,
      event: 'FOLD_DECISION_MADE'
    });

    // Trigger AI if needed
    checkAndTriggerAI(validated.gameId, newState, io);

    if (roundCompletionPayload) {
      void persistRoundCompletionStats(roundCompletionPayload);
    }

    if (newState.phase === 'ROUND_OVER' || newState.phase === 'GAME_OVER') {
      io.to(`game:${validated.gameId}`).emit('ROUND_COMPLETE', {
        roundNumber: newState.round,
        scores: newState.players.map(p => ({ name: p.name, score: p.score }))
      });

      if (!newState.gameOver) {
        scheduleAutoStartNextRound(
          validated.gameId,
          io,
          { round: newState.round, version: newState.version },
          checkAndTriggerAI
        );
      }
    }
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
async function handlePlayCard(io: Server, socket: Socket, payload: unknown, callback?: (response: any) => void): Promise<void> {
  const startTime = Date.now();
  const logPrefix = `[PLAY_CARD:${startTime}]`;
  console.log(`${logPrefix} ========== PLAY_CARD HANDLER START ==========`);
  
  try {
    console.log(`${logPrefix} Step 1: Validating payload...`);
    // Validate payload
    const validated = PlayCardSchema.parse(payload);
    const userId = socket.data.userId;
    console.log(`${logPrefix} Step 1: Payload validated`, { gameId: validated.gameId, cardId: validated.cardId, userId });

    if (!userId) {
      console.log(`${logPrefix} Step 1: ERROR - No userId`);
      socket.emit('ERROR', {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to play card'
      });
      callback?.({ success: false, error: 'AUTHENTICATION_REQUIRED' });
      return;
    }

    console.log(`${logPrefix} Step 2: Setting up variables...`);
    // Execute action through queue
    let illegalPlayAttempt = false;
    let illegalReason: string | null = null;
    let illegalPlayerId: string | null = null;
    let illegalPlayerPosition: PlayerPosition | null = null;
    let roundCompletionPayload: RoundCompletionPayload | null = null;

    let trickWasCompleted = false;
    let tricksBeforePlay = 0;
    
    console.log(`${logPrefix} Step 3: Calling executeGameAction...`);
    const newState = await executeGameAction(validated.gameId, async (currentState) => {
      // Store tricks count before play to detect completion
      tricksBeforePlay = currentState.tricks.length;
      console.log(`[PLAY_CARD] Incoming`, {
        gameId: validated.gameId,
        userId,
        phase: currentState.phase,
        currentPlayerPosition: currentState.currentPlayerPosition,
        cardsInTrick: currentState.currentTrick.cards.length,
      });
      // Find player position
      const player = currentState.players.find((p: Player) => p.id === userId);
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
        player.folded === true
      );

      if (!validation.valid) {
        illegalPlayAttempt = true;
        illegalReason = validation.reason || 'Invalid card play';
        illegalPlayerId = player.id;
        illegalPlayerPosition = player.position;

        const ledCard = currentState.currentTrick.cards[0]?.card ?? null;
        const trumpSuit = currentState.trumpSuit ?? null;
        console.warn('[PLAY_CARD] Invalid move', {
          reason: validation.reason,
          cardId: card.id,
          cardSuit: trumpSuit ? getEffectiveSuit(card, trumpSuit) : card.suit,
          ledCardId: ledCard?.id ?? null,
          ledSuit: ledCard && trumpSuit ? getEffectiveSuit(ledCard, trumpSuit) : ledCard?.suit ?? null,
          hand: player.hand.map((c: Card) => c.id),
          trumpSuit,
          playerPosition: player.position,
        });

        return currentState;
      }

      // Check if this card will complete the trick BEFORE applying it
      const cardsInTrickBefore = currentState.currentTrick.cards.length + 1;
      const activePlayersBefore = currentState.players.filter((p: Player) => p.folded !== true);
      const willCompleteTrick = cardsInTrickBefore === activePlayersBefore.length;

      // Apply card play (this will transition the trick if complete)
      let nextState = applyCardPlay(currentState, player.position, validated.cardId);

      console.log(`[PLAY_CARD] Applied`, {
        playedBy: player.position,
        nextCardsInTrick: nextState.currentTrick.cards.length,
        activePlayers: activePlayersBefore.length,
        nextPlayer: nextState.currentPlayerPosition,
        trickNumber: nextState.currentTrick.number,
        phase: nextState.phase,
        tricksCompleted: nextState.tricks.length,
        willCompleteTrick,
      });

      // Check if applyCardPlay transitioned to ROUND_OVER (5 tricks complete)
      if (nextState.phase === 'ROUND_OVER') {
        console.log(`[PLAY_CARD] ROUND_OVER detected! About to call finishRound...`);
        // Finish round and calculate scores
        // Capture state BEFORE finishRound (scores not yet calculated)
        const stateBeforeScoring = { ...nextState };
        console.log(`[PLAY_CARD] State before finishRound:`, {
          round: stateBeforeScoring.round,
          phase: stateBeforeScoring.phase,
          scores: stateBeforeScoring.players.map(p => ({ name: p.name, score: p.score }))
        });
        
        console.log(`[PLAY_CARD] Calling finishRound...`);
        nextState = finishRound(nextState);
        console.log(`[PLAY_CARD] finishRound returned:`, {
          phase: nextState.phase,
          round: nextState.round,
          gameOver: nextState.gameOver,
          scores: nextState.players.map(p => ({ name: p.name, score: p.score }))
        });

        console.log(`[PLAY_CARD] Building stats payload...`);
        const statsPayload = buildRoundCompletionPayload(validated.gameId, stateBeforeScoring, nextState);
        console.log(`[PLAY_CARD] Stats payload result:`, statsPayload ? `payload with ${statsPayload.roundUpdates.length} updates` : 'null');
        if (statsPayload) {
          roundCompletionPayload = statsPayload;
        }
        console.log(`[ROUND] Completed. Moving to ${nextState.phase}`, {
          gameOver: nextState.gameOver,
          scores: nextState.players.map(p => ({ name: p.name, score: p.score }))
        });
        
        console.log(`[PLAY_CARD] About to emit TRICK_COMPLETE...`);
        // Emit TRICK_COMPLETE for the final trick before round ends
        const completedTrick = nextState.tricks[nextState.tricks.length - 1];
        console.log(`[PLAY_CARD] Completed trick:`, {
          number: completedTrick.number,
          winner: completedTrick.winner,
          cardsCount: completedTrick.cards.length
        });
        
        io.to(`game:${validated.gameId}`).emit('TRICK_COMPLETE', {
          trick: completedTrick,
          delayMs: 3000
        });
        console.log(`[TRICK_COMPLETE] Emitted for final trick ${completedTrick.number} (round complete)`, {
          winner: completedTrick.winner,
          cardsPlayed: completedTrick.cards.length,
        });
        trickWasCompleted = true;
        console.log(`[PLAY_CARD] Round completion handling done`);
      } else if (willCompleteTrick) {
        // Trick complete but round continues - emit trick complete for animation
        // The completed trick is now the last one in the tricks array
        const completedTrick = nextState.tricks[nextState.tricks.length - 1];
        io.to(`game:${validated.gameId}`).emit('TRICK_COMPLETE', {
          trick: completedTrick,
          delayMs: 3000
        });
        console.log(`[TRICK_COMPLETE] Emitted for trick ${completedTrick.number}`, {
          winner: completedTrick.winner,
          cardsPlayed: completedTrick.cards.length,
        });
        trickWasCompleted = true;
      }

      return nextState;
    });

    // Check if trick was completed by comparing tricks count before and after
    const finalState = newState;
    trickWasCompleted = finalState.tricks.length > tricksBeforePlay;
    console.log(`${logPrefix} Step 4: executeGameAction returned`, {
      phase: finalState.phase,
      round: finalState.round,
      tricksBefore: tricksBeforePlay,
      tricksAfter: finalState.tricks.length,
      trickWasCompleted
    });

    if (illegalPlayAttempt) {
      console.warn(`${logPrefix} Ignored illegal card play attempt`, {
        playerId: illegalPlayerId ?? userId,
        playerPosition: illegalPlayerPosition,
        reason: illegalReason,
      });
      callback?.({ success: false, error: 'ILLEGAL_PLAY', reason: illegalReason });
      return;
    }

    if (roundCompletionPayload) {
      void persistRoundCompletionStats(roundCompletionPayload);
    }

    console.log(`${logPrefix} Step 5: Handling trick completion and broadcasts...`);
    // Show all cards immediately if trick was completed, then delay transition
    if (trickWasCompleted) {
      // Create display state showing completed trick
      const displayState = displayStateManager.createTrickCompleteDisplay(finalState, 3000);
      
      // Validate display state before emitting
      if (!displayState || !displayState.gameId) {
        console.error(`[PLAY_CARD] Invalid display state for game ${validated.gameId}:`, displayState);
        // Fallback: emit the actual state
        io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
          gameState: finalState,
          event: 'CARD_PLAYED'
        });
      } else {
        // Emit display state immediately so all cards are visible
        io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
          gameState: displayState,
          event: 'CARD_PLAYED'
        });
      }
      console.log(`[PLAY_CARD] Immediate broadcast showing all cards in completed trick`, {
        trickNumber: displayState.currentTrick.number,
        cardsInTrick: displayState.currentTrick.cards.length,
      });
      
      // Store finalState for fallback in case memory state is unavailable
      const stateForTransition = finalState;
      
      // Schedule transition to actual state after 3 seconds
      displayStateManager.scheduleTransition(validated.gameId, async () => {
        // Get current state from memory (may have changed during delay)
        let currentState = getActiveGameState(validated.gameId);
        
        // Fallback to the state we stored when creating the display
        if (!currentState) {
          console.warn(`[PLAY_CARD] Game ${validated.gameId} not found in memory, using fallback state`);
          currentState = stateForTransition;
        }
        
        if (!currentState) {
          console.error(`[PLAY_CARD] No state available for game ${validated.gameId} during transition - this should not happen`);
          return; // Can't emit without state
        }
        
        // Validate state before emitting
        if (!currentState || !currentState.gameId) {
          console.error(`[PLAY_CARD] Invalid state for game ${validated.gameId} during transition:`, currentState);
          return;
        }

        // IMPORTANT: Update the timestamp so frontend accepts this state
        // Display state was emitted with a newer timestamp, so we need to ensure
        // this actual state (with empty trick) has an even newer timestamp
        const stateWithUpdatedTimestamp = {
          ...currentState,
          updatedAt: Date.now()
        };

        io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
          gameState: stateWithUpdatedTimestamp,
          event: 'CARD_PLAYED'
        });
        console.log(`[PLAY_CARD] Delayed transition after showing completed trick`, {
          phase: currentState.phase,
          currentPlayerPosition: currentState.currentPlayerPosition,
          trickNumber: currentState.currentTrick.number,
          cardsInTrick: currentState.currentTrick.cards.length,
          tricksCompleted: currentState.tricks.length,
        });
        
        // Trigger AI after delay completes (only if round is still in progress)
        if (currentState.phase === 'PLAYING') {
          void checkAndTriggerAI(validated.gameId, currentState, io);
        }
      });
    } else {
      // Broadcast update immediately if trick not complete
      io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
        gameState: finalState,
        event: 'CARD_PLAYED'
      });
      console.log(`[PLAY_CARD] Broadcast`, {
        phase: finalState.phase,
        currentPlayerPosition: finalState.currentPlayerPosition,
        trickNumber: finalState.currentTrick.number,
        cardsInTrick: finalState.currentTrick.cards.length,
        tricksCompleted: finalState.tricks.length,
      });
      
      // Trigger AI immediately if trick not complete
      void checkAndTriggerAI(validated.gameId, finalState, io);
    }

    console.log(`${logPrefix} Step 6: Checking for round completion...`);
    // Handle round completion
    if (finalState.phase === 'ROUND_OVER' || finalState.phase === 'GAME_OVER') {
      console.log(`${logPrefix} Step 6a: Round is over, emitting ROUND_COMPLETE...`);
      io.to(`game:${validated.gameId}`).emit('ROUND_COMPLETE', {
        roundNumber: finalState.round,
        scores: finalState.players.map(p => ({ name: p.name, score: p.score }))
      });
      console.log(`${logPrefix} Step 6a: ROUND_COMPLETE emitted`);

      if (!finalState.gameOver) {
        console.log(`${logPrefix} Step 6b: Game not over, scheduling auto-start...`);
        console.log(`[ROUND] Scheduling auto-start timer for game ${validated.gameId}`, {
          round: finalState.round,
          version: finalState.version
        });
        scheduleAutoStartNextRound(
          validated.gameId,
          io,
          { round: finalState.round, version: finalState.version },
          checkAndTriggerAI
        );
        console.log(`${logPrefix} Step 6b: Auto-start scheduled`);
      } else {
        console.log(`${logPrefix} Step 6b: Game is over, not scheduling auto-start`);
      }
    } else {
      console.log(`${logPrefix} Step 6: Round not complete, phase=${finalState.phase}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`${logPrefix} ========== PLAY_CARD HANDLER SUCCESS (${duration}ms) ==========`);

    // Send acknowledgment to client
    callback?.({ success: true });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`${logPrefix} ========== PLAY_CARD HANDLER ERROR (${duration}ms) ==========`);
    console.error(`${logPrefix} Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    console.error('Error in PLAY_CARD:', error);
    socket.emit('ERROR', {
      code: 'PLAY_CARD_FAILED',
      message: error.message || 'Failed to play card'
    });
    callback?.({ success: false, error: 'PLAY_CARD_FAILED', message: error.message });
  }
}

/**
 * Handle START_NEXT_ROUND event
 */
async function handleStartNextRound(io: Server, socket: Socket, payload: unknown): Promise<void> {
  const startTime = Date.now();
  const logPrefix = `[START_NEXT_ROUND:${startTime}]`;
  // Log IMMEDIATELY - even before anything else - use process.stdout.write for synchronous logging
  process.stdout.write(`${logPrefix} ========== START_NEXT_ROUND HANDLER CALLED ==========\n`);
  process.stdout.write(`${logPrefix} Payload received: ${JSON.stringify(payload)}\n`);
  process.stdout.write(`${logPrefix} Socket ID: ${socket.id}\n`);
  process.stdout.write(`${logPrefix} ========== START_NEXT_ROUND HANDLER START ==========\n`);
  process.stdout.write(`${logPrefix} Step 1: Validating payload...\n`);
  
  try {
    console.log(`${logPrefix} Step 1: Validating payload...`);
    // Validate payload
    const validated = StartNextRoundSchema.parse(payload);
    console.log(`${logPrefix} Step 1: Payload validated`, { gameId: validated.gameId });

    console.log(`${logPrefix} Step 2: Cancelling auto-start timer...`);
    // Prevent any pending auto-start from firing
    cancelAutoStartNextRound(validated.gameId);
    console.log(`${logPrefix} Step 2: Auto-start timer cancelled`);

    console.log(`${logPrefix} Step 3: Getting current state before executeGameAction...`);
    const stateBefore = getActiveGameState(validated.gameId);
    console.log(`${logPrefix} Step 3: Current state`, {
      exists: !!stateBefore,
      phase: stateBefore?.phase,
      round: stateBefore?.round,
      version: stateBefore?.version,
      gameOver: stateBefore?.gameOver
    });

    console.log(`${logPrefix} Step 4: Calling executeGameAction to start next round and deal cards...`);
    // Execute action through queue - transition ROUND_OVER -> DEALING -> BIDDING in one atomic operation
    const roundState = await executeGameAction(validated.gameId, (currentState) => {
      console.log(`${logPrefix} Step 4a: Inside executeGameAction callback - validating phase...`);
      // Validate phase
      if (currentState.phase !== 'ROUND_OVER') {
        console.error(`${logPrefix} Step 4a: ERROR - Phase is not ROUND_OVER`, { phase: currentState.phase });
        throw new Error('Round is not over');
      }

      // If game is over, don't start new round
      if (currentState.gameOver) {
        console.error(`${logPrefix} Step 4a: ERROR - Game is over`);
        throw new Error('Game is over');
      }

      console.log(`${logPrefix} Step 4b: Calling startNextRound...`);
      // Start next round (transitions to DEALING)
      const dealingState = startNextRound(currentState);
      console.log(`${logPrefix} Step 4b: startNextRound returned`, {
        phase: dealingState.phase,
        round: dealingState.round,
        version: dealingState.version
      });

      console.log(`${logPrefix} Step 4c: Calling dealNewRound...`);
      // Deal cards and transition to BIDDING (all in one atomic action)
      const result = dealNewRound(dealingState);
      console.log(`${logPrefix} Step 4c: dealNewRound returned`, {
        phase: result.phase,
        round: result.round,
        version: result.version,
        playersHaveCards: result.players.every(p => p.hand.length > 0)
      });
      return result;
    });
    console.log(`${logPrefix} Step 4: executeGameAction completed`, {
      phase: roundState.phase,
      round: roundState.round,
      version: roundState.version
    });

    console.log(`${logPrefix} Step 5: Broadcasting GAME_STATE_UPDATE...`);
    // Broadcast update
    io.to(`game:${validated.gameId}`).emit('GAME_STATE_UPDATE', {
      gameState: roundState,
      event: 'ROUND_STARTED'
    });
    console.log(`${logPrefix} Step 6: Broadcast sent`);

    console.log(`${logPrefix} Step 6: Triggering AI...`);
    // Trigger AI if needed
    checkAndTriggerAI(validated.gameId, roundState, io);
    console.log(`${logPrefix} Step 7: AI triggered`);
    
    const duration = Date.now() - startTime;
    process.stdout.write(`${logPrefix} ========== START_NEXT_ROUND HANDLER SUCCESS (${duration}ms) ==========\n`);
    console.log(`${logPrefix} ========== START_NEXT_ROUND HANDLER SUCCESS (${duration}ms) ==========`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    process.stdout.write(`${logPrefix} ========== START_NEXT_ROUND HANDLER ERROR (${duration}ms) ==========\n`);
    process.stdout.write(`${logPrefix} Error message: ${error?.message || String(error)}\n`);
    process.stdout.write(`${logPrefix} Error stack: ${error?.stack || 'No stack trace'}\n`);
    console.error(`${logPrefix} ========== START_NEXT_ROUND HANDLER ERROR (${duration}ms) ==========`);
    console.error(`${logPrefix} Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    console.error('Error in START_NEXT_ROUND:', error);
    socket.emit('ERROR', {
      code: 'START_NEXT_ROUND_FAILED',
      message: error.message || 'Failed to start next round'
    });
  }
}

/**
 * Handle REQUEST_STATE event
 */
async function handleRequestState(socket: Socket, payload: unknown): Promise<void> {
  try {
    const validated = RequestStateSchema.parse(payload);
    const gameState = getActiveGameState(validated.gameId);

    if (!gameState) {
      console.warn(
        `[REQUEST_STATE] No active state found for game ${validated.gameId} (user: ${socket.data.displayName})`
      );
      socket.emit('ERROR', {
        code: 'STATE_NOT_AVAILABLE',
        message: 'Game state not available'
      });
      return;
    }

    socket.emit('GAME_STATE_UPDATE', {
      gameState,
      event: 'STATE_RESYNC'
    });
  } catch (error: any) {
    console.error('[REQUEST_STATE] Error handling state request:', error.message || error);
    socket.emit('ERROR', {
      code: 'REQUEST_STATE_FAILED',
      message: error.message || 'Failed to fetch game state'
    });
  }
}
