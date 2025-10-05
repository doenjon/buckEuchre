/**
 * @module components/game/CurrentTrick
 * @description Display cards played in current trick
 */

import type { Trick, Player } from '@buck-euchre/shared';
import { Card } from './Card';

export interface CurrentTrickProps {
  trick: Trick | null;
  players: Player[];
  currentPlayerPosition: number;
}

export function CurrentTrick({ trick, players, currentPlayerPosition }: CurrentTrickProps) {
  if (!trick || trick.cards.length === 0) {
    return (
      <div 
        className="bg-green-700 rounded-lg p-8 flex items-center justify-center min-h-[300px] shadow-lg"
        role="region"
        aria-label="Current trick area"
      >
        <p className="text-white text-lg animate-pulse">Waiting for first card to be played...</p>
      </div>
    );
  }

  // Arrange cards in a circle around the center
  const cardPositions = [
    'top-4 left-1/2 -translate-x-1/2',      // North (0)
    'right-4 top-1/2 -translate-y-1/2',     // East (1)
    'bottom-4 left-1/2 -translate-x-1/2',   // South (2)
    'left-4 top-1/2 -translate-y-1/2',      // West (3)
  ];

  const winner = trick.winner !== null ? players[trick.winner] : null;

  return (
    <div 
      className="bg-gradient-to-br from-green-700 to-green-800 rounded-lg p-4 sm:p-8 min-h-[300px] relative shadow-xl"
      role="region"
      aria-label={`Trick ${trick.number}, ${trick.cards.length} of 4 cards played`}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-white text-center animate-in fade-in duration-500">
          <p className="text-sm sm:text-base mb-1 font-semibold">Trick #{trick.number}</p>
          <p className="text-xs sm:text-sm opacity-90">
            Lead: {players[trick.leadPlayerPosition]?.name || `Player ${trick.leadPlayerPosition}`}
          </p>
          {winner && (
            <p className="text-xs sm:text-sm mt-2 font-bold text-yellow-300 animate-bounce">
              Winner: {winner.name}!
            </p>
          )}
        </div>
      </div>
      
      {trick.cards.map((playedCard, index) => {
        const player = players[playedCard.playerPosition];
        const positionClass = cardPositions[playedCard.playerPosition];
        const isCurrentPlayer = playedCard.playerPosition === currentPlayerPosition;
        const isWinner = trick.winner === playedCard.playerPosition;
        
        return (
          <div
            key={playedCard.playerPosition}
            className={`
              absolute ${positionClass}
              animate-in slide-in-from-bottom-10 fade-in duration-500
              ${isWinner ? 'animate-pulse' : ''}
            `}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`${isWinner ? 'ring-4 ring-yellow-400 rounded-lg' : ''}`}>
                <Card card={playedCard.card} size="medium" />
              </div>
              <div 
                className={`
                  text-xs font-medium px-2 py-1 rounded shadow-md transition-all duration-300
                  ${isCurrentPlayer ? 'bg-yellow-400 text-gray-900 ring-2 ring-yellow-500' : 'bg-white text-gray-900'}
                  ${isWinner ? 'bg-green-500 text-white' : ''}
                `}
              >
                {player?.name || `P${playedCard.playerPosition}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
