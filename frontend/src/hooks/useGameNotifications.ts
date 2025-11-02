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
  const shownClubsRef = useRef(false);
  const shownLetsPlayRef = useRef(false);
  const notificationQueueRef = useRef<NotificationQueue[]>([]);
  const isProcessingRef = useRef(false);

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

  useEffect(() => {
    if (!gameState || myPosition === null) {
      return;
    }

    const previousPhase = previousPhaseRef.current;
    const currentPhase = gameState.phase;

    // Reset clubs notification flag when new round starts
    if (previousRoundRef.current !== gameState.round) {
      shownClubsRef.current = false;
      previousRoundRef.current = gameState.round;
    }

    // Detect "Dirty Clubs!" - show immediately when clubs are turned up (highest priority)
    // This should show even before "Let's play!" if clubs are turned up
    if (gameState.isClubsTurnUp && !shownClubsRef.current && 
        (currentPhase === 'BIDDING' || currentPhase === 'TRUMP_REVEAL' || currentPhase === 'PLAYING')) {
      const suitSymbol = '♣';
      // Use direct call for immediate display with high priority
      showNotification(`${suitSymbol} Dirty Clubs! ${suitSymbol}`, 'special', false);
      shownClubsRef.current = true;
      
      // Wait for notification to complete (3 seconds) then clear
      setTimeout(() => {
        clearNotification();
        // Process any queued notifications after
        processQueue();
      }, 3000);
      
      // Also set shownLetsPlayRef so "Let's play!" doesn't show after this
      if (gameState.round === 1) {
        shownLetsPlayRef.current = true;
      }
      
      return; // Don't process other notifications until this one completes
    }

    // Detect game start - "Let's play!" on first round (only if clubs weren't turned up)
    if (gameState.round === 1 && !shownLetsPlayRef.current && 
        (currentPhase === 'BIDDING' || currentPhase === 'TRUMP_REVEAL')) {
      // Show notification with game start flag to disable bidding
      // Use direct call to bypass queue for immediate display
      showNotification("Let's play!", 'special', true);
      shownLetsPlayRef.current = true;
      
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

