/**
 * @module components/game/GameBoard
 * @description Main game board component
 */

import { Scoreboard } from './Scoreboard';
import { TurnIndicator } from './TurnIndicator';
import { CurrentTrick } from './CurrentTrick';
import { PlayerHand } from './PlayerHand';
import { BiddingPanel } from './BiddingPanel';
import { TrumpSelector } from './TrumpSelector';
import { FoldDecision } from './FoldDecision';
import { WaitingForPlayers } from './WaitingForPlayers';
import { useGame } from '@/hooks/useGame';
import type { GameState } from '@buck-euchre/shared';

interface GameBoardProps {
  gameState: GameState;
  myPosition: number;
}

export function GameBoard({ gameState, myPosition }: GameBoardProps) {
  const { phase, currentPlayerPosition, currentBidder, players } = gameState;
  const { playCard } = useGame();

  // Wait for all players
  if (phase === 'WAITING_FOR_PLAYERS' || players.length < 4) {
    return (
      <WaitingForPlayers 
        gameId={gameState.gameId}
        playerCount={players.length}
        playersNeeded={4}
      />
    );
  }

  const myPlayer = players[myPosition];
  
  // Determine whose turn it is based on the phase
  let isMyTurn = false;
  let activePosition: number | null = null;
  
  switch (phase) {
    case 'BIDDING':
      activePosition = currentBidder;
      isMyTurn = currentBidder === myPosition;
      break;
    case 'DECLARING_TRUMP':
      activePosition = gameState.winningBidderPosition;
      isMyTurn = gameState.winningBidderPosition === myPosition;
      break;
    case 'FOLDING_DECISION':
      // In folding phase, player acts if they haven't decided yet and aren't the bidder
      if (
        gameState.winningBidderPosition !== myPosition &&
        myPlayer.foldDecision === 'UNDECIDED'
      ) {
        isMyTurn = true;
      }
      activePosition = null; // Multiple players can act
      break;
    case 'PLAYING':
      activePosition = currentPlayerPosition;
      isMyTurn = currentPlayerPosition === myPosition;
      break;
    case 'ROUND_OVER':
      activePosition = gameState.currentTrick?.winner ?? null;
      isMyTurn = false;
      break;
    default:
      activePosition = null;
      isMyTurn = false;
  }

  const currentPlayer = activePosition !== null ? players[activePosition] : null;
  const completedTrick =
    gameState.tricks.length > 0
      ? gameState.tricks[gameState.tricks.length - 1]
      : null;
  const displayTrick =
    gameState.currentTrick && gameState.currentTrick.cards.length > 0
      ? gameState.currentTrick
      : completedTrick;
  const showCurrentTrick = !!displayTrick && displayTrick.cards.length > 0;
  const trickHighlightPosition =
    activePosition !== null
      ? activePosition
      : displayTrick?.cards[displayTrick.cards.length - 1]?.playerPosition ?? 0;

  return (
    <div className="space-y-6">
      {/* Scoreboard */}
      <Scoreboard 
        players={players} 
        currentPlayerPosition={activePosition}
        phase={phase}
        trumpSuit={gameState.trumpSuit}
        winningBidderPosition={gameState.winningBidderPosition}
      />

      {/* Turn Indicator */}
      {currentPlayer && (
        <TurnIndicator 
          currentPlayer={currentPlayer}
          isMyTurn={isMyTurn}
          phase={phase}
        />
      )}

      {/* Game Info */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600">Phase</p>
            <p className="font-semibold">{phase}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Round</p>
            <p className="font-semibold">{gameState.round}</p>
          </div>
          {gameState.trumpSuit && (
            <div>
              <p className="text-sm text-gray-600">Trump</p>
              <p className="font-semibold">{gameState.trumpSuit}</p>
            </div>
          )}
          {gameState.highestBid !== null && (
            <div>
              <p className="text-sm text-gray-600">Highest Bid</p>
              <p className="font-semibold">{gameState.highestBid}</p>
            </div>
          )}
        </div>
      </div>

      {/* Phase-specific UI */}
      {phase === 'BIDDING' && (
        <BiddingPanel 
          currentBid={gameState.highestBid}
          isMyTurn={isMyTurn}
        />
      )}

      {phase === 'DECLARING_TRUMP' && (
        <TrumpSelector 
          isMyTurn={gameState.winningBidderPosition === myPosition}
        />
      )}

      {phase === 'FOLDING_DECISION' && gameState.winningBidderPosition !== myPosition && (
        <FoldDecision 
          gameState={gameState}
          myPosition={myPosition}
          isMyTurn={isMyTurn}
        />
      )}

      {/* Current Trick */}
      {showCurrentTrick && (
        <CurrentTrick 
          trick={displayTrick}
          players={players}
          currentPlayerPosition={trickHighlightPosition}
        />
      )}

      {/* Player's Hand */}
      {myPlayer.folded !== true && (
        <PlayerHand 
          cards={myPlayer.hand}
          onCardClick={isMyTurn && phase === 'PLAYING' ? playCard : undefined}
          disabled={!isMyTurn || phase !== 'PLAYING'}
        />
      )}

      {myPlayer.folded === true && (
        <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-8 text-center">
          <p className="text-xl font-semibold text-gray-600">
            You have folded this round
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Watch the other players complete the hand
          </p>
        </div>
      )}

      {/* Game Over */}
      {phase === 'GAME_OVER' && gameState.winner !== null && (
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg shadow-xl p-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">🎉 Game Over! 🎉</h2>
          <p className="text-2xl text-white">
            Winner: <span className="font-bold">{players[gameState.winner].name}</span>
          </p>
          <p className="text-lg text-white mt-2">
            Final Score: {players[gameState.winner].score}
          </p>
        </div>
      )}
    </div>
  );
}
