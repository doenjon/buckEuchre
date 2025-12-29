/**
 * @module ai/ismcts/determinize
 * @description Determinization system for ISMCTS
 *
 * Handles sampling possible opponent hands consistent with observations.
 * In imperfect information games, we must sample what opponents might hold
 * and run MCTS on each sampled "world".
 */

import { GameState, Card, Suit, PlayerPosition, FULL_DECK } from '@buck-euchre/shared';
import { getEffectiveSuit } from '../../game/deck.js';

/**
 * Observations we've gathered about the game state
 */
export interface Observations {
  /** All cards that have been played and are visible */
  playedCards: Set<string>;

  /** Known void suits for each player (didn't follow when they could have) */
  playerVoids: Map<PlayerPosition, Set<Suit>>;

  /** Cards in my hand */
  myHand: Set<string>;
}

/**
 * Extract observations from current game state
 *
 * @param gameState - Current game state
 * @param myPosition - Our player position
 * @returns Observations about cards and player voids
 */
export function extractObservations(
  gameState: GameState,
  myPosition: PlayerPosition
): Observations {
  const observations: Observations = {
    playedCards: new Set(),
    playerVoids: new Map(),
    myHand: new Set(),
  };

  // Initialize void tracking for all players
  for (let i = 0; i < 4; i++) {
    observations.playerVoids.set(i as PlayerPosition, new Set());
  }

  // Track our own hand
  const myPlayer = gameState.players[myPosition];
  for (const card of myPlayer.hand) {
    observations.myHand.add(card.id);
  }

  // Note: We do NOT track blind cards - those are hidden information
  // The AI should not know which specific cards are in the blind

  // Track played cards from completed tricks
  for (const trick of gameState.tricks) {
    // Get the led suit from the first card in the trick
    const ledSuit = trick.cards.length > 0 && gameState.trumpSuit
      ? getEffectiveSuit(trick.cards[0].card, gameState.trumpSuit)
      : null;

    for (const playedCard of trick.cards) {
      observations.playedCards.add(playedCard.card.id);

      // Check for void reveals
      if (gameState.trumpSuit && ledSuit) {
        const effectiveSuit = getEffectiveSuit(playedCard.card, gameState.trumpSuit);

        // If player didn't follow led suit, they're void in it
        // This includes both playing trump on a non-trump lead and playing off-suit
        if (effectiveSuit !== ledSuit) {
          const playerVoids = observations.playerVoids.get(playedCard.playerPosition);
          if (playerVoids) {
            playerVoids.add(ledSuit as Suit);
          }
        }
      }
    }
  }

  // Track cards from current trick
  if (gameState.currentTrick && gameState.currentTrick.cards.length > 0) {
    // Get the led suit from the first card in the current trick
    const currentLedSuit = gameState.trumpSuit
      ? getEffectiveSuit(gameState.currentTrick.cards[0].card, gameState.trumpSuit)
      : null;

    for (const playedCard of gameState.currentTrick.cards) {
      observations.playedCards.add(playedCard.card.id);

      // Check for void reveals in current trick
      if (gameState.trumpSuit && currentLedSuit) {
        const effectiveSuit = getEffectiveSuit(playedCard.card, gameState.trumpSuit);

        // If player didn't follow led suit, they're void in it
        // This includes both playing trump on a non-trump lead and playing off-suit
        if (effectiveSuit !== currentLedSuit) {
          const playerVoids = observations.playerVoids.get(playedCard.playerPosition);
          if (playerVoids) {
            playerVoids.add(currentLedSuit as Suit);
          }
        }
      }
    }
  }

  return observations;
}

/**
 * Get all cards that are unknown (not seen yet)
 *
 * @param observations - Current observations
 * @returns Array of unseen cards
 */
function getUnseenCards(observations: Observations): Card[] {
  const unseenCards: Card[] = [];

  for (const card of FULL_DECK) {
    // Skip if we've seen this card
    // Note: Blind cards are NOT excluded - they're hidden information that could be
    // in opponent hands OR in the blind. This is correct for imperfect information MCTS.
    if (
      observations.playedCards.has(card.id) ||
      observations.myHand.has(card.id)
    ) {
      continue;
    }

    unseenCards.push(card);
  }

  return unseenCards;
}

/**
 * Shuffle an array in place (Fisher-Yates)
 *
 * @param array - Array to shuffle
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Check if a card assignment is valid given constraints
 *
 * @param card - Card to assign
 * @param playerPosition - Player to assign to
 * @param observations - Current observations
 * @param gameState - Game state (for trump info)
 * @returns True if valid assignment
 */
function isValidAssignment(
  card: Card,
  playerPosition: PlayerPosition,
  observations: Observations,
  gameState: GameState
): boolean {
  const playerVoids = observations.playerVoids.get(playerPosition);
  if (!playerVoids) return true;

  // If player is void in a suit, they can't have cards of that suit
  const trumpSuit = gameState.trumpSuit;
  if (!trumpSuit) return true; // No constraints before trump declared

  const effectiveSuit = getEffectiveSuit(card, trumpSuit);

  // Check if player is void in this suit
  return !playerVoids.has(effectiveSuit as Suit);
}

/**
 * Sample opponent hands consistent with observations
 *
 * This is a simple uniform sampling approach. Future versions can weight
 * by bidding behavior or other signals.
 *
 * @param gameState - Current game state
 * @param myPosition - Our player position
 * @param observations - Current observations
 * @returns Cloned game state with sampled opponent hands
 */
