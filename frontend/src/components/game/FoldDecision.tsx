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
      <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
        <p className="text-center text-gray-600">
          Waiting for other players to decide...
        </p>
      </div>
    );
  }

  const isClubs = gameState.turnUpCard?.suit === 'CLUBS';
  const isBidder = gameState.winningBidderPosition === myPosition;
  const canFold = !isClubs && !isBidder;

  return (
    <div className="bg-amber-50 border-2 border-amber-500 rounded-lg p-6">
      <h3 className="text-xl font-bold text-center mb-2">
        Fold or Stay?
      </h3>
      
      <div className="text-center mb-4">
        <p className="text-gray-700">
          Trump: <span className="font-semibold">{gameState.trumpSuit}</span>
        </p>
        {isClubs && (
          <p className="text-sm text-red-600 mt-1">
            Clubs turned up - no folding allowed!
          </p>
        )}
        {isBidder && (
          <p className="text-sm text-blue-600 mt-1">
            You're the bidder - you must stay!
          </p>
        )}
      </div>
      
      <div className="flex gap-3 justify-center">
        <Button
          onClick={() => makeFoldDecision(false)}
          variant="default"
          size="lg"
          className="min-w-[120px] bg-green-600 hover:bg-green-700"
        >
          Stay In
        </Button>
        
        <Button
          onClick={() => makeFoldDecision(true)}
          variant="outline"
          size="lg"
          className="min-w-[120px]"
          disabled={!canFold}
        >
          Fold
        </Button>
      </div>
      
      {!canFold && (
        <p className="text-xs text-center text-gray-500 mt-2">
          {isClubs ? 'Cannot fold when clubs are trump' : 'Bidder cannot fold'}
        </p>
      )}
    </div>
  );
}

