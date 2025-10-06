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
      <p className="text-center text-sm font-medium uppercase tracking-[0.25em] text-white/70">
        Waiting for fold decisions
      </p>
    );
  }

  const isClubs = gameState.turnUpCard?.suit === 'CLUBS';
  const isBidder = gameState.winningBidderPosition === myPosition;
  const canFold = !isClubs && !isBidder;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
          Fold or stay?
        </h3>
        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-white/60">
          Trump suit {gameState.trumpSuit}
        </p>
      </div>

      <div className="flex justify-center gap-3">
        <Button
          onClick={() => makeFoldDecision(false)}
          variant="primary"
          size="lg"
          className="min-w-[130px] rounded-full bg-emerald-500/90 px-6 text-base font-semibold uppercase tracking-[0.2em] text-white hover:bg-emerald-500"
        >
          Stay in
        </Button>

        <Button
          onClick={() => makeFoldDecision(true)}
          variant="outline"
          size="lg"
          className="min-w-[130px] rounded-full border-white/40 bg-white/10 px-6 text-base font-semibold uppercase tracking-[0.2em] text-white/80 hover:bg-white/20 disabled:cursor-not-allowed"
          disabled={!canFold}
        >
          Fold
        </Button>
      </div>

      {!canFold && (
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white/60">
          {isClubs ? 'Clubs turned up — folding locked' : 'Bidder must stay in'}
        </p>
      )}
    </div>
  );
}

