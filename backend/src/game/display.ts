/**
 * @module game/display
 * @description Display state management for game UI
 * 
 * Separates display concerns from game logic state.
 * Allows showing temporary UI states (e.g., completed trick) without
 * modifying the core game state.
 */

import { GameState, Trick } from '@buck-euchre/shared';

/**
 * Display state with optional overrides for UI
 */
interface DisplayState {
  gameState: GameState;           // Actual game logic state
  displayOverrides?: {            // Temporary overrides for display
    currentTrick?: Trick;         // Show completed trick instead of empty trick
  };
  pendingTransition?: {
    to: GameState;                // State to transition to after delay
    after: number;                // Delay in ms
    onComplete?: () => Promise<void>; // Callback after transition
  };
}

/**
 * Manages display states for games
 * 
 * Handles temporary display states that differ from game logic state,
 * such as showing a completed trick for a few seconds before transitioning
 * to the next trick.
 */
export class DisplayStateManager {
  private displayStates = new Map<string, DisplayState>();
  private transitionTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Create a display state showing a completed trick
   * 
   * @param gameState - The actual game state (already transitioned)
   * @param transitionDelay - How long to show the completed trick (ms)
   * @returns Display state showing the completed trick
   */
  public createTrickCompleteDisplay(
    gameState: GameState,
    transitionDelay: number = 3000
  ): GameState {
    const completedTrick = gameState.tricks[gameState.tricks.length - 1];
    
    if (!completedTrick) {
      console.warn('[DisplayStateManager] No completed trick found, returning game state as-is');
      return gameState;
    }

    // Create display state with override
    // Keep currentPlayerPosition so frontend knows whose turn it is
    // Use same version as actual state - the transition will increment version
    // This prevents version desync between display state and actual state
    const displayState: GameState = {
      ...gameState,
      currentTrick: completedTrick, // Override: show completed trick
      // DON'T increment version here - transition will handle version increment
      // This prevents double-increment and version desync issues
      updatedAt: Date.now(), // Update timestamp
      // Keep currentPlayerPosition as-is (winner should be able to play after delay)
    };
    
    console.log(`[DisplayStateManager] Created display state for trick ${completedTrick.number}`, {
      winner: completedTrick.winner,
      currentPlayerPosition: displayState.currentPlayerPosition,
      cardsInTrick: completedTrick.cards.length,
    });

    // Store for scheduling transition
    this.displayStates.set(gameState.gameId, {
      gameState,
      displayOverrides: {
        currentTrick: completedTrick,
      },
      pendingTransition: {
        to: gameState,
        after: transitionDelay,
      },
    });

    return displayState;
  }

  /**
   * Schedule transition after delay
   * 
   * @param gameId - Game ID
   * @param callback - Function to call after delay (e.g., trigger AI, emit state)
   */
  public scheduleTransition(
    gameId: string,
    callback: () => Promise<void>
  ): void {
    const display = this.displayStates.get(gameId);
    
    if (!display?.pendingTransition) {
      console.warn(`[DisplayStateManager] No pending transition for game ${gameId}`);
      return;
    }

    // Store the original game state as fallback (before clearing)
    const fallbackState = display.gameState;

    // Clear any existing timer
    this.clearTransition(gameId);

    // Schedule the transition
    const timer = setTimeout(async () => {
      console.log(`[DisplayStateManager] Executing transition for game ${gameId}`);
      
      // Get stored state BEFORE clearing (for fallback)
      const storedState = this.displayStates.get(gameId)?.gameState || fallbackState;
      
      // Clear display state
      this.displayStates.delete(gameId);
      this.transitionTimers.delete(gameId);

      // Execute callback with access to stored state via closure
      try {
        await callback();
      } catch (error) {
        console.error(`[DisplayStateManager] Error in transition callback for game ${gameId}:`, error);
        // Don't re-throw - we've already cleared the display state
      }
    }, display.pendingTransition.after);

    this.transitionTimers.set(gameId, timer);
  }

  /**
   * Get the stored game state for a game (fallback if memory state is unavailable)
   * 
   * @param gameId - Game ID
   * @returns Stored game state, or null if not found
   */
  public getStoredState(gameId: string): GameState | null {
    const display = this.displayStates.get(gameId);
    return display?.gameState || null;
  }

  /**
   * Clear a pending transition (e.g., if game ends)
   * 
   * @param gameId - Game ID
   */
  public clearTransition(gameId: string): void {
    const timer = this.transitionTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.transitionTimers.delete(gameId);
    }
    this.displayStates.delete(gameId);
  }

  /**
   * Check if a game has a pending transition
   * 
   * @param gameId - Game ID
   * @returns True if transition is pending
   */
  public hasPendingTransition(gameId: string): boolean {
    return this.displayStates.has(gameId);
  }

  /**
   * Clean up all display states for a game (e.g., when game ends)
   * 
   * @param gameId - Game ID
   */
  public cleanup(gameId: string): void {
    this.clearTransition(gameId);
  }
}

// Singleton instance
export const displayStateManager = new DisplayStateManager();

