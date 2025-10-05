/**
 * @module types/game
 * @description Core game type definitions for Buck Euchre
 * 
 * These types define the complete game state structure as specified in GAME_STATE_SPEC.md
 * All types must be serializable (no functions, DOM types, etc.)
 */

/**
 * Card suits in the game
 */
export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';

/**
 * Card ranks in the game (24-card deck)
 */
export type Rank = '9' | '10' | 'JACK' | 'QUEEN' | 'KING' | 'ACE';

/**
 * Bid amounts (or PASS)
 */
export type BidAmount = 'PASS' | 2 | 3 | 4 | 5;

/**
 * Game phase enumeration
 */
export type GamePhase =
  | 'WAITING_FOR_PLAYERS'  // Less than 4 players
  | 'DEALING'              // Cards being dealt
  | 'TRUMP_REVEAL'         // Revealing top card of blind
  | 'BIDDING'              // Bidding phase
  | 'DECLARING_TRUMP'      // Winning bidder declares trump
  | 'FOLDING_DECISION'     // Non-bidders decide to fold or stay
  | 'PLAYING'              // Playing tricks
  | 'ROUND_OVER'           // Scoring and showing results
  | 'GAME_OVER';           // Someone reached 0 or below

/**
 * Player position (0-3, clockwise)
 */
export type PlayerPosition = 0 | 1 | 2 | 3;

/**
 * Represents a playing card
 */
export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;  // Unique identifier, e.g., "SPADES_ACE"
}

/**
 * Represents a player in the game
 */
export interface Player {
  id: string;              // Unique player identifier
  name: string;            // Display name
  position: PlayerPosition; // Seat position (0 = dealer for first hand)
  score: number;           // Current score (starts at 15, race to 0)
  connected: boolean;      // Connection status
  hand: Card[];           // Cards in player's hand (5 cards)
  tricksTaken: number;    // Tricks won this round
  folded: boolean;        // Whether player folded this round
}

/**
 * Represents a card played in a trick with player info
 */
export interface PlayedCard {
  card: Card;
  playerPosition: PlayerPosition;
}

/**
 * Represents a trick (one round of cards)
 */
export interface Trick {
  number: number;                      // Trick number (1-5)
  leadPlayerPosition: PlayerPosition;  // Who led this trick
  cards: PlayedCard[];                 // Cards played in this trick
  winner: PlayerPosition | null;       // Position of winner (null if incomplete)
}

/**
 * Represents a bid made by a player
 */
export interface Bid {
  playerPosition: PlayerPosition;
  amount: BidAmount;
}

/**
 * Complete game state
 * This is the canonical state structure used by both frontend and backend
 */
export interface GameState {
  // Game Metadata
  gameId: string;
  phase: GamePhase;
  version: number;        // Version number (incremented on each state change)
  createdAt: number;      // Unix timestamp
  updatedAt: number;      // Unix timestamp
  
  // Players (always 4 players, positions 0-3)
  players: [Player, Player, Player, Player];
  
  // Round State
  round: number;          // Current round number (starts at 1)
  dealerPosition: PlayerPosition; // Current dealer (0-3)
  
  // Blind/Kitty State (for information only - not used in play)
  blind: Card[];          // 4 cards in the blind
  turnUpCard: Card | null; // Same as blind[0], revealed face-up (for info only)
  isClubsTurnUp: boolean; // If turnUpCard is a Club (no folding allowed)
  
  // Bidding State
  bids: Bid[];            // All bids made this round
  currentBidder: PlayerPosition | null;  // Position of player whose turn to bid
  highestBid: number | null;     // Current highest bid (2-5)
  winningBidderPosition: PlayerPosition | null; // Who won the bidding
  trumpSuit: Suit | null;       // Declared trump suit
  
  // Playing State
  tricks: Trick[];        // Completed tricks this round (max 5)
  currentTrick: Trick;    // Trick currently being played
  currentPlayerPosition: PlayerPosition | null; // Whose turn to play
  
  // Game End State
  winner: PlayerPosition | null;  // Position of player who reached 0 or below
  gameOver: boolean;
}

/**
 * Partial player info (for opponent hands - cards hidden)
 */
export interface PublicPlayer {
  id: string;
  name: string;
  position: PlayerPosition;
  score: number;
  connected: boolean;
  handSize: number;       // Number of cards, but not the cards themselves
  tricksTaken: number;
  folded: boolean;
}

/**
 * Game state with hidden opponent hands (sent to clients)
 */
export interface ClientGameState extends Omit<GameState, 'players'> {
  players: (Player | PublicPlayer)[];  // Mix of full player (own hand) and public players (opponents)
}

/**
 * Summary information for a game (for lobby)
 */
export interface GameSummary {
  gameId: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  playerCount: number;
  maxPlayers: 4;
  createdAt: number;
  creatorName: string;
}
