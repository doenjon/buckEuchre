/**
 * @module components/game/PlayerStatusIndicators
 * @description Display status indicators for players with animations
 */

import { useMemo, useEffect, useState } from 'react';
import { Crown, CircleDot, Gavel, Award } from 'lucide-react';
import type { GameState, PlayerPosition } from '@buck-euchre/shared';

interface PlayerStatusIndicatorsProps {
  gameState: GameState;
  playerPosition: PlayerPosition;
  size?: 'sm' | 'md';
}

export function PlayerStatusIndicators({
  gameState,
  playerPosition,
  size = 'sm',
}: PlayerStatusIndicatorsProps) {
  const { players, dealerPosition, winningBidderPosition, phase } = gameState;
  
  const player = players.find(p => p.position === playerPosition);
  
  // Track previous leader for animation
  const [previousLeader, setPreviousLeader] = useState<PlayerPosition | null>(null);
  const [isLeaderTransitioning, setIsLeaderTransitioning] = useState(false);

  // Determine current leader (lowest score)
  const currentLeader = useMemo(() => {
    const minScore = Math.min(...players.map(p => p.score));
    return players.find(p => p.score === minScore)?.position ?? null;
  }, [players]);

  // Detect leader change and trigger animation
  useEffect(() => {
    if (previousLeader !== null && currentLeader !== null && previousLeader !== currentLeader) {
      setIsLeaderTransitioning(true);
      const timer = setTimeout(() => setIsLeaderTransitioning(false), 600);
      return () => clearTimeout(timer);
    }
    setPreviousLeader(currentLeader);
  }, [currentLeader, previousLeader]);

  const isLeader = currentLeader === playerPosition;
  const isDealer = dealerPosition === playerPosition;
  const isBidWinner = winningBidderPosition === playerPosition && 
                      phase !== 'WAITING_FOR_PLAYERS' && 
                      phase !== 'DEALING';
  const tricksWon = player?.tricksTaken ?? 0;
  
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const textSize = size === 'sm' ? 'text-[8px]' : 'text-[9px]';
  
  // Don't show anything if no indicators are active
  if (!isLeader && !isDealer && !isBidWinner && tricksWon === 0) {
    return <div className="h-3 w-full" />;
  }

  return (
    <div className="flex items-center justify-center gap-1 h-3 w-full">
      {/* Crown - Current Leader */}
      {isLeader && (
        <div 
          className={`
            flex items-center gap-0.5 transition-all duration-300
            ${isLeaderTransitioning ? 'animate-status-transfer' : 'animate-pulse-glow'}
          `}
          title="Leader (lowest score)"
          role="img"
          aria-label="Current leader"
        >
          <Crown 
            className={`${iconSize} text-yellow-400 fill-yellow-400`}
          />
        </div>
      )}

      {/* Dealer Indicator */}
      {isDealer && (
        <div 
          className="flex items-center gap-0.5 animate-fade-in"
          title="Dealer"
          role="img"
          aria-label="Dealer"
        >
          <CircleDot className={`${iconSize} text-blue-400`} />
        </div>
      )}

      {/* Bid Winner Indicator */}
      {isBidWinner && (
        <div 
          className="flex items-center gap-0.5 animate-fade-in"
          title="Won the bidding"
          role="img"
          aria-label="Won the bidding"
        >
          <Gavel className={`${iconSize} text-purple-400`} />
        </div>
      )}

      {/* Tricks Won */}
      {tricksWon > 0 && (
        <div 
          className="flex items-center gap-0.5 animate-fade-in"
          title={`${tricksWon} trick${tricksWon > 1 ? 's' : ''} won`}
          role="img"
          aria-label={`${tricksWon} tricks won`}
        >
          <Award className={`${iconSize} text-emerald-400`} />
          <span className={`${textSize} font-semibold text-emerald-300`}>
            {tricksWon}
          </span>
        </div>
      )}
    </div>
  );
}
