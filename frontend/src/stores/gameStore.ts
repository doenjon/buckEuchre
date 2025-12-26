/**
 * @module stores/gameStore
 * @description Game state management using Zustand
 */

import { create } from 'zustand';
import type { GameState, Card, Player, CardAnalysis, BidAnalysis, FoldAnalysis, SuitAnalysis, BidAmount, Suit } from '@buck-euchre/shared';

export interface WaitingInfo {
  gameId: string;
  playerCount: number;
  playersNeeded: number;
  message?: string;
}

export interface GameNotification {
  message: string;
  type: 'success' | 'info' | 'warning' | 'special';
  persistent?: boolean; // If true, notification stays until manually cleared
  blink?: boolean; // If true, notification will blink
}

export interface GameStoreState {
  gameState: GameState | null;
  myPosition: number | null;
  nextPlayerPosition: number | null; // Set during trick completion pause to enable early analysis
  error: string | null;
  waitingInfo: WaitingInfo | null;
  currentNotification: GameNotification | null;
  isGameStartNotification: boolean; // Track if "Let's play!" is showing
  aiAnalysis: CardAnalysis[] | null; // AI analysis for current hand
  bidAnalysis: BidAnalysis[] | null; // AI analysis for bidding
  foldAnalysis: FoldAnalysis[] | null; // AI analysis for fold decisions
  suitAnalysis: SuitAnalysis[] | null; // AI analysis for trump suit selection
}

export interface GameStoreActions {
  setGameState: (state: GameState) => void;
  setMyPosition: (position: number) => void;
  setNextPlayerPosition: (position: number | null) => void;
  setError: (error: string | null) => void;
  clearGame: () => void;
  setWaitingInfo: (info: WaitingInfo | null) => void;
  showNotification: (message: string, type: GameNotification['type'], options?: { isGameStart?: boolean; persistent?: boolean; blink?: boolean }) => void;
  clearNotification: () => void;
  setAIAnalysis: (analysis: CardAnalysis[] | null) => void;
  setBidAnalysis: (analysis: BidAnalysis[] | null) => void;
  setFoldAnalysis: (analysis: FoldAnalysis[] | null) => void;
  setSuitAnalysis: (analysis: SuitAnalysis[] | null) => void;

  // Computed getters (selectors)
  getMyPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getPlayableCards: () => Card[];
  getCurrentPlayer: () => Player | null;
  getCardAnalysis: (cardId: string) => CardAnalysis | null;
  getBidAnalysis: (bidAmount: BidAmount) => BidAnalysis | null;
  getFoldAnalysis: (fold: boolean) => FoldAnalysis | null;
  getSuitAnalysis: (suit: Suit) => SuitAnalysis | null;
}

export type GameStore = GameStoreState & GameStoreActions;

const initialState: GameStoreState = {
  gameState: null,
  myPosition: null,
  nextPlayerPosition: null,
  error: null,
  waitingInfo: null,
  currentNotification: null,
  isGameStartNotification: false,
  aiAnalysis: null,
  bidAnalysis: null,
  foldAnalysis: null,
  suitAnalysis: null,
};

/**
 * Game state store
 */
export const useGameStore = create<GameStore>()((set, get) => ({
  ...initialState,

  setGameState: (gameState) => {
    const currentState = get().gameState;
    const currentPosition = get().myPosition;

    // If switching to a different game, reset myPosition to prevent stale data
    if (currentState && currentState.gameId !== gameState.gameId) {
      console.log('[GameStore] Switching games, resetting myPosition', {
        oldGameId: currentState.gameId,
        newGameId: gameState.gameId,
        oldPosition: currentPosition
      });
      set({ gameState, myPosition: null, nextPlayerPosition: null, error: null, waitingInfo: null });
    } else {
      // Clear nextPlayerPosition when new state arrives (trick pause is over)
      set({ gameState, nextPlayerPosition: null, error: null, waitingInfo: null });
    }
  },

  setMyPosition: (position) => {
    set({ myPosition: position });
  },

  setNextPlayerPosition: (position) => {
    set({ nextPlayerPosition: position });
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

  showNotification: (message: string, type: GameNotification['type'], options: { isGameStart?: boolean; persistent?: boolean; blink?: boolean } = {}) => {
    const { isGameStart = false, persistent = false, blink = false } = options;
    set({
      currentNotification: { message, type, persistent, blink },
      isGameStartNotification: isGameStart,
    });
  },

  clearNotification: () => {
    set({
      currentNotification: null,
      isGameStartNotification: false,
    });
  },

  setAIAnalysis: (analysis) => {
    set({ aiAnalysis: analysis });
  },

  setBidAnalysis: (analysis) => {
    set({ bidAnalysis: analysis });
  },

  setFoldAnalysis: (analysis) => {
    set({ foldAnalysis: analysis });
  },

  setSuitAnalysis: (analysis) => {
    set({ suitAnalysis: analysis });
  },

  // Computed getters
  getMyPlayer: () => {
    const { gameState, myPosition } = get();
    if (!gameState || myPosition === null) return null;
    return gameState.players.find(player => player.position === myPosition) || null;
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
      // It's my turn if I'm not the bidder and haven't made a decision yet
      const myPlayer = get().getMyPlayer();
      if (!myPlayer || myPlayer.position === gameState.winningBidderPosition) {
        return false;
      }
      // Player needs to decide if their foldDecision is still undecided
      return myPlayer.foldDecision === 'UNDECIDED';
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
    } else if (phase === 'FOLDING_DECISION') {
      currentPosition = gameState.players.findIndex((player, index) => {
        return (
          index !== gameState.winningBidderPosition &&
          player.foldDecision === 'UNDECIDED'
        );
      });
      if (currentPosition === -1) {
        currentPosition = null;
      }
    } else if (phase === 'PLAYING') {
      currentPosition = gameState.currentPlayerPosition;
    }

    if (currentPosition === null) return null;
    return gameState.players.find(player => player.position === currentPosition) || null;
  },

  getCardAnalysis: (cardId: string) => {
    const { aiAnalysis } = get();
    if (!aiAnalysis) return null;
    return aiAnalysis.find(a => a.cardId === cardId) || null;
  },

  getBidAnalysis: (bidAmount: BidAmount) => {
    const { bidAnalysis } = get();
    if (!bidAnalysis) return null;
    return bidAnalysis.find(a => a.bidAmount === bidAmount) || null;
  },

  getFoldAnalysis: (fold: boolean) => {
    const { foldAnalysis } = get();
    if (!foldAnalysis) return null;
    return foldAnalysis.find(a => a.fold === fold) || null;
  },

  getSuitAnalysis: (suit: Suit) => {
    const { suitAnalysis } = get();
    if (!suitAnalysis) return null;
    return suitAnalysis.find(a => a.suit === suit) || null;
  },
}));
