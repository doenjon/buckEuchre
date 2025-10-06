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
    <Card className="overflow-hidden rounded-3xl !border-white/15 !bg-white/80 shadow-2xl backdrop-blur">
      <CardHeader className="border-b border-white/40 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-600">Table</p>
            <CardTitle className="text-xl font-semibold text-slate-900">Scoreboard</CardTitle>
          </div>
          {trumpSuit && (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white text-2xl font-semibold text-emerald-600 shadow-sm"
              role="status"
              aria-label={`Trump suit is ${trumpSuit}`}
            >
              {suitSymbols[trumpSuit as keyof typeof suitSymbols] || trumpSuit}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-3" role="list" aria-label="Player scores">
          {players.map((player, index) => {
            const needsFoldDecision = (
              phase === 'FOLDING_DECISION' &&
              index !== winningBidderPosition &&
              player.foldDecision === 'UNDECIDED'
            );
            const isCurrentTurn = phase === 'FOLDING_DECISION'
              ? needsFoldDecision
              : currentPlayerPosition === index;
            const isBidder = winningBidderPosition === index;
            const isLeader = player.id === leader.id;
            const isRoundWinner = isLeader && player.score <= 0;
            const hasFolded = player.folded === true;
            const previousScore = previousScores.current.get(player.id);
            const scoreChanged = previousScore !== undefined && previousScore !== player.score;

            return (
              <div
                key={player.id}
                role="listitem"
                aria-label={`${player.name}, score ${player.score}, ${player.tricksTaken} tricks${isCurrentTurn ? ', current turn' : ''}`}
                className={`
                  group rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm transition-all duration-300
                  ${isCurrentTurn ? 'border-emerald-400/80 bg-emerald-50/80 shadow-lg ring-2 ring-emerald-200/70' : ''}
                  ${hasFolded ? 'opacity-60' : ''}
                `}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold text-slate-900 sm:text-base ${isCurrentTurn ? 'text-emerald-700' : ''}`}>
                        {player.name || `Player ${index}`}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Tricks: {player.tricksTaken}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-xl font-bold text-slate-900 transition-all duration-500 sm:text-2xl ${scoreChanged || isRoundWinner ? 'text-emerald-600' : ''}`}
                      >
                        {player.score}
                      </p>
                      {isRoundWinner ? (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-600">
                          Winner
                        </span>
                      ) : isLeader ? (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Leader
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">Seat {index + 1}</span>
                    {!player.connected && (
                      <Badge variant="danger" className="bg-red-100/80 text-red-700">
                        Offline
                      </Badge>
                    )}
                    {isBidder && (
                      <Badge variant="warning" className="bg-amber-100/80 text-amber-700">
                        Bidder{winningBid ? ` (${winningBid})` : ''}
                      </Badge>
                    )}
                    {hasFolded && (
                      <Badge variant="default" className="bg-slate-200/80 text-slate-700">
                        Folded
                      </Badge>
                    )}
                    {needsFoldDecision && !hasFolded && (
                      <Badge variant="success" className="bg-emerald-100/90 text-emerald-700">
                        Decision needed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-slate-400">
          Phase: <span className="text-slate-600">{phase.replace(/_/g, ' ')}</span>
        </p>
      </CardContent>
    </Card>
  );
}
