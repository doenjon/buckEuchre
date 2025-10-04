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

const sizeStyles = {
  small: 'w-16 h-24 text-sm',
  medium: 'w-20 h-32 text-base',
  large: 'w-24 h-36 text-lg',
};

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
        className={`${sizeStyles[size]} bg-blue-900 rounded-lg border-2 border-blue-950 flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl transition-shadow`}
        onClick={!disabled ? onClick : undefined}
      >
        <div className="text-4xl text-blue-800">🂠</div>
      </div>
    );
  }

  const suitSymbol = suitSymbols[card.suit];
  const suitColor = suitColors[card.suit];
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeStyles[size]}
        bg-white rounded-lg border-2 shadow-lg
        flex flex-col items-center justify-between p-2
        transition-all duration-200
        ${!disabled && onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-2' : 'cursor-default'}
        ${disabled ? 'opacity-50' : ''}
        ${selected ? 'border-green-500 ring-2 ring-green-400' : 'border-gray-300'}
      `}
    >
      <div className={`${suitColor} font-bold flex items-center gap-1`}>
        <span>{card.rank}</span>
        <span className="text-2xl">{suitSymbol}</span>
      </div>
      
      <div className={`${suitColor} text-4xl`}>
        {suitSymbol}
      </div>
      
      <div className={`${suitColor} font-bold flex items-center gap-1 rotate-180`}>
        <span>{card.rank}</span>
        <span className="text-2xl">{suitSymbol}</span>
      </div>
    </button>
  );
}
