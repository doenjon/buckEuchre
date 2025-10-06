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
  SPADES: 'text-black',
  CLUBS: 'text-black',
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
      <p className="text-center text-sm font-medium uppercase tracking-[0.25em] text-white/70">
        Waiting for trump declaration
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
          Choose the trump suit
        </h3>
        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-white/60">
          You won the bid
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {SUITS.map(suit => (
          <Button
            key={suit}
            onClick={() => declareTrump(suit)}
            variant="primary"
            size="lg"
            className="flex min-w-[130px] items-center justify-center gap-2 rounded-full bg-white/90 px-6 text-lg font-semibold uppercase tracking-[0.2em] text-slate-900 hover:bg-white"
          >
            <span className={`${SUIT_COLORS[suit]} text-2xl`}>{SUIT_SYMBOLS[suit]}</span>
            <span className="text-sm font-semibold text-slate-800">{suit}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

