/**
 * @module components/game/Scoreboard
 * @description Display player scores and game status
 */

import { useEffect, useRef } from 'react';
import type { Player, GamePhase } from '@buck-euchre/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export interface ScoreboardProps {
  players: Player[];
  currentPlayerPosition: number | null;
  phase: GamePhase;
  trumpSuit?: string | null;
  winningBidderPosition?: number | null;
  winningBid?: number | null;
}

const suitSymbols = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
};

export function Scoreboard({ 
  players, 
  currentPlayerPosition, 
  phase,
  trumpSuit,
  winningBidderPosition,
  winningBid
}: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const leader = sortedPlayers[0];
  const previousScores = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Update previous scores after a delay to show animation
    const timeout = setTimeout(() => {
      players.forEach(player => {
        previousScores.current.set(player.id, player.score);
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [players]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Scoreboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2" role="list" aria-label="Player scores">
          {players.map((player, index) => {
            const isCurrentTurn = currentPlayerPosition === index;
            const isBidder = winningBidderPosition === index;
            const isLeader = player.id === leader.id;
            const hasFolded = player.folded;
            const previousScore = previousScores.current.get(player.id);
            const scoreChanged = previousScore !== undefined && previousScore !== player.score;
            
            return (
              <div
                key={player.id}
                role="listitem"
                aria-label={`${player.name}, score ${player.score}, ${player.tricksTaken} tricks${isCurrentTurn ? ', current turn' : ''}`}
                className={`
                  flex items-center justify-between p-2 sm:p-3 rounded-lg border-2 transition-all duration-300
                  ${isCurrentTurn ? 'border-green-500 bg-green-50 shadow-md scale-105' : 'border-gray-200 bg-white'}
                  ${hasFolded ? 'opacity-50' : ''}
                `}
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span className={`font-semibold text-sm sm:text-base truncate ${isCurrentTurn ? 'text-green-700' : 'text-gray-900'}`}>
                        {player.name || `Player ${index}`}
                      </span>
                      {!player.connected && (
                        <Badge variant="danger" className="text-xs">Offline</Badge>
                      )}
                      {isBidder && (
                        <Badge variant="warning" className="text-xs">Bidder ({winningBid})</Badge>
                      )}
                      {hasFolded && (
                        <Badge variant="default" className="text-xs">Folded</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Pos {index} • Tricks: {player.tricksTaken}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end ml-2">
                  <div 
                    className={`
                      text-xl sm:text-2xl font-bold transition-all duration-500
                      ${player.score <= 0 ? 'text-green-600' : 'text-gray-900'}
                      ${scoreChanged ? 'animate-bounce scale-125' : ''}
                    `}
                  >
                    {player.score}
                  </div>
                  {isLeader && player.score <= 0 && (
                    <span className="text-xs text-green-600 font-semibold animate-pulse">WINNER!</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {trumpSuit && (
          <div 
            className="mt-4 pt-4 border-t border-gray-200 animate-in fade-in slide-in-from-top-2 duration-500"
            role="status"
            aria-label={`Trump suit is ${trumpSuit}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-gray-600">Trump Suit:</span>
              <span className="text-2xl sm:text-3xl animate-pulse">
                {suitSymbols[trumpSuit as keyof typeof suitSymbols] || trumpSuit}
              </span>
            </div>
          </div>
        )}
        
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600">Game Phase:</span>
            <Badge variant="default" className="text-xs">{phase.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
