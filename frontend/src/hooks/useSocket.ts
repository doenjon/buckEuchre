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
  emitStartNextRound
} from '@/services/socket';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();
  const { setGameState, setError } = useGameStore();
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
        setError(error.message || 'An error occurred');
      },
      
      onGameStateUpdate: (data) => {
        console.log('Game state update:', data);
        setGameState(data.gameState);
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
  }, [token, setGameState, setError, setConnected, setNotification]);

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
      emitFoldDecision(socketRef.current, { gameId, fold });
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
