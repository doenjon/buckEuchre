/**
 * @module components/game/Scoreboard
 * @description Display player scores and game status
 */

import { useEffect, useRef } from 'react';
import type { Player, GamePhase } from '@buck-euchre/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ScoreboardProps {
  players: Player[];
  currentPlayerPosition: number | null;
  phase: GamePhase;
  trumpSuit?: string | null;
  winningBidderPosition?: number | null;
  winningBid?: number | null;
  className?: string;
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
  winningBid,
  className
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
    <Card
      className={cn(
        'overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-slate-100 shadow-xl backdrop-blur',
        className
      )}
    >
      <CardHeader className="border-b border-white/5 pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
          Table tally
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3" role="list" aria-label="Player scores">
          {players.map((player) => {
            const seat = player.position;
            const needsFoldDecision = (
              phase === 'FOLDING_DECISION' &&
              seat !== winningBidderPosition &&
              player.foldDecision === 'UNDECIDED'
            );
            const isCurrentTurn = phase === 'FOLDING_DECISION'
              ? needsFoldDecision
              : currentPlayerPosition === seat;
            const isBidder = winningBidderPosition === seat;
            const isLeader = player.id === leader.id;
            const isWinner = isLeader && player.score <= 0;
            const hasFolded = player.folded === true;
            const previousScore = previousScores.current.get(player.id);
            const scoreChanged = previousScore !== undefined && previousScore !== player.score;

            return (
              <div
                key={player.id}
                role="listitem"
                aria-label={`${player.name}, score ${player.score}, ${player.tricksTaken} tricks${isCurrentTurn ? ', current turn' : ''}`}
                className={`
                  flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:px-4 sm:py-3
                  transition-all duration-300
                  ${isCurrentTurn ? 'ring-1 ring-emerald-400/70 shadow-[0_18px_40px_-20px_rgba(16,185,129,0.8)]' : ''}
                  ${hasFolded ? 'opacity-60' : ''}
                `}
              >
                <div className="flex flex-1 min-w-0 items-center gap-3">
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span className={`truncate text-sm font-semibold sm:text-base ${isCurrentTurn ? 'text-emerald-200' : 'text-white'}`}>
                        {player.name || `Player ${seat + 1}`}
                      </span>
                      {!player.connected && (
                        <Badge variant="danger" className="text-[10px] uppercase tracking-wide">
                          Offline
                        </Badge>
                      )}
                      {isBidder && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-emerald-200">
                          {winningBid !== null && winningBid !== undefined
                            ? `Bidder ${winningBid}`
                            : 'Bidder'}
                        </Badge>
                      )}
                      {hasFolded && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-slate-200">
                          Folded
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/60">
                      Seat {seat + 1} • Tricks {player.tricksTaken}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end ml-2">
                  <div
                    className={`
                      text-xl font-bold transition-all duration-500 sm:text-2xl
                      ${isWinner ? 'text-green-600' : 'text-emerald-100'}
                      ${scoreChanged ? 'animate-bounce scale-110 text-white' : ''}
                    `}
                  >
                    {player.score}
                  </div>
                  {isWinner && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                      WINNER!
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {trumpSuit && (
          <div
            className="mt-5 border-t border-white/5 pt-5 animate-in fade-in slide-in-from-top-2 duration-500"
            role="status"
            aria-label={`Trump suit is ${trumpSuit}`}
          >
            <div className="flex items-center justify-between text-sm uppercase tracking-[0.3em] text-emerald-200/80">
              <span>Trump suit</span>
              <span className="text-3xl font-semibold text-white">
                {suitSymbols[trumpSuit as keyof typeof suitSymbols] || trumpSuit}
              </span>
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-white/5 pt-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-200/80">
            <span>Game phase</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white">
              {phase.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
