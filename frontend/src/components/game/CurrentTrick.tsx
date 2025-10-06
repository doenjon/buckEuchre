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
        className="relative flex min-h-[320px] items-center justify-center rounded-[28px] border border-white/15 bg-white/5 shadow-inner backdrop-blur"
        role="region"
        aria-label="Current trick area"
      >
        <div className="rounded-full border border-dashed border-white/20 px-6 py-4 text-xs font-medium uppercase tracking-[0.25em] text-white/60">
          Waiting for the first card
        </div>
      </div>
    );
  }

  const winner = trick.winner !== null ? players[trick.winner] : null;

  const cardPositions = [
    { top: '8%', left: '50%', translate: '-50% -50%' },
    { top: '50%', right: '6%', translate: '50% -50%' },
    { bottom: '6%', left: '50%', translate: '-50% 50%' },
    { top: '50%', left: '6%', translate: '-50% -50%' }
  ];

  return (
    <div
      className="relative flex min-h-[360px] items-center justify-center rounded-[28px] border border-white/15 bg-[radial-gradient(circle_at_center,_rgba(15,118,110,0.35),_rgba(6,31,17,0.95))] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur"
      role="region"
      aria-label={`Trick ${trick.number}, ${trick.cards.length} of 4 cards played`}
    >
      <div className="pointer-events-none absolute inset-4 rounded-[24px] border border-white/10" />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Trick {trick.number}</p>
        <p className="text-[11px] uppercase tracking-[0.25em] text-white/50">
          Lead: {players[trick.leadPlayerPosition]?.name || `Player ${trick.leadPlayerPosition}`}
        </p>
        {winner && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Winner: {winner.name}
          </p>
        )}
      </div>

      {trick.cards.map((playedCard, index) => {
        const player = players[playedCard.playerPosition];
        const position = cardPositions[playedCard.playerPosition];
        const isCurrentPlayer = playedCard.playerPosition === currentPlayerPosition;
        const isWinner = trick.winner === playedCard.playerPosition;

        return (
          <div
            key={playedCard.playerPosition}
            className="absolute flex flex-col items-center gap-3"
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              right: position.right,
              transform: `translate(${position.translate})`,
              animationDelay: `${index * 120}ms`
            }}
          >
            <div className={`rounded-2xl transition-all duration-300 ${isWinner ? 'ring-4 ring-emerald-300' : 'ring-0'}`}>
              <Card card={playedCard.card} size="medium" />
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${isWinner ? 'bg-emerald-500 text-white shadow-lg' : isCurrentPlayer ? 'bg-white text-emerald-700 shadow' : 'bg-white/80 text-slate-700'}`}
            >
              {player?.name || `P${playedCard.playerPosition}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
