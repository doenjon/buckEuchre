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
  players,
  currentPlayerPosition,
  myPosition
}: CurrentTrickProps) {
  if (!trick || trick.cards.length === 0) {
    return (
      <div
        className="flex min-h-[320px] items-center justify-center rounded-[32px] border border-white/10 bg-gradient-to-br from-emerald-950/90 via-emerald-900/80 to-emerald-800/60 p-8 shadow-2xl backdrop-blur"
        role="region"
        aria-label="Current trick area"
      >
        <p className="text-sm font-medium uppercase tracking-[0.35em] text-emerald-100/70">
          Waiting for the lead card…
        </p>
      </div>
    );
  }

  // Arrange cards around the center with the local player seated at the bottom
  const cardPositions = [
    'bottom-6 left-1/2 -translate-x-1/2', // South (you)
    'left-6 top-1/2 -translate-y-1/2', // Seat to your left
    'top-6 left-1/2 -translate-x-1/2', // Across from you
    'right-6 top-1/2 -translate-y-1/2' // Seat to your right
  ];

  const winner = trick.winner !== null ? players[trick.winner] : null;

  return (
    <div
      className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-emerald-950/90 via-emerald-900/80 to-emerald-800/60 p-6 shadow-[0_30px_80px_-40px_rgba(16,185,129,0.9)] backdrop-blur"
      role="region"
      aria-label={`Trick ${trick.number}, ${trick.cards.length} of 4 cards played`}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center text-emerald-100/80">
          <span className="text-xs uppercase tracking-[0.4em]">Trick {trick.number}</span>
          <span className="text-sm font-medium">
            Lead • {players[trick.leadPlayerPosition]?.name || `Player ${trick.leadPlayerPosition}`}
          </span>
          {winner && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
              Winner {winner.name}
            </span>
          )}
        </div>
      </div>

      {trick.cards.map((playedCard, index) => {
        const player = players[playedCard.playerPosition];
        const relativeSeatIndex =
          ((playedCard.playerPosition - myPosition) % 4 + 4) % 4;
        const positionClass = cardPositions[relativeSeatIndex];
        const isCurrentPlayer = playedCard.playerPosition === currentPlayerPosition;
        const isWinner = trick.winner === playedCard.playerPosition;
        
        return (
          <div
            key={playedCard.playerPosition}
            className={`
              absolute ${positionClass}
              flex flex-col items-center gap-3 transition-transform duration-500
              ${isWinner ? 'scale-105 drop-shadow-[0_15px_25px_rgba(250,204,21,0.35)]' : ''}
            `}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className={`${isWinner ? 'ring-4 ring-emerald-300/60 rounded-2xl' : ''}`}>
              <Card card={playedCard.card} size="medium" />
            </div>
            <div
              className={`
                rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.3em]
                ${isWinner ? 'bg-emerald-400 text-slate-900' : isCurrentPlayer ? 'bg-white text-slate-900' : 'bg-white/10 text-emerald-100'}
              `}
            >
              {player?.name || `P${playedCard.playerPosition}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
