/**
 * @module components/game/Scoreboard
 * @description Display player scores and game status
 */

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Scoreboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {players.map((player, index) => {
            const isCurrentTurn = currentPlayerPosition === index;
            const isBidder = winningBidderPosition === index;
            const isLeader = player.id === leader.id;
            const hasFolded = player.folded;
            
            return (
              <div
                key={player.id}
                className={`
                  flex items-center justify-between p-3 rounded-lg border-2 transition-colors
                  ${isCurrentTurn ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}
                  ${hasFolded ? 'opacity-50' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isCurrentTurn ? 'text-green-700' : 'text-gray-900'}`}>
                        {player.name || `Player ${index}`}
                      </span>
                      {!player.connected && (
                        <Badge variant="danger">Offline</Badge>
                      )}
                      {isBidder && (
                        <Badge variant="warning">Bidder ({winningBid})</Badge>
                      )}
                      {hasFolded && (
                        <Badge variant="default">Folded</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Position {index} • Tricks: {player.tricksTaken}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                  <div className={`text-2xl font-bold ${player.score <= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {player.score}
                  </div>
                  {isLeader && player.score <= 0 && (
                    <span className="text-xs text-green-600 font-semibold">WINNER!</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {trumpSuit && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Trump Suit:</span>
              <span className="text-2xl">
                {suitSymbols[trumpSuit as keyof typeof suitSymbols] || trumpSuit}
              </span>
            </div>
          </div>
        )}
        
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Game Phase:</span>
            <Badge variant="default">{phase}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
