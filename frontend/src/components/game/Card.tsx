/**
 * @module components/game/Card
 * @description Visual playing card representation
 */

import type { CSSProperties } from 'react';

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

type ResponsiveFont = {
  min: string;
  scale: number;
  max: string;
};

type SizeConfig = {
  width: string;
  height: string;
  padding: string;
  borderRadius: string;
  fonts: {
    rank: ResponsiveFont;
    corner: ResponsiveFont;
    center: ResponsiveFont;
  };
};

const sizeStyles: Record<NonNullable<CardProps['size']>, SizeConfig> = {
  small: {
    width: 'clamp(3.25rem, 11vw, 3.875rem)',
    height: 'calc(1.45 * clamp(3.25rem, 11vw, 3.875rem))',
    padding: 'clamp(0.35rem, 1.5vw, 0.5rem)',
    borderRadius: 'calc(0.12 * clamp(3.25rem, 11vw, 3.875rem))',
    fonts: {
      rank: { min: '0.7rem', scale: 0.22, max: '0.95rem' },
      corner: { min: '1.1rem', scale: 0.32, max: '1.45rem' },
      center: { min: '1.8rem', scale: 0.52, max: '2.45rem' },
    },
  },
  medium: {
    width: 'clamp(3.75rem, 12.5vw, 4.75rem)',
    height: 'calc(1.45 * clamp(3.75rem, 12.5vw, 4.75rem))',
    padding: 'clamp(0.45rem, 1.65vw, 0.7rem)',
    borderRadius: 'calc(0.12 * clamp(3.75rem, 12.5vw, 4.75rem))',
    fonts: {
      rank: { min: '0.8rem', scale: 0.22, max: '1.05rem' },
      corner: { min: '1.25rem', scale: 0.32, max: '1.7rem' },
      center: { min: '2.1rem', scale: 0.52, max: '2.95rem' },
    },
  },
  large: {
    width: 'clamp(4.25rem, 15vw, 6rem)',
    height: 'calc(1.45 * clamp(4.25rem, 15vw, 6rem))',
    padding: 'clamp(0.55rem, 1.85vw, 0.9rem)',
    borderRadius: 'calc(0.12 * clamp(4.25rem, 15vw, 6rem))',
    fonts: {
      rank: { min: '0.85rem', scale: 0.22, max: '1.15rem' },
      corner: { min: '1.4rem', scale: 0.32, max: '1.9rem' },
      center: { min: '2.3rem', scale: 0.52, max: '3.5rem' },
    },
  },
} as const;

type CardCSSProperties = CSSProperties & {
  '--card-width'?: string;
};

function responsiveFont({ min, scale, max }: ResponsiveFont) {
  return `clamp(${min}, calc(var(--card-width) * ${scale}), ${max})`;
}

export function Card({
  card,
  onClick,
  disabled = false,
  faceDown = false,
  size = 'medium',
  selected = false
}: CardProps) {
  const sizeConfig = sizeStyles[size];
  const baseCardStyle: CardCSSProperties = {
    width: sizeConfig.width,
    height: sizeConfig.height,
    padding: sizeConfig.padding,
    borderRadius: sizeConfig.borderRadius,
    '--card-width': sizeConfig.width,
  };

  const rankFontSize = responsiveFont(sizeConfig.fonts.rank);
  const cornerFontSize = responsiveFont(sizeConfig.fonts.corner);
  const centerFontSize = responsiveFont(sizeConfig.fonts.center);

  if (faceDown) {
    return (
      <div
        className={`bg-blue-900 border-2 border-blue-950 flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105`}
        onClick={!disabled ? onClick : undefined}
        role="button"
        aria-label="Face down card"
        tabIndex={!disabled && onClick ? 0 : -1}
        style={baseCardStyle}
      >
        <div
          className="text-blue-800"
          style={{ fontSize: centerFontSize }}
        >
          🂠
        </div>
      </div>
    );
  }

  const suitSymbol = suitSymbols[card.suit];
  const suitColor = suitColors[card.suit];
  const ariaLabel = `${card.rank} of ${card.suit}${selected ? ' (selected)' : ''}${disabled ? ' (disabled)' : ''}`;
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
        bg-white rounded-lg border-2 shadow-lg
        flex flex-col items-center justify-between
        transition-all duration-300 ease-out
        transform-gpu
        ${interactionClasses}
        opacity-100
        ${selected ? 'border-green-500 ring-4 ring-green-300 -translate-y-2 scale-105' : 'border-gray-300'}
        focus:outline-none focus:ring-4 focus:ring-blue-300
        animate-in fade-in slide-in-from-bottom-4 duration-500
      `}
      style={baseCardStyle}
    >
      <div
        className={`${suitColor} font-bold flex items-center`}
        style={{ fontSize: rankFontSize, gap: '0.2em' }}
      >
        <span>{card.rank}</span>
        <span style={{ fontSize: cornerFontSize }}>{suitSymbol}</span>
      </div>

      <div
        className={suitColor}
        style={{ fontSize: centerFontSize }}
      >
        {suitSymbol}
      </div>

      <div
        className={`${suitColor} font-bold flex items-center rotate-180`}
        style={{ fontSize: rankFontSize, gap: '0.2em' }}
      >
        <span>{card.rank}</span>
        <span style={{ fontSize: cornerFontSize }}>{suitSymbol}</span>
      </div>
    </button>
  );
}
