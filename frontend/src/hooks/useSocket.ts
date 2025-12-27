/**
 * @module hooks/useSocket
 * @description Custom hook for WebSocket connection
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from '@/stores/uiStore';
import { 
  createSocketConnection, 
  setupSocketListeners, 
  cleanupSocketListeners,
  emitJoinGameReliable,
  emitLeaveGame,
  emitPlaceBid,
  emitDeclareTrump,
  emitFoldDecision,
  emitPlayCard,
  emitStartNextRound,
  emitRequestState
} from '@/services/socket';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();
  const { setGameState, setError, setWaitingInfo, setAIAnalysis, setBidAnalysis, setFoldAnalysis, setSuitAnalysis, setNextPlayerPosition } = useGameStore();
  const { setConnected, setNotification } = useUIStore();

  // Initialize socket connection
  useEffect(() => {
    if (!token) {
      console.log('[useSocket] No token available, skipping connection');
      return;
    }

    console.log('[useSocket] Initializing socket connection');
    const socket = createSocketConnection(token);
    socketRef.current = socket;

    setupSocketListeners(socket, {
      onConnect: () => {
        console.log('[useSocket] ✓ Socket connected successfully', {
          id: socket.id,
          connected: socket.connected,
        });
        setConnected(true);
      },

      onDisconnect: (reason: string) => {
        console.log('[useSocket] Socket disconnected:', {
          reason,
          willReconnect: socket.active,
        });
        setConnected(false);
      },

      onConnectError: (error) => {
        console.warn('[useSocket] WebSocket connection failed:', {
          message: error.message || error,
          type: error.type,
          description: error.description,
        });
        setConnected(false);

        // Show a notification for connection errors
        const message = error.message || 'Failed to connect to game server';
        setNotification(`Connection error: ${message}`);
        setTimeout(() => setNotification(null), 5000);
      },

      onError: (error) => {
        console.error('Socket error:', error);

        // Only show blocking errors for join-related failures
        // Gameplay errors should be notifications, not blocking
        const blockingErrorCodes = [
          'JOIN_GAME_FAILED',
          'AUTHENTICATION_REQUIRED',
          'GAME_NOT_FOUND',
          'SEAT_FAILED'
        ];

        if (error.code && blockingErrorCodes.includes(error.code)) {
          // This is a blocking error - show the error modal
          setError(error.message || 'An error occurred');
        } else {
          // This is a gameplay error - just show a notification
          const message = error.message || 'An error occurred';
          setNotification(message);
          setTimeout(() => setNotification(null), 5000);
        }
      },
      
      onGameStateUpdate: (data) => {
        console.log('Game state update:', data);

        // Validate that we have a valid game state
        if (!data.gameState || !data.gameState.gameId) {
          console.error('Received invalid game state update:', data);
          const currentState = useGameStore.getState().gameState;
          if (socketRef.current && currentState?.gameId) {
            console.log('Requesting fresh state due to invalid update');
            emitRequestState(socketRef.current, currentState.gameId);
          }
          return;
        }

        // Version check: only update if newer
        const currentState = useGameStore.getState().gameState;
        const newVersion = data.gameState.version || 0;
        const currentVersion = currentState?.version || 0;

        if (newVersion > currentVersion) {
          // Newer version - update state
          const oldPhase = currentState?.phase;
          const newPhase = data.gameState.phase;
          const oldTurn = currentState?.currentPlayerPosition;
          const newTurn = data.gameState.currentPlayerPosition;
          const oldBidder = currentState?.currentBidder;
          const newBidder = data.gameState.currentBidder;

          setGameState(data.gameState);

          // Only clear analysis when situation actually changes
          const phaseChanged = oldPhase !== newPhase;
          const turnChanged = oldTurn !== newTurn && newPhase === 'PLAYING';
          const bidderChanged = oldBidder !== newBidder && newPhase === 'BIDDING';

          if (phaseChanged) {
            // Phase changed - clear all analysis
            console.log('[useSocket] Phase changed, clearing all analysis');
            setAIAnalysis(null);
            setBidAnalysis(null);
            setFoldAnalysis(null);
            setSuitAnalysis(null);
          } else if (turnChanged) {
            // New turn in playing phase - clear card analysis only
            console.log('[useSocket] Turn changed in playing phase, clearing card analysis');
            setAIAnalysis(null);
          } else if (bidderChanged) {
            // New bidder in bidding phase - clear bid analysis only
            console.log('[useSocket] Bidder changed in bidding phase, clearing bid analysis');
            setBidAnalysis(null);
          }
          // Otherwise keep existing analysis - it's still valid!
        } else if (newVersion < currentVersion) {
          console.warn('Received stale update (old version), requesting fresh state');
          if (socketRef.current && data.gameState.gameId) {
            emitRequestState(socketRef.current, data.gameState.gameId);
          }
        } else {
          // Same version - duplicate, ignore
          if (!currentState) {
            // No current state, apply it anyway
            setGameState(data.gameState);
          }
        }
      },
      
      onReconnected: (data) => {
        console.log('Reconnected to game:', data);
        setGameState(data.gameState);
        setNotification('Reconnected to game');
        setTimeout(() => setNotification(null), 3000);
      },

      onGameWaiting: (data) => {
        console.log('Waiting for players:', data);
        setWaitingInfo({
          gameId: data.gameId,
          playerCount: data.playerCount,
          playersNeeded: data.playersNeeded,
          message: data.message,
        });
      },
      
      onPlayerConnected: (data) => {
        console.log('Player connected:', data);
        setNotification(`Player ${data.playerName || data.playerId} connected`);
        setTimeout(() => setNotification(null), 3000);
      },
      
      onPlayerDisconnected: (data) => {
        console.log('Player disconnected:', data);
        setNotification(`Player at position ${data.position} disconnected`);
        setTimeout(() => setNotification(null), 3000);
      },
      
      onPlayerReconnected: (data) => {
        console.log('Player reconnected:', data);
        setNotification(`${data.playerName} reconnected`);
        setTimeout(() => setNotification(null), 3000);
      },
      
      onTrickComplete: (data) => {
        console.log('Trick complete:', data);
        // Set nextPlayerPosition to enable early analysis during the 3-second pause
        if (data.nextPlayerPosition !== null && data.nextPlayerPosition !== undefined) {
          console.log('[onTrickComplete] Setting next player position to trigger early analysis:', data.nextPlayerPosition);
          setNextPlayerPosition(data.nextPlayerPosition);
        }
      },
      
      onRoundComplete: (data) => {
        console.log('Round complete:', data);
        // Could add animation trigger here in Phase 6
      },
      
      onAllPlayersPassed: (data) => {
        console.log('All players passed:', data);
        // Show notification using the game store notification system
        const gameStore = useGameStore.getState();
        gameStore.showNotification('Everyone passed. Dealing new hand...', 'info');
        // Auto-clear after 2.5 seconds
        setTimeout(() => {
          gameStore.clearNotification();
        }, 2500);
      },

      onAIAnalysisUpdate: (data) => {
        console.log('[useSocket] AI Analysis update received:', {
          analysisType: data.analysisType,
          playerPosition: data.playerPosition,
          ...(data.analysisType === 'fold' && { foldOptionsCount: data.foldOptions?.length ?? 0 }),
          ...(data.analysisType === 'card' && { cardsCount: data.cards?.length ?? 0 }),
          ...(data.analysisType === 'bid' && { bidsCount: data.bids?.length ?? 0 }),
          ...(data.analysisType === 'suit' && { suitsCount: data.suits?.length ?? 0 }),
        });
        // Only store analysis if it's for the current player.
        // Note: analysis events are broadcast to the whole game room, so every client receives them.
        // We gate on *our* seat position. If myPosition hasn't been set yet, derive it from auth+gameState.
        const gameStore = useGameStore.getState();
        const authState = useAuthStore.getState();
        const derivedMyPosition =
          gameStore.myPosition ??
          (gameStore.gameState && authState.userId
            ? (gameStore.gameState.players.find((p) => p.id === authState.userId)?.position ?? null)
            : null);

        console.log('[useSocket] Position check:', {
          derivedMyPosition,
          analysisPlayerPosition: data.playerPosition,
          matches: derivedMyPosition !== null && data.playerPosition === derivedMyPosition,
          gameStoreMyPosition: gameStore.myPosition,
          authUserId: authState.userId,
        });

        if (derivedMyPosition !== null && data.playerPosition === derivedMyPosition) {
          console.log('[useSocket] ✅ Storing analysis for current player');
          // Store analysis - don't clear other types (they might still be valid)
          if (data.analysisType === 'card' && data.cards) {
            setAIAnalysis(data.cards);
          } else if (data.analysisType === 'bid' && data.bids) {
            setBidAnalysis(data.bids);
          } else if (data.analysisType === 'fold' && data.foldOptions) {
            setFoldAnalysis(data.foldOptions);
          } else if (data.analysisType === 'suit' && data.suits) {
            setSuitAnalysis(data.suits);
          }
        } else {
          console.log('[useSocket] ❌ Ignoring analysis - not for current player');
        }
      },
    });

    return () => {
      console.log('[useSocket] Cleaning up socket connection');


      cleanupSocketListeners(socket);
      socket.disconnect();
    };
  }, [token, setGameState, setError, setConnected, setNotification, setWaitingInfo, setAIAnalysis, setBidAnalysis, setFoldAnalysis, setSuitAnalysis, setNextPlayerPosition]);

  // Socket event emitters wrapped in callbacks
  const joinGame = useCallback((gameId: string) => {
    if (socketRef.current) {
      const socket = socketRef.current;
      // Reliable join + fallback state resync if we didn't receive anything promptly.
      void emitJoinGameReliable(socket, { gameId }).catch((err) => {
        // If join never reaches server (overload/disconnect), surface a notification.
        const message = err instanceof Error ? err.message : 'Failed to join game';
        setNotification(`Join delayed: ${message}`);
        setTimeout(() => setNotification(null), 5000);
      });

      // If we haven't gotten waiting/state soon, request state explicitly (covers dropped updates).
      setTimeout(() => {
        const { gameState, waitingInfo } = useGameStore.getState();
        const hasState = !!gameState && gameState.gameId === gameId;
        const hasWaiting = !!waitingInfo && waitingInfo.gameId === gameId;
        if (!hasState && !hasWaiting && socketRef.current) {
          emitRequestState(socketRef.current, gameId);
        }
      }, 2500);
    }
  }, [setNotification]);

  const leaveGame = useCallback((gameId: string) => {
    if (socketRef.current) {
      emitLeaveGame(socketRef.current, gameId);
    }
  }, []);

  const placeBid = useCallback((gameId: string, amount: 'PASS' | 2 | 3 | 4 | 5) => {
    if (socketRef.current) {
      emitPlaceBid(socketRef.current, { gameId, amount });
    }
  }, []);

  const declareTrump = useCallback((gameId: string, trumpSuit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS') => {
    if (socketRef.current) {
      emitDeclareTrump(socketRef.current, { gameId, trumpSuit });
    }
  }, []);

  const makeFoldDecision = useCallback((gameId: string, fold: boolean) => {
    if (socketRef.current) {
      emitFoldDecision(socketRef.current, { gameId, folded: fold });
    }
  }, []);

  const playCard = useCallback((gameId: string, cardId: string) => {
    if (socketRef.current) {
      emitPlayCard(socketRef.current, { gameId, cardId }, (response) => {
        if (!response.success) {
          console.error('[playCard] Server rejected card play:', response);
          // Show error notification to user
          const message = response.reason || response.message || 'Card play failed';
          setNotification(`Card play rejected: ${message}`);
          setTimeout(() => setNotification(null), 3000);
        } else {
          console.log('[playCard] Server acknowledged card play');
        }
      });
    }
  }, [setNotification]);

  const startNextRound = useCallback((gameId: string) => {
    if (socketRef.current) {
      emitStartNextRound(socketRef.current, { gameId });
    }
  }, []);

  const requestState = useCallback((gameId: string) => {
    if (socketRef.current) {
      console.log('[useSocket] Requesting fresh game state for:', gameId);
      emitRequestState(socketRef.current, gameId);
    }
  }, []);

  return {
    socket: socketRef.current,
    joinGame,
    leaveGame,
    placeBid,
    declareTrump,
    makeFoldDecision,
    playCard,
    startNextRound,
    requestState,
  };
}