export function sampleOpponentHands(
  gameState: GameState,
  myPosition: PlayerPosition,
  observations: Observations
): GameState {
  // Clone the game state
  const clonedState = JSON.parse(JSON.stringify(gameState)) as GameState;

  // Get unseen cards
  const unseenCards = getUnseenCards(observations);
  shuffleArray(unseenCards);

  // Determine how many cards each opponent should have
  const opponentHandSizes: Map<PlayerPosition, number> = new Map();

  for (let pos = 0; pos < 4; pos++) {
    if (pos === myPosition) continue;

    const player = gameState.players[pos];
    const handSize = player.folded ? 0 : player.hand.length;
    opponentHandSizes.set(pos as PlayerPosition, handSize);
  }

  // Simple assignment: deal cards to opponents in order
  // v1: Ignore void constraints for simplicity (can improve later)
  let cardIndex = 0;

  for (let pos = 0; pos < 4; pos++) {
    if (pos === myPosition) continue;

    const playerPosition = pos as PlayerPosition;
    const handSize = opponentHandSizes.get(playerPosition) || 0;
    const newHand: Card[] = [];

    for (let i = 0; i < handSize; i++) {
      if (cardIndex >= unseenCards.length) {
        // Shouldn't happen, but fallback
        console.warn('[ISMCTS] Ran out of cards during determinization');
        break;
      }

      // v1: Simple assignment
      // v2: Could check void constraints here
      newHand.push(unseenCards[cardIndex]);
      cardIndex++;
    }

    clonedState.players[playerPosition].hand = newHand;
  }

  return clonedState;
}

/**
 * Sample opponent hands with void constraint checking
 *
 * Uses a constraint satisfaction approach to ensure sampled hands
 * respect known void suits. Falls back to simple sampling if
 * constraints cannot be satisfied.
 *
 * @param gameState - Current game state
 * @param myPosition - Our player position
 * @param observations - Current observations including void constraints
 * @returns Cloned game state with sampled opponent hands
 */
export function sampleOpponentHandsWithConstraints(
  gameState: GameState,
  myPosition: PlayerPosition,
  observations: Observations
): GameState {
  // Reduced from 100 to 3 attempts to prevent excessive CPU usage
  // The greedy algorithm rarely succeeds if it fails on first few attempts
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = trySampleWithConstraints(gameState, myPosition, observations);
    if (result) {
      return result;
    }
  }

  // If we couldn't satisfy constraints after MAX_ATTEMPTS, fall back to simple sampling
  // This is expected and not an error - void constraints from imperfect information can be over-restrictive
  return sampleOpponentHands(gameState, myPosition, observations);
}

/**
 * Attempt to sample opponent hands respecting void constraints
 *
 * @returns GameState if successful, null if constraints cannot be satisfied
 */
function trySampleWithConstraints(
  gameState: GameState,
  myPosition: PlayerPosition,
  observations: Observations
): GameState | null {
  // Clone the game state
  const clonedState = JSON.parse(JSON.stringify(gameState)) as GameState;

  // Get unseen cards and shuffle
  const unseenCards = getUnseenCards(observations);
  shuffleArray(unseenCards);

  // Determine how many cards each opponent should have
  const opponentPositions: PlayerPosition[] = [];
  const opponentHandSizes: Map<PlayerPosition, number> = new Map();

  for (let pos = 0; pos < 4; pos++) {
    if (pos === myPosition) continue;

    const player = gameState.players[pos];
    const handSize = player.folded ? 0 : player.hand.length;

    if (handSize > 0) {
      const playerPosition = pos as PlayerPosition;
      opponentPositions.push(playerPosition);
      opponentHandSizes.set(playerPosition, handSize);
    }
  }

  // Track which cards have been assigned
  const availableCards = [...unseenCards];
  const assignedHands: Map<PlayerPosition, Card[]> = new Map();

  // Initialize empty hands for all opponents
  for (const pos of opponentPositions) {
    assignedHands.set(pos, []);
  }

  // Try to assign cards to each opponent
  for (const playerPosition of opponentPositions) {
    const handSize = opponentHandSizes.get(playerPosition) || 0;
    const hand = assignedHands.get(playerPosition)!;

    // Partition available cards into valid and invalid
    const validCards: Card[] = [];
    const invalidCards: Card[] = [];

    for (const card of availableCards) {
      if (isValidAssignment(card, playerPosition, observations, gameState)) {
        validCards.push(card);
      } else {
        invalidCards.push(card);
      }
    }

    // If we don't have enough valid cards, this attempt fails
    if (validCards.length < handSize) {
      return null;
    }

    // Assign valid cards to this player
    for (let i = 0; i < handSize; i++) {
      hand.push(validCards[i]);
    }

    // Update available cards (remove assigned valid cards, keep invalid ones)
    availableCards.length = 0;
    availableCards.push(...validCards.slice(handSize), ...invalidCards);
  }

  // Apply assigned hands to cloned state
  for (const [playerPosition, hand] of assignedHands.entries()) {
    clonedState.players[playerPosition].hand = hand;
  }

  return clonedState;
}

/**
 * Create a determinized version of the game state
 *
 * Main entry point for determinization.
 *
 * @param gameState - Current game state
 * @param myPosition - Our player position
 * @returns Determinized game state
 */
export function determinize(
  gameState: GameState,
  myPosition: PlayerPosition
): GameState {
  const observations = extractObservations(gameState, myPosition);
  return sampleOpponentHandsWithConstraints(gameState, myPosition, observations);
}
