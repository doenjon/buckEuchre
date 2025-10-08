/**
 * @module components/game/BiddingPanel
 * @description Bidding interface for players
 */

import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';

interface BiddingPanelProps {
  currentBid: number | null;
  isMyTurn: boolean;
}

export function BiddingPanel({ currentBid, isMyTurn }: BiddingPanelProps) {
  const { placeBid } = useGame();

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
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1 text-center">
        <h3 className="text-base font-semibold tracking-wide text-white sm:text-lg">
          Your bid
        </h3>
        {currentBid !== null && (
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/80">
            Current high {currentBid}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {availableBids.map(bid => (
          <Button
            key={bid}
            onClick={() => placeBid(bid as 2 | 3 | 4 | 5)}
            variant="default"
            size="lg"
            className="min-w-[84px] flex-1 bg-emerald-500 text-slate-900 hover:bg-emerald-400 sm:flex-none"
          >
            Bid {bid}
          </Button>
        ))}

        <Button
          onClick={() => placeBid('PASS')}
          variant="outline"
          size="lg"
          className="min-w-[84px] flex-1 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 sm:flex-none"
        >
          Pass
        </Button>
      </div>
    </div>
  );
}

