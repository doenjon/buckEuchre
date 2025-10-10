/**
 * @module components/game/Card
 * @description Visual playing card representation
 */

import type { Card as CardType } from '@buck-euchre/shared';

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
  small: 'w-14 h-20 text-xs sm:w-16 sm:h-24 sm:text-sm',
  medium: 'w-16 h-24 text-sm sm:w-20 sm:h-32 sm:text-base',
  large: 'w-20 h-[8.5rem] text-base sm:w-24 sm:h-36 sm:text-lg',
  responsive: 'w-14 h-20 text-xs sm:w-24 sm:h-36 sm:text-lg',
} as const;

const cornerSymbolStyles = {
  small: 'text-lg sm:text-xl',
  medium: 'text-xl sm:text-2xl',
  large: 'text-2xl sm:text-3xl',
  responsive: 'text-lg sm:text-3xl',
} as const;

const centerSymbolStyles = {
  small: 'text-2xl sm:text-3xl',
  medium: 'text-3xl sm:text-4xl',
  large: 'text-4xl sm:text-5xl',
  responsive: 'text-2xl sm:text-5xl',
} as const;

export function Card({
  card,
  onClick,
  disabled = false,
  faceDown = false,
  size = 'medium',
  selected = false
}: CardProps) {
  if (faceDown) {
    return (
      <div 
        className={`${sizeStyles[size]} bg-blue-900 rounded-lg border-2 border-blue-950 flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105`}
        onClick={!disabled ? onClick : undefined}
        role="button"
        aria-label="Face down card"
        tabIndex={!disabled && onClick ? 0 : -1}
      >
        <div className="text-4xl text-blue-800">🂠</div>
      </div>
    );
  }

  const suitSymbol = suitSymbols[card.suit];
  const suitColor = suitColors[card.suit];
  const ariaLabel = `${card.rank} of ${card.suit}${selected ? ' (selected)' : ''}${disabled ? ' (disabled)' : ''}`;
  const cornerSymbolClass = cornerSymbolStyles[size];
  const centerSymbolClass = centerSymbolStyles[size];
  const interactionClasses = !disabled && onClick
    ? 'cursor-pointer hover:shadow-2xl hover:-translate-y-3 hover:scale-105 active:scale-95'
    : disabled
      ? 'cursor-not-allowed'
      : 'cursor-default';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={`
        ${sizeStyles[size]}
        bg-white rounded-lg border-2 shadow-lg
        flex flex-col items-center justify-between p-2 sm:p-3
        transition-all duration-300 ease-out
        transform-gpu
        ${interactionClasses}
        opacity-100
        ${selected ? 'border-green-500 ring-4 ring-green-300 -translate-y-2 scale-105' : 'border-gray-300'}
        focus:outline-none focus:ring-4 focus:ring-blue-300
        animate-in fade-in slide-in-from-bottom-4 duration-500
      `}
    >
      <div className={`${suitColor} font-bold flex items-center gap-1`}>
        <span>{card.rank}</span>
        <span className={cornerSymbolClass}>{suitSymbol}</span>
      </div>

      <div className={`${suitColor} ${centerSymbolClass}`}>
        {suitSymbol}
      </div>

      <div className={`${suitColor} font-bold flex items-center gap-1 rotate-180`}>
        <span>{card.rank}</span>
        <span className={cornerSymbolClass}>{suitSymbol}</span>
      </div>
    </button>
  );
}
