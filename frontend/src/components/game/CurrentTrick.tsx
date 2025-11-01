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
  myPosition: number;
}

export function CurrentTrick({
  trick,
  myPosition
}: CurrentTrickProps) {
  if (!trick || trick.cards.length === 0) {
    return (
      <div
        className="flex w-full h-full items-center justify-center rounded-[30%] md:rounded-full border border-white/10 bg-gradient-to-br from-emerald-950/90 via-emerald-900/80 to-emerald-800/60 shadow-lg md:shadow-2xl backdrop-blur"
        role="region"
        aria-label="Current trick area - waiting for lead card"
      />
    );
  }

  // Arrange cards around the stadium-shaped poker table
  // Cards positioned at edges of table, accounting for card size
  const cardPositions = [
    'bottom-[5%] left-1/2 -translate-x-1/2', // South (you) - slightly above bottom edge
    'left-[5%] top-1/2 -translate-y-1/2', // Seat to your left - slightly in from left edge
    'top-[5%] left-1/2 -translate-x-1/2', // Across from you - slightly below top edge
    'right-[5%] top-1/2 -translate-y-1/2' // Seat to your right - slightly in from right edge
  ];

  return (
    <div
      className="relative flex w-full h-full items-center justify-center overflow-visible rounded-[30%] md:rounded-full border border-white/10 bg-gradient-to-br from-emerald-950/90 via-emerald-900/80 to-emerald-800/60 shadow-lg md:shadow-[0_30px_80px_-40px_rgba(16,185,129,0.9)] backdrop-blur"
      role="region"
      aria-label={`Trick ${trick.number}, ${trick.cards.length} of 4 cards played`}
    >
      {/* Glow effect in center */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-900/60 blur-3xl" />

      {trick.cards.map((playedCard, index) => {
        const relativeSeatIndex =
          ((playedCard.playerPosition - myPosition) % 4 + 4) % 4;
        const positionClass = cardPositions[relativeSeatIndex];
        const isWinner = trick.winner === playedCard.playerPosition;
        
        return (
          <div
            key={playedCard.playerPosition}
            className={`
              absolute ${positionClass} z-10
              flex flex-col items-center transition-transform duration-500
              ${isWinner ? 'scale-110 drop-shadow-[0_10px_20px_rgba(250,204,21,0.35)]' : ''}
            `}
            style={{ animationDelay: `${index * 150}ms`, opacity: 1 }}
          >
            <div className={`${isWinner ? 'rounded-lg md:rounded-2xl ring-2 md:ring-4 ring-emerald-300/60' : 'drop-shadow-[0_15px_25px_rgba(16,185,129,0.35)]'}`} style={{ opacity: 1 }}>
              <Card card={playedCard.card} size="small" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
