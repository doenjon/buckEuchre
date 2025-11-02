/**
 * @module components/game/BiddingPanel
 * @description Bidding interface for players
 */

import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/stores/gameStore';

interface BiddingPanelProps {
  currentBid: number | null;
  isMyTurn: boolean;
}

export function BiddingPanel({ currentBid, isMyTurn }: BiddingPanelProps) {
  const { placeBid } = useGame();
  const isGameStartNotification = useGameStore((state) => state.isGameStartNotification);
  
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
        {availableBids.map(bid => (
          <Button
            key={bid}
            onClick={() => placeBid(bid as 2 | 3 | 4 | 5)}
            variant="default"
            size="lg"
            disabled={isDisabled}
            className="min-w-[72px] md:min-w-[84px] flex-1 bg-emerald-500 text-slate-900 hover:bg-emerald-400 sm:flex-none touch-target tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bid {bid}
          </Button>
        ))}

        <Button
          onClick={() => placeBid('PASS')}
          variant="outline"
          size="lg"
          disabled={isDisabled}
          className="min-w-[72px] md:min-w-[84px] flex-1 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 sm:flex-none touch-target tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Pass
        </Button>
      </div>
    </div>
  );
}

