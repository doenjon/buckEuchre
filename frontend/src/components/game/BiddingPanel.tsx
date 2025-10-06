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
      <div className="flex flex-col items-center gap-2 text-center text-sm text-white/70">
        <p className="font-medium uppercase tracking-[0.25em]">Waiting for bids</p>
        {currentBid !== null && (
          <p className="rounded-full border border-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
            Current bid {currentBid}
          </p>
        )}
      </div>
    );
  }

  const availableBids = [2, 3, 4, 5].filter(bid =>
    currentBid === null || bid > currentBid
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
          Your turn to bid
        </h3>
        {currentBid !== null && (
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/60">
            Current bid {currentBid}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {availableBids.map(bid => (
          <Button
            key={bid}
            onClick={() => placeBid(bid as 2 | 3 | 4 | 5)}
            variant="primary"
            size="lg"
            className="min-w-[96px] rounded-full bg-emerald-500/90 px-6 text-base font-semibold uppercase tracking-[0.2em] text-white hover:bg-emerald-500"
          >
            Bid {bid}
          </Button>
        ))}

        <Button
          onClick={() => placeBid('PASS')}
          variant="outline"
          size="lg"
          className="min-w-[96px] rounded-full border-white/40 bg-white/10 px-6 text-base font-semibold uppercase tracking-[0.2em] text-white/80 hover:bg-white/20"
        >
          Pass
        </Button>
      </div>
    </div>
  );
}

