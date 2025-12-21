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
  emitJoinGame,
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
  const { setGameState, setError, setWaitingInfo, setAIAnalysis, setBidAnalysis, setFoldAnalysis } = useGameStore();
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
          // Don't clear state - just log the error and request fresh state if we have a gameId
          const currentState = useGameStore.getState().gameState;
          if (socketRef.current && currentState?.gameId) {
            console.log('Requesting fresh state due to invalid update');
            emitRequestState(socketRef.current, currentState.gameId);
          }
          return;
        }

        // Version check: ensure we don't apply stale updates
        const currentState = useGameStore.getState().gameState;
        const newVersion = data.gameState.version || 0;
        const currentVersion = currentState?.version || 0;

        if (newVersion > currentVersion) {
          // Apply update immediately (backend handles delays)
          setGameState(data.gameState);
        } else if (newVersion < currentVersion) {
          console.warn('Received stale update, requesting fresh state');
          if (socketRef.current && data.gameState.gameId) {
            emitRequestState(socketRef.current, data.gameState.gameId);
          }
        } else {
          // Same version - might be a duplicate or display state transition
          // Only update if we don't have a current state (shouldn't happen, but be safe)
          if (!currentState) {
            console.log('Applying state update with same version (no current state)');
            setGameState(data.gameState);
          } else {
            console.log('Ignoring state update with same version (duplicate or display transition)');
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
        // Backend now handles the delay, so we just log this
        // The state update will arrive after the backend's 1-second delay
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
        console.log('AI Analysis update:', data);
        // Only store analysis if it's for the current player
        const gameStore = useGameStore.getState();
        if (data.playerPosition === gameStore.myPosition) {
          // Handle different analysis types
          if (data.analysisType === 'card' && data.cards) {
            setAIAnalysis(data.cards);
            setBidAnalysis(null);
            setFoldAnalysis(null);
          } else if (data.analysisType === 'bid' && data.bids) {
            setBidAnalysis(data.bids);
            setAIAnalysis(null);
            setFoldAnalysis(null);
          } else if (data.analysisType === 'fold' && data.foldOptions) {
            setFoldAnalysis(data.foldOptions);
            setAIAnalysis(null);
            setBidAnalysis(null);
          }
        }
      },
    });

    return () => {
      console.log('[useSocket] Cleaning up socket connection');


      cleanupSocketListeners(socket);
      socket.disconnect();
    };
  }, [token, setGameState, setError, setConnected, setNotification, setWaitingInfo, setAIAnalysis]);

  // Socket event emitters wrapped in callbacks
  const joinGame = useCallback((gameId: string) => {
    if (socketRef.current) {
      emitJoinGame(socketRef.current, { gameId });
    }
  }, []);

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
      emitPlayCard(socketRef.current, { gameId, cardId });
    }
  }, []);

  const startNextRound = useCallback((gameId: string) => {
    if (socketRef.current) {
      emitStartNextRound(socketRef.current, { gameId });
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
  };
}
