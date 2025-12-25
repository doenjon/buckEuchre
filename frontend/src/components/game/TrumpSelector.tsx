/**
 * @module components/game/TrumpSelector
 * @description Trump suit declaration interface
 */

import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
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
  const getSuitAnalysis = useGameStore((state) => state.getSuitAnalysis);
  const showCardOverlay = useSettingsStore((state) => state.showCardOverlay);

  if (!isMyTurn) {
    return (
      <p className="text-center text-sm font-medium text-slate-300">
        Waiting for the winning bidder to choose trump…
      </p>
    );
  }

  return (
    <div className="space-y-2 md:space-y-[0.625rem] lg:space-y-4">
      <div className="space-y-0.5 md:space-y-1 text-center">
        <h3 className="text-xs md:text-sm font-semibold tracking-wide text-white">
          Choose your trump suit
        </h3>
        <p className="text-[7px] md:text-[8px] uppercase tracking-[0.25em] md:tracking-[0.3em] text-emerald-200/80">
          Select to lock in
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-[0.625rem] max-w-[10rem] mx-auto justify-items-center items-center">
        {SUITS.map(suit => {
          const analysis = getSuitAnalysis(suit);
          return (
            <div key={suit} className="relative w-full">
              <button
                onClick={() => declareTrump(suit)}
                className="w-full aspect-[3/4] min-h-[80px] md:min-h-[94px] flex items-center justify-center border-2 border-gray-300 rounded-lg shadow-md md:shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 touch-target tap-feedback focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95"
                style={{ backgroundColor: '#ffffff' }}
                aria-label={`Select ${suit} as trump`}
              >
                <span className={`text-4xl md:text-5xl lg:text-5xl leading-none ${SUIT_COLORS[suit]}`}>
                  {SUIT_SYMBOLS[suit]}
                </span>
              </button>
              {analysis && showCardOverlay && (
                <div className="absolute -top-16 left-0 right-0 bg-gradient-to-b from-black/95 to-black/30 rounded-lg p-2 pointer-events-none shadow-lg">
                  <div className="flex flex-col gap-1 text-[10px] font-bold">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {analysis.rank === 1 && (
                          <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best suit">⭐</span>
                        )}
                        <span className="text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {(analysis.winProbability * 100).toFixed(0)}%
                        </span>
                      </div>
                      <span className="text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {analysis.expectedScore > 0 ? '+' : ''}{analysis.expectedScore.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] opacity-90">
                      <span className="text-green-300">{analysis.visits} visits</span>
                      <span className="text-green-300">{(analysis.confidence * 100).toFixed(0)}% conf</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

