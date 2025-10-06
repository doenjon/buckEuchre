/**
 * @module components/game/FoldDecision
 * @description Fold/stay decision interface
 */

import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import type { GameState } from '@buck-euchre/shared';

interface FoldDecisionProps {
  gameState: GameState;
  myPosition: number;
  isMyTurn: boolean;
}

export function FoldDecision({ gameState, myPosition, isMyTurn }: FoldDecisionProps) {
  const { makeFoldDecision } = useGame();

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

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold tracking-wide text-white">
          Stay in or sit out?
        </h3>
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
          Trump: {gameState.trumpSuit}
        </p>
        {isClubs && (
          <p className="text-xs font-medium text-rose-300/90">
            Clubs are up—folding isn’t available this round.
          </p>
        )}
        {isBidder && (
          <p className="text-xs font-medium text-sky-200/90">
            You won the bid, so you’re locked in.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onClick={() => makeFoldDecision(false)}
          variant="default"
          size="lg"
          className="min-w-[120px] bg-emerald-500 text-slate-900 hover:bg-emerald-400"
        >
          Stay in
        </Button>

        <Button
          onClick={() => makeFoldDecision(true)}
          variant="outline"
          size="lg"
          className="min-w-[120px] border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
          disabled={!canFold}
        >
          Fold
        </Button>
      </div>

      {!canFold && (
        <p className="text-center text-xs text-slate-300/80">
          {isClubs ? 'Cannot fold when clubs are trump.' : 'Bidder must play the hand.'}
        </p>
      )}
    </div>
  );
}

