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
  const { setGameState, setError, setWaitingInfo } = useGameStore();
  const { setConnected, setNotification } = useUIStore();

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    const socket = createSocketConnection(token);
    socketRef.current = socket;

    setupSocketListeners(socket, {
      onConnect: () => {
        console.log('Socket connected');
        setConnected(true);
      },
      
      onDisconnect: () => {
        console.log('Socket disconnected');
        setConnected(false);
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

        // Version check: ensure we don't apply stale updates
        const currentState = useGameStore.getState().gameState;
        const newVersion = data.gameState?.version || 0;
        const currentVersion = currentState?.version || 0;
        
        if (newVersion > currentVersion) {
          setGameState(data.gameState);
        } else if (newVersion < currentVersion) {
          console.warn('Received stale update, requesting fresh state');
          if (socketRef.current && data.gameState?.gameId) {
            emitRequestState(socketRef.current, data.gameState.gameId);
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
        // Could add animation trigger here in Phase 6
      },
      
      onRoundComplete: (data) => {
        console.log('Round complete:', data);
        // Could add animation trigger here in Phase 6
      },
    });

    return () => {
      cleanupSocketListeners(socket);
      socket.disconnect();
    };
  }, [token, setGameState, setError, setConnected, setNotification, setWaitingInfo]);

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
