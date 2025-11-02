/**
 * @module components/game/PlayerStatusIndicators
 * @description Display status indicators for players with animations
 */

import { useMemo, useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
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
  const { players, dealerPosition, phase } = gameState;
  
  const player = players.find(p => p.position === playerPosition);
  
  // Track previous leader for animation
  const [previousLeader, setPreviousLeader] = useState<PlayerPosition | null>(null);
  const [isLeaderTransitioning, setIsLeaderTransitioning] = useState(false);

  // Create a stable key from scores - only recalculate when scores actually change
  const scoresString = useMemo(() => players.map(p => p.score).join(','), 
    [players.map(p => `${p.position}:${p.score}`).join('|')]
  );
  
  // Determine current leader(s) - all players tied for lowest score
  // Show crown for leaders, but not when ALL players are tied (4-way tie)
  const currentLeaders = useMemo(() => {
    const scores = players.map(p => p.score);
    const minScore = Math.min(...scores);
    const leadersAtMinScore = players.filter(p => p.score === minScore);
    // Don't show crown if all players are tied (4-way tie on first hand or later)
    if (leadersAtMinScore.length === players.length) {
      return [];
    }
    // Show crown for 2-way or 3-way ties - sort to ensure stable reference
    const leaderPositions = leadersAtMinScore.map(p => p.position).sort();
    return leaderPositions;
    // Only depend on scores string, not entire players array
  }, [scoresString, players.length]);

  // Detect leader change and trigger animation
  useEffect(() => {
    // Use sorted array from useMemo (already sorted, no need to sort again)
    const currentLeaderStr = currentLeaders.join(',');
    const prevLeaderStr = previousLeader ? previousLeader.toString() : '';
    if (prevLeaderStr && currentLeaderStr && prevLeaderStr !== currentLeaderStr) {
      setIsLeaderTransitioning(true);
      const timer = setTimeout(() => setIsLeaderTransitioning(false), 600);
      return () => clearTimeout(timer);
    }
    // Only update previousLeader if leaders actually changed
    const newLeader = currentLeaders.length > 0 ? currentLeaders[0] : null;
    if (previousLeader !== newLeader) {
      setPreviousLeader(newLeader);
    }
  }, [currentLeaders.join(','), previousLeader]);

  const isLeader = currentLeaders.includes(playerPosition);
  const isDealer = dealerPosition === playerPosition;
  const tricksWon = player?.tricksTaken ?? 0;
  const hasFolded = player?.folded === true;
  
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  
  // Determine if we should show the trick counter
  // Show during PLAYING and ROUND_OVER phases (but not for folded players)
  const shouldShowTrickCounter = !hasFolded && (phase === 'PLAYING' || phase === 'ROUND_OVER');
  
  // Don't show anything if no indicators are active
  if (!isLeader && !isDealer && !shouldShowTrickCounter) {
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
          <span className="text-[14px] leading-none" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.3))' }}>🃏</span>
        </div>
      )}

      {/* Tricks Won - Number (show during playing and after until next hand, but not for folded players) */}
      {shouldShowTrickCounter && (
        <div 
          className="flex items-center justify-center animate-fade-in gap-0.5"
          title={`${tricksWon} trick${tricksWon > 1 ? 's' : ''} won`}
          role="img"
          aria-label={`${tricksWon} tricks won`}
        >
          <span className="text-[9px] font-semibold text-emerald-300/70 leading-none">
            Tricks:
          </span>
          <span className="text-[10px] font-bold text-emerald-300 leading-none">
            {tricksWon}
          </span>
        </div>
      )}
    </div>
  );
}
