/**
 * @module components/game/FoldDecision
 * @description Fold/stay decision interface
 */

import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { GameState } from '@buck-euchre/shared';

interface FoldDecisionProps {
  gameState: GameState;
  myPosition: number;
  isMyTurn: boolean;
}

export function FoldDecision({ gameState, myPosition, isMyTurn }: FoldDecisionProps) {
  const { makeFoldDecision } = useGame();
  const { getFoldAnalysis } = useGameStore();
  const showCardOverlay = useSettingsStore((state) => state.showCardOverlay);

  if (!isMyTurn) {
    return (
      <p className="text-center text-sm font-medium text-slate-300">
        Waiting for other players to make their call…
      </p>
    );
  }

  const isClubs = gameState.turnUpCard?.suit === 'CLUBS';
  const isBidder = gameState.winningBidderPosition === myPosition;
  const canFold = !isClubs && !isBidder;

  // Get analysis for both options
  const stayAnalysis = getFoldAnalysis(false);
  const foldAnalysis = getFoldAnalysis(true);

  return (
    <div className="space-y-3 md:space-y-4 lg:space-y-6">
      <div className="space-y-1 md:space-y-2 text-center">
        <h3 className="text-sm md:text-base font-semibold tracking-wide text-white">
          Stay in or sit out?
        </h3>
        <p className="text-[10px] md:text-xs uppercase tracking-[0.25em] md:tracking-[0.3em] text-emerald-200/80">
          Trump: {gameState.trumpSuit}
        </p>
        {isClubs && (
          <p className="text-[10px] md:text-xs font-medium text-rose-300/90">
            Clubs are up—folding isn't available this round.
          </p>
        )}
        {isBidder && (
          <p className="text-[10px] md:text-xs font-medium text-sky-200/90">
            You won the bid, so you're locked in.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 lg:gap-3">
        <div className="relative min-w-[100px] md:min-w-[120px] flex-1 sm:flex-none">
          <Button
            onClick={() => makeFoldDecision(false)}
            variant="default"
            size="lg"
            className="w-full bg-emerald-500 text-slate-900 hover:bg-emerald-400 touch-target tap-feedback"
          >
            Stay in
          </Button>
          {stayAnalysis && showCardOverlay && (
            <div className="absolute -top-16 left-0 right-0 bg-gradient-to-b from-black/95 to-black/30 rounded-lg p-2 pointer-events-none shadow-lg">
              <div className="flex flex-col gap-1 text-[10px] font-bold">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {stayAnalysis.isBest && (
                      <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best choice">⭐</span>
                    )}
                    <span className="text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {(stayAnalysis.winProbability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {stayAnalysis.expectedScore > 0 ? '+' : ''}{stayAnalysis.expectedScore.toFixed(1)} pts
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] opacity-90">
                  <span className="text-green-300">{stayAnalysis.visits} visits</span>
                  <span className="text-green-300">{(stayAnalysis.confidence * 100).toFixed(0)}% conf</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative min-w-[100px] md:min-w-[120px] flex-1 sm:flex-none">
          <Button
            onClick={() => makeFoldDecision(true)}
            variant="outline"
            size="lg"
            className="w-full border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 touch-target tap-feedback"
            disabled={!canFold}
          >
            Fold
          </Button>
          {foldAnalysis && canFold && showCardOverlay && (
            <div className="absolute -top-16 left-0 right-0 bg-gradient-to-b from-black/95 to-black/30 rounded-lg p-2 pointer-events-none shadow-lg">
              <div className="flex flex-col gap-1 text-[10px] font-bold">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {foldAnalysis.isBest && (
                      <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best choice">⭐</span>
                    )}
                    <span className="text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {(foldAnalysis.winProbability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {foldAnalysis.expectedScore > 0 ? '+' : ''}{foldAnalysis.expectedScore.toFixed(1)} pts
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] opacity-90">
                  <span className="text-green-300">{foldAnalysis.visits} visits</span>
                  <span className="text-green-300">{(foldAnalysis.confidence * 100).toFixed(0)}% conf</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!canFold && (
        <p className="text-center text-[10px] md:text-xs text-slate-300/80">
          {isClubs ? 'Cannot fold when clubs are trump.' : 'Bidder must play the hand.'}
        </p>
      )}
    </div>
  );
}

