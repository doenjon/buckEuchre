/**
 * @module hooks/useGameNotifications
 * @description Hook to detect game events and trigger notifications
 */

import { useEffect, useRef } from 'react';
import type { GameState, GamePhase } from '@buck-euchre/shared';
import { useGameStore } from '@/stores/gameStore';

interface NotificationQueue {
  message: string;
  type: 'success' | 'info' | 'warning' | 'special';
  priority: number;
}

export function useGameNotifications(gameState: GameState | null, myPosition: number | null) {
  const showNotification = useGameStore((state) => state.showNotification);
  const clearNotification = useGameStore((state) => state.clearNotification);

  const previousPhaseRef = useRef<GamePhase | null>(null);
  const previousTrumpSuitRef = useRef<GameState['trumpSuit']>(null);
  const previousWinnerRef = useRef<GameState['winner']>(null);
  const previousRoundRef = useRef<number>(0);
  const notificationQueueRef = useRef<NotificationQueue[]>([]);
  const isProcessingRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const previousCurrentPlayerRef = useRef<number | null>(null);

  // Helper to check if we've shown a notification for a specific game/round
  // Use sessionStorage to persist across component remounts (e.g., during reconnections)
  const hasShownNotification = (key: string): boolean => {
    try {
      return sessionStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  };

  const markNotificationShown = (key: string): void => {
    try {
      sessionStorage.setItem(key, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  // Process notification queue
  const processQueue = () => {
    if (isProcessingRef.current || notificationQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    
    // Sort by priority (higher first)
    notificationQueueRef.current.sort((a, b) => b.priority - a.priority);
    
    const next = notificationQueueRef.current.shift();
    if (next) {
      showNotification(next.message, next.type);
      
      // Wait for notification to clear before showing next
      setTimeout(() => {
        clearNotification();
        isProcessingRef.current = false;
        processQueue(); // Process next in queue
      }, 3000);
    } else {
      isProcessingRef.current = false;
    }
  };

  // Add to queue
  const queueNotification = (message: string, type: NotificationQueue['type'], priority: number) => {
    notificationQueueRef.current.push({ message, type, priority });
    processQueue();
  };

  // Handle inactivity alert during PLAYING phase
  useEffect(() => {
    // Clear any existing timer
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (!gameState || myPosition === null) {
      return;
    }

    // Check if it's my turn during PLAYING phase
    const isMyTurn = gameState.phase === 'PLAYING' &&
                     gameState.currentPlayerPosition === myPosition;

    // If it was my turn but no longer is, clear the notification
    const wasMyTurn = previousCurrentPlayerRef.current === myPosition;
    if (wasMyTurn && !isMyTurn) {
      clearNotification();
    }

    // Track the current player
    previousCurrentPlayerRef.current = gameState.currentPlayerPosition;

    if (isMyTurn) {
      // Start a 5-second timer for inactivity alert
      inactivityTimerRef.current = window.setTimeout(() => {
        // Show persistent blinking notification
        showNotification('Your turn!', 'info', { persistent: true, blink: true });
      }, 5000);
    }

    // Cleanup function
    return () => {
      if (inactivityTimerRef.current !== null) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [gameState?.phase, gameState?.currentPlayerPosition, myPosition, showNotification, clearNotification]);

  useEffect(() => {
    if (!gameState || myPosition === null) {
      return;
    }

    const previousPhase = previousPhaseRef.current;
    const currentPhase = gameState.phase;

    // Reset round tracking when new round starts
    if (previousRoundRef.current !== gameState.round) {
      previousRoundRef.current = gameState.round;
    }

    // Generate notification keys for this game/round
    const letsPlayKey = `lets-play-${gameState.gameId}`;
    const clubsKey = `dirty-clubs-${gameState.gameId}-${gameState.round}`;

    // Safety: Clear any lingering isGameStartNotification flag if we've already shown "Let's play!"
    // This handles cases where the notification was shown but the timeout didn't complete
    if (hasShownNotification(letsPlayKey)) {
      const gameStore = useGameStore.getState();
      if (gameStore.isGameStartNotification) {
        clearNotification();
      }
    }

    // Detect "Dirty Clubs!" - show immediately when clubs are turned up (highest priority)
    // This should show even before "Let's play!" if clubs are turned up
    if (gameState.isClubsTurnUp && !hasShownNotification(clubsKey) &&
        (currentPhase === 'BIDDING' || currentPhase === 'TRUMP_REVEAL' || currentPhase === 'PLAYING')) {
      const suitSymbol = '♣';
      // Use direct call for immediate display with high priority
      showNotification(`${suitSymbol} Dirty Clubs! ${suitSymbol}`, 'special', { isGameStart: false });
      markNotificationShown(clubsKey);

      // Wait for notification to complete (3 seconds) then clear
      setTimeout(() => {
        clearNotification();
        // Process any queued notifications after
        processQueue();
      }, 3000);

      // Also mark "Let's play!" as shown so it doesn't show after this
      if (gameState.round === 1) {
        markNotificationShown(letsPlayKey);
      }

      return; // Don't process other notifications until this one completes
    }

    // Detect game start - "Let's play!" on first round (only if clubs weren't turned up)
    if (gameState.round === 1 && !hasShownNotification(letsPlayKey) &&
        (currentPhase === 'BIDDING' || currentPhase === 'TRUMP_REVEAL')) {
      // Show notification with game start flag to disable bidding
      // Use direct call to bypass queue for immediate display
      showNotification("Let's play!", 'special', { isGameStart: true });
      markNotificationShown(letsPlayKey);

      // Wait for notification to complete (3 seconds) then clear
      setTimeout(() => {
        clearNotification();
        // Process any queued notifications after
        processQueue();
      }, 3000);

      return; // Don't process other notifications until this one completes
    }

    // Detect trump declared - show when trump is first set
    // Since notification is positioned above cards now, it won't overlap with fold decision box
    if (previousTrumpSuitRef.current === null && gameState.trumpSuit !== null) {
      const suitSymbols: Record<string, string> = {
        SPADES: '♠',
        HEARTS: '♥',
        DIAMONDS: '♦',
        CLUBS: '♣',
      };
      const symbol = suitSymbols[gameState.trumpSuit];
      queueNotification(`Trump is ${symbol}`, 'info', 3);
    }

    // Detect round over events
    if (previousPhase !== 'ROUND_OVER' && currentPhase === 'ROUND_OVER') {
      const myPlayer = gameState.players.find(p => p.position === myPosition);
      const bidder = gameState.players.find(p => p.position === gameState.winningBidderPosition);
      
      if (myPlayer && bidder && gameState.highestBid !== null) {
        // Check if anyone took all 5 tricks
        const anyoneGotAll5 = gameState.players.some(p => p.tricksTaken === 5);
        
        if (anyoneGotAll5) {
          const all5Player = gameState.players.find(p => p.tricksTaken === 5);
          if (all5Player?.position === myPosition) {
            queueNotification('All 5 Tricks!', 'success', 4);
          } else {
            queueNotification(`All 5 Tricks! (${all5Player?.name})`, 'info', 4);
          }
        }
        // Check if I was the bidder
        else if (myPlayer.position === gameState.winningBidderPosition) {
          if (myPlayer.tricksTaken >= gameState.highestBid) {
            queueNotification('Made it!', 'success', 4);
          } else {
            queueNotification('Bucked!', 'warning', 4);
          }
        }
        // Check if I stayed in and took no tricks
        else if (!myPlayer.folded && myPlayer.tricksTaken === 0) {
          queueNotification('Bucked!', 'warning', 4);
        }
        // Check if I took tricks
        else if (!myPlayer.folded && myPlayer.tricksTaken > 0) {
          // Could add a positive message here if desired
        }
      }
    }

    // Detect game over
    if (previousWinnerRef.current === null && gameState.winner !== null && currentPhase === 'GAME_OVER') {
      const winner = gameState.players.find(p => p.position === gameState.winner);
      
      if (gameState.winner === myPosition) {
        queueNotification('You Won!', 'success', 5);
      } else if (winner) {
        queueNotification(`${winner.name} Wins!`, 'info', 5);
      } else {
        queueNotification('Game Over', 'info', 5);
      }
    }

    // Update refs
    previousPhaseRef.current = currentPhase;
    previousTrumpSuitRef.current = gameState.trumpSuit;
    previousWinnerRef.current = gameState.winner;
  }, [gameState, myPosition, showNotification, clearNotification]);
}

