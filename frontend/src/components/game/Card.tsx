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
  size?: 'small' | 'medium' | 'large';
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

// Calculate text sizes as percentage of card width for proportional scaling
const sizeStyles = {
  small: 'w-[min(calc((100vw-3rem)/6.2*1.1),4.5rem)] h-[calc(min(calc((100vw-3rem)/6.2*1.1),4.5rem)*1.5)] md:w-[4.5rem] md:h-[6.75rem] lg:w-[5.5rem] lg:h-[8.25rem]',
  medium: 'w-[min(calc((100vw-3rem)/5.3),4.5rem)] h-[calc(min(calc((100vw-3rem)/5.3),4.5rem)*1.5)] md:w-[4.5rem] md:h-[6.75rem]',
  large: 'w-[min(calc((100vw-3rem)/4.9*1.05),5.3rem)] h-[calc(min(calc((100vw-3rem)/4.9*1.05),5.3rem)*1.5)] md:w-[4.5rem] md:h-[6.75rem] lg:w-[4.5rem] lg:h-[6.75rem]',
} as const;

// Text sizes as percentage of card width - scales proportionally
const cornerTextStyles = {
  small: 'text-[clamp(0.375rem,5vw,0.625rem)] md:text-[clamp(0.5rem,3vw,0.75rem)] lg:text-xs',
  medium: 'text-[clamp(0.375rem,4.5vw,0.625rem)] md:text-[clamp(0.625rem,3vw,0.75rem)]',
  large: 'text-[clamp(0.5rem,4vw,0.75rem)] md:text-[clamp(0.75rem,4vw,0.875rem)]',
} as const;

const cornerSymbolStyles = {
  small: 'text-[clamp(0.5rem,6vw,0.875rem)] md:text-[clamp(0.75rem,4vw,1rem)] lg:text-sm',
  medium: 'text-[clamp(0.625rem,5.5vw,0.875rem)] md:text-[clamp(0.875rem,4vw,1.125rem)]',
  large: 'text-[clamp(0.75rem,5vw,1rem)] md:text-[clamp(1rem,5vw,1.125rem)]',
} as const;

const centerSymbolStyles = {
  small: 'text-[clamp(0.875rem,10vw,1.5rem)] md:text-[clamp(1.25rem,6vw,1.75rem)] lg:text-xl',
  medium: 'text-[clamp(1rem,11vw,1.75rem)] md:text-[clamp(1.5rem,7vw,2rem)]',
  large: 'text-[clamp(1.25rem,12vw,2rem)] md:text-[clamp(2rem,8vw,2.5rem)]',
} as const;

export function Card({
  card,
  onClick,
  disabled = false,
  faceDown = false,
  size = 'medium',
  selected = false
}: CardProps) {
  const handleFaceDownClick = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('[Card] Face-down card clicked:', { disabled, hasOnClick: !!onClick });
    if (!disabled && onClick) {
      onClick();
    }
  };

  if (faceDown) {
    return (
      <div 
        className={`${sizeStyles[size]} bg-blue-900 rounded-lg border-2 border-blue-950 flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105`}
        style={{ backgroundColor: '#1e3a8a', opacity: 1 }}
        onClick={handleFaceDownClick}
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
  const cornerTextClass = cornerTextStyles[size];
  const interactionClasses = !disabled && onClick
    ? 'cursor-pointer md:hover:shadow-2xl md:hover:-translate-y-3 md:hover:scale-105 active:scale-95 tap-feedback touch-target'
    : disabled
      ? 'cursor-not-allowed'
      : 'cursor-default';
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('[Card] Clicked:', {
      cardId: card.id,
      disabled,
      hasOnClick: !!onClick,
      event: e
    });
    if (!disabled && onClick) {
      if (typeof onClick === 'function') {
        onClick();
      }
    } else {
      console.warn('[Card] Click ignored - disabled or no onClick:', { disabled, hasOnClick: !!onClick });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={`
        ${sizeStyles[size]}
        bg-white rounded-md md:rounded-lg border-2 shadow-md md:shadow-lg
        flex flex-col items-center justify-between
        transition-all duration-200 ease-out
        transform-gpu
        ${interactionClasses}
        ${selected ? 'border-emerald-500 ring-2 md:ring-4 ring-emerald-300 -translate-y-1 md:-translate-y-2 scale-105' : 'border-gray-300'}
        focus:outline-none focus:ring-2 focus:ring-blue-400
        animate-in fade-in slide-in-from-bottom-4 duration-300
      `}
      style={{ 
        backgroundColor: '#ffffff', 
        opacity: 1,
        padding: 'clamp(0.25rem, 3vw, 0.75rem) clamp(0.375rem, 4vw, 0.875rem)',
      }}
    >
      <div className={`${suitColor} font-bold flex items-center gap-[clamp(0.125rem,1.5vw,0.25rem)] ${cornerTextClass}`}>
        <span className="leading-none">{card.rank}</span>
        <span className={`leading-none ${cornerSymbolClass}`}>{suitSymbol}</span>
      </div>

      <div className={`${suitColor} ${centerSymbolClass} leading-none`}>
        {suitSymbol}
      </div>

      <div className={`${suitColor} font-bold flex items-center gap-[clamp(0.125rem,1.5vw,0.25rem)] rotate-180 ${cornerTextClass}`}>
        <span className="leading-none">{card.rank}</span>
        <span className={`leading-none ${cornerSymbolClass}`}>{suitSymbol}</span>
      </div>
    </button>
  );
}
