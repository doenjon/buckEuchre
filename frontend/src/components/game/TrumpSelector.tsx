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
      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
        <p className="text-center text-gray-600">
          Waiting for winning bidder to declare trump...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-purple-50 border-2 border-purple-500 rounded-lg p-6">
      <h3 className="text-xl font-bold text-center mb-4">
        You won the bid! Choose Trump
      </h3>
      
      <div className="flex gap-3 justify-center flex-wrap">
        {SUITS.map(suit => (
          <Button
            key={suit}
            onClick={() => declareTrump(suit)}
            variant="default"
            size="lg"
            className="min-w-[120px] text-2xl"
          >
            <span className={SUIT_COLORS[suit]}>
              {SUIT_SYMBOLS[suit]} {suit}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

