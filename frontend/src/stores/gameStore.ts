/**
 * @module stores/gameStore
 * @description Game state management using Zustand
 */

import { create } from 'zustand';
import type { GameState, Card, Player } from '@buck-euchre/shared';

export interface WaitingInfo {
  gameId: string;
  playerCount: number;
  playersNeeded: number;
  message?: string;
}

export interface GameStoreState {
  gameState: GameState | null;
  myPosition: number | null;
  error: string | null;
  waitingInfo: WaitingInfo | null;
}

export interface GameStoreActions {
  setGameState: (state: GameState) => void;
  setMyPosition: (position: number) => void;
  setError: (error: string | null) => void;
  clearGame: () => void;
  setWaitingInfo: (info: WaitingInfo | null) => void;

  // Computed getters (selectors)
  getMyPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getPlayableCards: () => Card[];
  getCurrentPlayer: () => Player | null;
}

export type GameStore = GameStoreState & GameStoreActions;

const initialState: GameStoreState = {
  gameState: null,
  myPosition: null,
  error: null,
  waitingInfo: null,
};

/**
 * Game state store
 */
export const useGameStore = create<GameStore>()((set, get) => ({
  ...initialState,

  setGameState: (gameState) => {
    set({ gameState, error: null, waitingInfo: null });
  },

  setMyPosition: (position) => {
    set({ myPosition: position });
  },

  setError: (error) => {
    set({ error });
  },

  clearGame: () => {
    set(initialState);
  },

  setWaitingInfo: (info) => {
    set({ waitingInfo: info });
  },

  // Computed getters
  getMyPlayer: () => {
    const { gameState, myPosition } = get();
    if (!gameState || myPosition === null) return null;
    return gameState.players[myPosition] || null;
  },

  isMyTurn: () => {
    const { gameState, myPosition } = get();
    if (!gameState || myPosition === null) return false;
    
    const phase = gameState.phase;
    
    // Check if it's my turn based on current phase
    if (phase === 'BIDDING') {
      return gameState.currentBidder === myPosition;
    }
    
    if (phase === 'DECLARING_TRUMP') {
      return gameState.winningBidderPosition === myPosition;
    }
    
    if (phase === 'FOLDING_DECISION') {
      // It's my turn if I'm not the bidder and haven't folded yet
      const myPlayer = get().getMyPlayer();
      if (!myPlayer || myPlayer.position === gameState.winningBidderPosition) {
        return false;
      }
      // Player needs to make decision if not folded (folded means they already decided)
      return !myPlayer.folded;
    }
    
    if (phase === 'PLAYING') {
      return gameState.currentPlayerPosition === myPosition;
    }
    
    return false;
  },

  getPlayableCards: () => {
    const { gameState, myPosition } = get();
    if (!gameState || myPosition === null) return [];
    
    const myPlayer = get().getMyPlayer();
    if (!myPlayer || !myPlayer.hand) return [];
    
    // MVP: Return all cards in hand
    // Phase 6 will add client-side validation for follow suit rules
    return myPlayer.hand;
  },

  getCurrentPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;
    
    const phase = gameState.phase;
    let currentPosition: number | null = null;
    
    if (phase === 'BIDDING') {
      currentPosition = gameState.currentBidder;
    } else if (phase === 'DECLARING_TRUMP') {
      currentPosition = gameState.winningBidderPosition;
    } else if (phase === 'PLAYING') {
      currentPosition = gameState.currentPlayerPosition;
    }
    
    if (currentPosition === null) return null;
    return gameState.players[currentPosition] || null;
  },
}));
