/**
 * @module hooks/useGame
 * @description Custom hook for game state and actions
 */

import { useCallback, useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSocket } from './useSocket';

export function useGame() {
  // Use stable selectors to avoid re-renders on unrelated state changes
  const gameState = useGameStore(state => state.gameState);
  const myPosition = useGameStore(state => state.myPosition);
  const waitingInfo = useGameStore(state => state.waitingInfo);
  const error = useGameStore(state => state.error);
  const socket = useSocket();

  // Game actions
  const joinGame = useCallback((gameId: string) => {
    socket.joinGame(gameId);
  }, [socket]);

  const leaveGame = useCallback((gameId: string) => {
    socket.leaveGame(gameId);
    useGameStore.getState().clearGame();
  }, [socket]);

  const placeBid = useCallback((amount: 'PASS' | 2 | 3 | 4 | 5) => {
    if (!gameState) return;
    socket.placeBid(gameState.gameId, amount);
  }, [socket, gameState]);

  const declareTrump = useCallback((trumpSuit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS') => {
    if (!gameState) return;
    socket.declareTrump(gameState.gameId, trumpSuit);
  }, [socket, gameState]);

  const makeFoldDecision = useCallback((fold: boolean) => {
    if (!gameState) return;
    socket.makeFoldDecision(gameState.gameId, fold);
  }, [socket, gameState]);

  const playCard = useCallback((cardId: string) => {
    if (!gameState) return;
    socket.playCard(gameState.gameId, cardId);
  }, [socket, gameState]);

  const startNextRound = useCallback(() => {
    if (!gameState) return;
    socket.startNextRound(gameState.gameId);
  }, [socket, gameState]);

  // Computed values using getState() to avoid stale closures
  const myPlayer = useGameStore.getState().getMyPlayer();
  const isMyTurn = useGameStore.getState().isMyTurn();
  const playableCards = useGameStore.getState().getPlayableCards();
  const currentPlayer = useGameStore.getState().getCurrentPlayer();

  return useMemo(() => ({
    // State
    gameState,
    myPosition,
    waitingInfo,
    myPlayer,
    isMyTurn,
    playableCards,
    currentPlayer,
    error,

    // Actions
    setMyPosition: useGameStore.getState().setMyPosition,
    joinGame,
    leaveGame,
    placeBid,
    declareTrump,
    makeFoldDecision,
    playCard,
    startNextRound,
    clearGame: useGameStore.getState().clearGame,
    setWaitingInfo: useGameStore.getState().setWaitingInfo,
  }), [
    gameState,
    myPosition,
    waitingInfo,
    myPlayer,
    isMyTurn,
    playableCards,
    currentPlayer,
    error,
    joinGame,
    leaveGame,
    placeBid,
    declareTrump,
    makeFoldDecision,
    playCard,
    startNextRound,
  ]);
}
