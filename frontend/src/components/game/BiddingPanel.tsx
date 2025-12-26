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
  const bidAnalysis = useGameStore((state) => state.bidAnalysis);
  const showCardOverlay = useSettingsStore((state) => state.showCardOverlay);
  
  // Debug logging
  if (isMyTurn && showCardOverlay) {
    console.log('[BiddingPanel] Render check', {
      isMyTurn,
      showCardOverlay,
      isDisabled: isMyTurn && isGameStartNotification,
      hasBidAnalysis: !!bidAnalysis,
      bidAnalysisLength: bidAnalysis?.length,
      bidAnalysis: bidAnalysis?.map(b => ({ bidAmount: b.bidAmount, expectedScore: b.expectedScore })),
    });
  }

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
          const analysis = getBidAnalysis(bid as 2 | 3 | 4 | 5);
          // Debug logging
          if (showCardOverlay && isMyTurn && !isDisabled) {
            console.log('[BiddingPanel] Bid analysis check', {
              bid,
              hasAnalysis: !!analysis,
              analysis: analysis ? { expectedScore: analysis.expectedScore, visits: analysis.visits } : null,
            });
          }
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
                    <span className={`${
                      analysis.expectedScore < 0 ? 'text-green-300' : analysis.expectedScore > 0 ? 'text-red-300' : 'text-yellow-300'
                    }`}>
                      {analysis.expectedScore > 0 ? '+' : ''}{analysis.expectedScore.toFixed(1)} pts
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] leading-snug text-emerald-200/70 tabular-nums">
                    <span>{analysis.visits}v</span>
                    {typeof analysis.buckProbability === 'number' && (
                      <span className="text-orange-300">Buck {(analysis.buckProbability * 100).toFixed(0)}%</span>
                    )}
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
                  <span className={`${
                    passAnalysis.expectedScore < 0 ? 'text-green-300' : passAnalysis.expectedScore > 0 ? 'text-red-300' : 'text-yellow-300'
                  }`}>
                    {passAnalysis.expectedScore > 0 ? '+' : ''}{passAnalysis.expectedScore.toFixed(1)} pts
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] leading-snug text-emerald-200/70 tabular-nums">
                  <span>{passAnalysis.visits}v</span>
                  {typeof passAnalysis.buckProbability === 'number' && (
                    <span className="text-orange-300">Buck {(passAnalysis.buckProbability * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}

