/**
 * @module hooks/useGame
 * @description Custom hook for game state and actions
 */

import { useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from './useSocket';

export function useGame() {
  const gameStore = useGameStore();
  const { playerId } = useAuthStore();
  const socket = useSocket();

  // Game actions
  const joinGame = useCallback((gameId: string) => {
    socket.joinGame(gameId);
  }, [socket]);

  const leaveGame = useCallback((gameId: string) => {
    socket.leaveGame(gameId);
    gameStore.clearGame();
  }, [socket, gameStore]);

  const placeBid = useCallback((amount: 'PASS' | 2 | 3 | 4 | 5) => {
    if (!gameStore.gameState) return;
    socket.placeBid(gameStore.gameState.id, amount);
  }, [socket, gameStore.gameState]);

  const declareTrump = useCallback((trumpSuit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS') => {
    if (!gameStore.gameState) return;
    socket.declareTrump(gameStore.gameState.id, trumpSuit);
  }, [socket, gameStore.gameState]);

  const makeFoldDecision = useCallback((fold: boolean) => {
    if (!gameStore.gameState) return;
    socket.makeFoldDecision(gameStore.gameState.id, fold);
  }, [socket, gameStore.gameState]);

  const playCard = useCallback((cardId: string) => {
    if (!gameStore.gameState) return;
    socket.playCard(gameStore.gameState.id, cardId);
  }, [socket, gameStore.gameState]);

  const startNextRound = useCallback(() => {
    if (!gameStore.gameState) return;
    socket.startNextRound(gameStore.gameState.id);
  }, [socket, gameStore.gameState]);

  // Computed values
  const myPlayer = gameStore.getMyPlayer();
  const isMyTurn = gameStore.isMyTurn();
  const playableCards = gameStore.getPlayableCards();
  const currentPlayer = gameStore.getCurrentPlayer();

  return {
    // State
    gameState: gameStore.gameState,
    myPosition: gameStore.myPosition,
    myPlayer,
    isMyTurn,
    playableCards,
    currentPlayer,
    error: gameStore.error,
    
    // Actions
    setMyPosition: gameStore.setMyPosition,
    joinGame,
    leaveGame,
    placeBid,
    declareTrump,
    makeFoldDecision,
    playCard,
    startNextRound,
    clearGame: gameStore.clearGame,
  };
}
