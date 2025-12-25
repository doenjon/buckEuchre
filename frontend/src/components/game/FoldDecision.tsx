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
        <div className="min-w-[100px] md:min-w-[120px] flex-1 sm:flex-none">
          <Button
            onClick={() => makeFoldDecision(false)}
            variant="default"
            size="lg"
            className="w-full bg-emerald-500 text-slate-900 hover:bg-emerald-400 touch-target tap-feedback"
          >
            Stay in
          </Button>
          {stayAnalysis && showCardOverlay && (
            <div className="mt-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 pointer-events-none">
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold leading-snug tabular-nums">
                <span className="flex items-center gap-1 text-emerald-200">
                  {stayAnalysis.isBest && (
                    <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best choice">⭐</span>
                  )}
                  <span>{(stayAnalysis.winProbability * 100).toFixed(0)}%</span>
                </span>
                <span className="text-emerald-200">
                  {stayAnalysis.expectedScore > 0 ? '+' : ''}{stayAnalysis.expectedScore.toFixed(1)} pts
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] leading-snug text-emerald-200/70 tabular-nums">
                <span>{stayAnalysis.visits}v</span>
                <span>{(stayAnalysis.confidence * 100).toFixed(0)}% conf</span>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-[100px] md:min-w-[120px] flex-1 sm:flex-none">
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
            <div className="mt-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 pointer-events-none">
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold leading-snug tabular-nums">
                <span className="flex items-center gap-1 text-emerald-200">
                  {foldAnalysis.isBest && (
                    <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best choice">⭐</span>
                  )}
                  <span>{(foldAnalysis.winProbability * 100).toFixed(0)}%</span>
                </span>
                <span className="text-emerald-200">
                  {foldAnalysis.expectedScore > 0 ? '+' : ''}{foldAnalysis.expectedScore.toFixed(1)} pts
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] leading-snug text-emerald-200/70 tabular-nums">
                <span>{foldAnalysis.visits}v</span>
                <span>{(foldAnalysis.confidence * 100).toFixed(0)}% conf</span>
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

