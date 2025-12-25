/**
 * @module components/game/BiddingPanel
 * @description Bidding interface for players
 */

import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface BiddingPanelProps {
  currentBid: number | null;
  isMyTurn: boolean;
}

export function BiddingPanel({ currentBid, isMyTurn }: BiddingPanelProps) {
  const { placeBid } = useGame();
  const isGameStartNotification = useGameStore((state) => state.isGameStartNotification);
  const getBidAnalysis = useGameStore((state) => state.getBidAnalysis);
  const showCardOverlay = useSettingsStore((state) => state.showCardOverlay);

  // Disable bidding if "Let's play!" notification is showing
  const isDisabled = isMyTurn && isGameStartNotification;

  if (!isMyTurn) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-slate-300">
          Waiting for other players to bid…
        </p>
        {currentBid !== null && (
          <p className="text-xs uppercase tracking-wide text-emerald-200/80">
            Current bid <span className="font-semibold text-emerald-200">{currentBid}</span>
          </p>
        )}
      </div>
    );
  }

  const availableBids = [2, 3, 4, 5].filter(bid =>
    currentBid === null || bid > currentBid
  );

  return (
    <div className="space-y-3 md:space-y-4 lg:space-y-6">
      <div className="space-y-0.5 md:space-y-1 text-center">
        <h3 className="text-sm md:text-base font-semibold tracking-wide text-white">
          Your bid
        </h3>
        {currentBid !== null && (
          <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.25em] text-emerald-200/80">
            Current high {currentBid}
          </p>
        )}
      </div>

      {isDisabled && (
        <p className="text-xs uppercase tracking-wide text-emerald-200/80 text-center py-2">
          Let's play!
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
        {availableBids.map(bid => {
          const analysis = getBidAnalysis(bid as 3 | 4 | 5);
          return (
            <div key={bid} className="min-w-[72px] md:min-w-[84px] flex-1 sm:flex-none">
              <Button
                onClick={() => placeBid(bid as 2 | 3 | 4 | 5)}
                variant="default"
                size="lg"
                disabled={isDisabled}
                className="w-full bg-emerald-500 text-slate-900 hover:bg-emerald-400 touch-target tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Bid {bid}
              </Button>
              {analysis && !isDisabled && showCardOverlay && (
                <div className="mt-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 pointer-events-none">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-semibold leading-snug tabular-nums">
                    <span className="flex items-center gap-1 text-emerald-200">
                      {analysis.rank === 1 && (
                        <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best bid">⭐</span>
                      )}
                      <span>{(analysis.winProbability * 100).toFixed(0)}%</span>
                    </span>
                    <span className="text-emerald-200">
                      {analysis.expectedScore > 0 ? '+' : ''}{analysis.expectedScore.toFixed(1)} pts
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] leading-snug text-emerald-200/70 tabular-nums">
                    <span>{analysis.visits}v</span>
                    <span>{(analysis.confidence * 100).toFixed(0)}% conf</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="min-w-[72px] md:min-w-[84px] flex-1 sm:flex-none">
          <Button
            onClick={() => placeBid('PASS')}
            variant="outline"
            size="lg"
            disabled={isDisabled}
            className="w-full border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 touch-target tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pass
          </Button>
          {(() => {
            const passAnalysis = getBidAnalysis('PASS');
            return passAnalysis && !isDisabled && showCardOverlay ? (
              <div className="mt-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 pointer-events-none">
                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold leading-snug tabular-nums">
                  <span className="flex items-center gap-1 text-emerald-200">
                    {passAnalysis.rank === 1 && (
                      <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best bid">⭐</span>
                    )}
                    <span>{(passAnalysis.winProbability * 100).toFixed(0)}%</span>
                  </span>
                  <span className="text-emerald-200">
                    {passAnalysis.expectedScore > 0 ? '+' : ''}{passAnalysis.expectedScore.toFixed(1)} pts
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] leading-snug text-emerald-200/70 tabular-nums">
                  <span>{passAnalysis.visits}v</span>
                  <span>{(passAnalysis.confidence * 100).toFixed(0)}% conf</span>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}

