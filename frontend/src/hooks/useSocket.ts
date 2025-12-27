/**
 * @module hooks/useSocket
 * @description Custom hook for WebSocket connection
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
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

  // Store setters in refs to avoid re-renders - getters are stable, no need to subscribe to stores
  const settersRef = useRef({
    setGameState: useGameStore.getState().setGameState,
    setError: useGameStore.getState().setError,
    setWaitingInfo: useGameStore.getState().setWaitingInfo,
    setAIAnalysis: useGameStore.getState().setAIAnalysis,
    setBidAnalysis: useGameStore.getState().setBidAnalysis,
    setFoldAnalysis: useGameStore.getState().setFoldAnalysis,
    setSuitAnalysis: useGameStore.getState().setSuitAnalysis,
    setNextPlayerPosition: useGameStore.getState().setNextPlayerPosition,
    setConnected: useUIStore.getState().setConnected,
    setNotification: useUIStore.getState().setNotification,
  });

  // Initialize socket connection
  // IMPORTANT: Only depend on token - use refs for all callbacks to prevent re-renders
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
        settersRef.current.setConnected(true);
      },

      onDisconnect: (reason: string) => {
        console.log('[useSocket] Socket disconnected:', {
          reason,
          willReconnect: socket.active,
        });
        settersRef.current.setConnected(false);
      },

      onConnectError: (error) => {
        console.warn('[useSocket] WebSocket connection failed:', {
          message: error.message || error,
          type: error.type,
          description: error.description,
        });
        settersRef.current.setConnected(false);

        // Show a notification for connection errors
        const message = error.message || 'Failed to connect to game server';
        settersRef.current.setNotification(`Connection error: ${message}`);
        setTimeout(() => settersRef.current.setNotification(null), 5000);
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
          settersRef.current.setError(error.message || 'An error occurred');
        } else {
          // This is a gameplay error - just show a notification
          const message = error.message || 'An error occurred';
          settersRef.current.setNotification(message);
          setTimeout(() => settersRef.current.setNotification(null), 5000);
        }
      },

      onGameStateUpdate: (data) => {
        console.log('[useSocket] GAME_STATE_UPDATE received:', {
          event: data.event,
          phase: data.gameState?.phase,
          version: data.gameState?.version,
          winningBidder: data.gameState?.winningBidderPosition,
          trumpSuit: data.gameState?.trumpSuit
        });

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

          settersRef.current.setGameState(data.gameState);

          // Only clear analysis when situation actually changes
          const phaseChanged = oldPhase !== newPhase;
          const turnChanged = oldTurn !== newTurn && newPhase === 'PLAYING';
          const bidderChanged = oldBidder !== newBidder && newPhase === 'BIDDING';

          if (phaseChanged) {
            // Phase changed - clear all analysis
            console.log('[useSocket] Phase changed, clearing all analysis');
            settersRef.current.setAIAnalysis(null);
            settersRef.current.setBidAnalysis(null);
            settersRef.current.setFoldAnalysis(null);
            settersRef.current.setSuitAnalysis(null);
          } else if (turnChanged) {
            // New turn in playing phase - clear card analysis only
            console.log('[useSocket] Turn changed in playing phase, clearing card analysis');
            settersRef.current.setAIAnalysis(null);
          } else if (bidderChanged) {
            // New bidder in bidding phase - clear bid analysis only
            console.log('[useSocket] Bidder changed in bidding phase, clearing bid analysis');
            settersRef.current.setBidAnalysis(null);
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
            settersRef.current.setGameState(data.gameState);
          }
        }
      },

      onReconnected: (data) => {
        console.log('Reconnected to game:', data);
        settersRef.current.setGameState(data.gameState);
        settersRef.current.setNotification('Reconnected to game');
        setTimeout(() => settersRef.current.setNotification(null), 3000);
      },

      onGameWaiting: (data) => {
        console.log('Waiting for players:', data);
        settersRef.current.setWaitingInfo({
          gameId: data.gameId,
          playerCount: data.playerCount,
          playersNeeded: data.playersNeeded,
          message: data.message,
        });
      },

      onPlayerConnected: (data) => {
        console.log('Player connected:', data);
        settersRef.current.setNotification(`Player ${data.playerName || data.playerId} connected`);
        setTimeout(() => settersRef.current.setNotification(null), 3000);
      },

      onPlayerDisconnected: (data) => {
        console.log('Player disconnected:', data);
        settersRef.current.setNotification(`Player at position ${data.position} disconnected`);
        setTimeout(() => settersRef.current.setNotification(null), 3000);
      },

      onPlayerReconnected: (data) => {
        console.log('Player reconnected:', data);
        settersRef.current.setNotification(`${data.playerName} reconnected`);
        setTimeout(() => settersRef.current.setNotification(null), 3000);
      },

      onTrickComplete: (data) => {
        console.log('Trick complete:', data);
        // Set nextPlayerPosition to enable early analysis during the 3-second pause
        if (data.nextPlayerPosition !== null && data.nextPlayerPosition !== undefined) {
          console.log('[onTrickComplete] Setting next player position to trigger early analysis:', data.nextPlayerPosition);
          settersRef.current.setNextPlayerPosition(data.nextPlayerPosition);
        }
      },

      onRoundComplete: (data) => {
        console.log('Round complete:', data);
        // Could add animation trigger here in Phase 6
      },

      onAllPlayersPassed: (data) => {
        console.log('All players passed:', data);
        // Show notification using the game store notification system
        const currentGameStore = useGameStore.getState();
        currentGameStore.showNotification('Everyone passed. Dealing new hand...', 'info');
        // Auto-clear after 2.5 seconds
        setTimeout(() => {
          currentGameStore.clearNotification();
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
        const currentGameStore = useGameStore.getState();
        const authState = useAuthStore.getState();
        const derivedMyPosition =
          currentGameStore.myPosition ??
          (currentGameStore.gameState && authState.userId
            ? (currentGameStore.gameState.players.find((p) => p.id === authState.userId)?.position ?? null)
            : null);

        console.log('[useSocket] Position check:', {
          derivedMyPosition,
          analysisPlayerPosition: data.playerPosition,
          matches: derivedMyPosition !== null && data.playerPosition === derivedMyPosition,
          gameStoreMyPosition: currentGameStore.myPosition,
          authUserId: authState.userId,
        });

        if (derivedMyPosition !== null && data.playerPosition === derivedMyPosition) {
          console.log('[useSocket] ✅ Storing analysis for current player');
          // Store analysis - don't clear other types (they might still be valid)
          if (data.analysisType === 'card' && data.cards) {
            settersRef.current.setAIAnalysis(data.cards);
          } else if (data.analysisType === 'bid' && data.bids) {
            settersRef.current.setBidAnalysis(data.bids);
          } else if (data.analysisType === 'fold' && data.foldOptions) {
            settersRef.current.setFoldAnalysis(data.foldOptions);
          } else if (data.analysisType === 'suit' && data.suits) {
            settersRef.current.setSuitAnalysis(data.suits);
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
  }, [token]); // Only depend on token - all callbacks use refs

  // Socket event emitters wrapped in callbacks
  const joinGame = useCallback((gameId: string) => {
    if (socketRef.current) {
      const socket = socketRef.current;
      // Reliable join + fallback state resync if we didn't receive anything promptly.
      void emitJoinGameReliable(socket, { gameId }).catch((err) => {
        // If join never reaches server (overload/disconnect), surface a notification.
        const message = err instanceof Error ? err.message : 'Failed to join game';
        settersRef.current.setNotification(`Join delayed: ${message}`);
        setTimeout(() => settersRef.current.setNotification(null), 5000);
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
  }, []); // No dependencies - uses refs

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
          settersRef.current.setNotification(`Card play rejected: ${message}`);
          setTimeout(() => settersRef.current.setNotification(null), 3000);
        } else {
          console.log('[playCard] Server acknowledged card play');
        }
      });
    }
  }, []); // No dependencies - uses refs

  const startNextRound = useCallback((gameId: string) => {
    if (socketRef.current) {
      emitStartNextRound(socketRef.current, { gameId });
    }
  }, []);

  return useMemo(() => ({
    socket: socketRef.current,
    joinGame,
    leaveGame,
    placeBid,
    declareTrump,
    makeFoldDecision,
    playCard,
    startNextRound,
  }), [joinGame, leaveGame, placeBid, declareTrump, makeFoldDecision, playCard, startNextRound]);
}
