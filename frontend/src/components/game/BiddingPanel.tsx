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
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <p className="text-center text-gray-600">
          Waiting for other players to bid...
        </p>
        {currentBid !== null && (
          <p className="text-center font-semibold mt-2">
            Current bid: {currentBid}
          </p>
        )}
      </div>
    );
  }

  const availableBids = [2, 3, 4, 5].filter(bid => 
    currentBid === null || bid > currentBid
  );

  return (
    <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
      <h3 className="text-xl font-bold text-center mb-4">Your Turn to Bid</h3>
      
      {currentBid !== null && (
        <p className="text-center text-gray-700 mb-4">
          Current bid: <span className="font-semibold">{currentBid}</span>
        </p>
      )}
      
      <div className="flex gap-2 justify-center flex-wrap">
        {availableBids.map(bid => (
          <Button
            key={bid}
            onClick={() => placeBid(bid as 2 | 3 | 4 | 5)}
            variant="default"
            size="lg"
            className="min-w-[80px]"
          >
            Bid {bid}
          </Button>
        ))}
        
        <Button
          onClick={() => placeBid('PASS')}
          variant="outline"
          size="lg"
          className="min-w-[80px]"
        >
          Pass
        </Button>
      </div>
    </div>
  );
}

