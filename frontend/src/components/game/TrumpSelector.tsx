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
  SPADES: 'text-slate-900',
  CLUBS: 'text-slate-900',
  HEARTS: 'text-rose-500',
  DIAMONDS: 'text-rose-500',
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
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1 text-center">
        <h3 className="text-base font-semibold tracking-wide text-white sm:text-lg">
          Choose your trump suit
        </h3>
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
          Select to lock in
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {SUITS.map(suit => (
          <Button
            key={suit}
            onClick={() => declareTrump(suit)}
            variant="default"
            size="lg"
            className="min-w-[120px] flex-1 border border-white/20 bg-white text-base font-semibold text-slate-900 shadow-lg hover:bg-emerald-100 sm:flex-none sm:text-lg"
          >
            <span className={`flex items-center gap-2 ${SUIT_COLORS[suit]}`}>
              <span className="text-xl sm:text-2xl">{SUIT_SYMBOLS[suit]}</span>
              <span className="text-sm sm:text-base">{suit}</span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

