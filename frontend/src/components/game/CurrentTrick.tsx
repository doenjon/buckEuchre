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

const positionLabels = ['North', 'East', 'South', 'West'];

export function CurrentTrick({ trick, players, currentPlayerPosition }: CurrentTrickProps) {
  if (!trick || trick.cards.length === 0) {
    return (
      <div className="bg-green-700 rounded-lg p-8 flex items-center justify-center min-h-[300px]">
        <p className="text-white text-lg">Waiting for first card to be played...</p>
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

  return (
    <div className="bg-green-700 rounded-lg p-8 min-h-[300px] relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-sm mb-1">Trick #{trick.number}</p>
          <p className="text-xs">Lead: {players[trick.leadPlayerPosition]?.name || `Player ${trick.leadPlayerPosition}`}</p>
        </div>
      </div>
      
      {trick.cards.map((playedCard) => {
        const player = players[playedCard.playerPosition];
        const positionClass = cardPositions[playedCard.playerPosition];
        const isCurrentPlayer = playedCard.playerPosition === currentPlayerPosition;
        
        return (
          <div
            key={playedCard.playerPosition}
            className={`absolute ${positionClass}`}
          >
            <div className="flex flex-col items-center gap-2">
              <Card card={playedCard.card} size="medium" />
              <div className={`text-xs font-medium px-2 py-1 rounded ${isCurrentPlayer ? 'bg-yellow-400 text-gray-900' : 'bg-white text-gray-900'}`}>
                {player?.name || `P${playedCard.playerPosition}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
