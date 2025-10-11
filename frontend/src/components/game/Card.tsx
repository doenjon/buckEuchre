/**
 * @module components/game/Card
 * @description Visual playing card representation
 */

import type { Card as CardType } from '@buck-euchre/shared';
import { cn } from '@/lib/utils';

export interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  faceDown?: boolean;
  size?: 'small' | 'medium' | 'large' | 'responsive';
  selected?: boolean;
}

const suitSymbols = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
};

const suitColors = {
  SPADES: 'text-gray-900',
  HEARTS: 'text-red-600',
  DIAMONDS: 'text-red-600',
  CLUBS: 'text-gray-900',
};

const sizeStyles = {
  small: 'w-12 aspect-[63/88]',
  medium: 'w-16 aspect-[63/88]',
  large: 'w-20 aspect-[63/88]',
  responsive: 'w-[clamp(3.25rem,16vw,4.75rem)] aspect-[63/88] sm:w-24',
} as const;

const rankStyles = {
  small: 'text-[0.6rem] sm:text-xs',
  medium: 'text-xs sm:text-sm',
  large: 'text-sm sm:text-base',
  responsive: 'text-[clamp(0.6rem,1.7vw,0.9rem)] sm:text-base',
} as const;

const cornerSuitStyles = {
  small: 'text-lg sm:text-xl',
  medium: 'text-xl sm:text-2xl',
  large: 'text-2xl sm:text-3xl',
  responsive: 'text-[clamp(1rem,3vw,1.55rem)] sm:text-3xl',
} as const;

const centerSymbolStyles = {
  small: 'text-2xl sm:text-3xl',
  medium: 'text-3xl sm:text-4xl',
  large: 'text-[2.5rem] sm:text-5xl',
  responsive: 'text-[clamp(1.45rem,4.2vw,2.55rem)] sm:text-5xl',
} as const;

const rankLabels: Record<CardType['rank'], string> = {
  ACE: 'A',
  KING: 'K',
  QUEEN: 'Q',
  JACK: 'J',
  TEN: '10',
  NINE: '9',
};

export function Card({
  card,
  onClick,
  disabled = false,
  faceDown = false,
  size = 'medium',
  selected = false
}: CardProps) {
  const isInteractive = Boolean(onClick) && !disabled;
  const rankLabel = rankLabels[card.rank] ?? card.rank;

  if (faceDown) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Face down card"
        className={cn(
          'relative isolate flex items-center justify-center overflow-hidden rounded-3xl border border-blue-900/70 bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-white shadow-[0_22px_48px_-28px_rgba(30,64,175,0.8)] transition-transform duration-300 ease-out',
          sizeStyles[size],
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/60',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_32px_70px_-35px_rgba(59,130,246,0.8)] active:translate-y-0 active:scale-[0.99]'
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(96,165,250,0.25),transparent_45%)]" />
        <span className="relative text-4xl text-blue-200 drop-shadow-lg">🂠</span>
      </button>
    );
  }

  const suitSymbol = suitSymbols[card.suit];
  const suitColor = suitColors[card.suit];
  const ariaLabel = `${card.rank} of ${card.suit}${selected ? ' (selected)' : ''}${disabled ? ' (disabled)' : ''}`;
  const cornerRankClass = rankStyles[size];
  const cornerSymbolClass = cornerSuitStyles[size];
  const centerSymbolClass = centerSymbolStyles[size];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        'group relative isolate flex h-auto items-center justify-center overflow-visible rounded-3xl border border-white/60 bg-white text-slate-900 shadow-[0_22px_48px_-30px_rgba(16,185,129,0.75)] transition-all duration-300 ease-out',
        sizeStyles[size],
        'px-[clamp(0.55rem,1.6vw,0.75rem)] py-[clamp(0.55rem,1.8vw,0.85rem)]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/70',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-default',
        isInteractive &&
          'cursor-pointer hover:-translate-y-2 hover:shadow-[0_32px_80px_-35px_rgba(16,185,129,0.9)] active:translate-y-0 active:scale-[0.98]',
        selected &&
          'border-emerald-400 ring-4 ring-emerald-300/70 shadow-[0_36px_90px_-40px_rgba(16,185,129,0.95)] -translate-y-2'
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white via-white to-emerald-50 opacity-90" />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.16),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(45,212,191,0.18),transparent_45%)]" />

      <div
        className={cn(
          'pointer-events-none absolute left-[clamp(0.45rem,1.2vw,0.65rem)] top-[clamp(0.4rem,1.2vw,0.65rem)] flex flex-col items-start gap-0.5 text-left leading-none tracking-tight',
          suitColor
        )}
      >
        <span className={cn('font-semibold', cornerRankClass)}>{rankLabel}</span>
        <span className={cornerSymbolClass}>{suitSymbol}</span>
      </div>

      <div
        className={cn(
          'pointer-events-none absolute right-[clamp(0.45rem,1.2vw,0.65rem)] bottom-[clamp(0.4rem,1.2vw,0.65rem)] flex flex-col items-start gap-0.5 text-left leading-none tracking-tight rotate-180',
          suitColor
        )}
      >
        <span className={cn('font-semibold', cornerRankClass)}>{rankLabel}</span>
        <span className={cornerSymbolClass}>{suitSymbol}</span>
      </div>

      <div className={cn('pointer-events-none relative flex items-center justify-center leading-none drop-shadow-[0_12px_18px_rgba(16,185,129,0.25)]', suitColor, centerSymbolClass)}>
        {suitSymbol}
      </div>
    </button>
  );
}
