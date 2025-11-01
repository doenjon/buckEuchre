/**
 * @module components/game/TrumpSelector
 * @description Trump suit declaration interface
 */

import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import type { Card } from '@buck-euchre/shared';

interface TrumpSelectorProps {
  isMyTurn: boolean;
}

const SUITS: Card['suit'][] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];

const SUIT_COLORS: Record<Card['suit'], string> = {
  SPADES: 'text-gray-900',
  CLUBS: 'text-gray-900',
  HEARTS: 'text-red-600',
  DIAMONDS: 'text-red-600',
};

const SUIT_SYMBOLS: Record<Card['suit'], string> = {
  SPADES: '♠',
  CLUBS: '♣',
  HEARTS: '♥',
  DIAMONDS: '♦',
};

export function TrumpSelector({ isMyTurn }: TrumpSelectorProps) {
  const { declareTrump } = useGame();

  if (!isMyTurn) {
    return (
      <p className="text-center text-sm font-medium text-slate-300">
        Waiting for the winning bidder to choose trump…
      </p>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 lg:space-y-6">
      <div className="space-y-0.5 md:space-y-1 text-center">
        <h3 className="text-sm md:text-base font-semibold tracking-wide text-white">
          Choose your trump suit
        </h3>
        <p className="text-[10px] md:text-xs uppercase tracking-[0.25em] md:tracking-[0.3em] text-emerald-200/80">
          Select to lock in
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-xs mx-auto">
        {SUITS.map(suit => (
          <button
            key={suit}
            onClick={() => declareTrump(suit)}
            className="aspect-[3/4] min-h-[120px] md:min-h-[140px] flex items-center justify-center border-2 border-gray-300 rounded-lg shadow-md md:shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 touch-target tap-feedback focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95"
            style={{ backgroundColor: '#ffffff' }}
            aria-label={`Select ${suit} as trump`}
          >
            <span className={`text-6xl md:text-7xl lg:text-8xl leading-none ${SUIT_COLORS[suit]}`}>
              {SUIT_SYMBOLS[suit]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

