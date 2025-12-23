/**
 * @module components/game/Scoreboard
 * @description Display player scores and game status
 */

import { useEffect, useRef, useState } from 'react';
import type { Player, GamePhase } from '@buck-euchre/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getRoundHistory } from '@/services/api';

export interface ScoreboardProps {
  players: Player[];
  currentPlayerPosition: number | null;
  phase: GamePhase;
  trumpSuit?: string | null;
  winningBidderPosition?: number | null;
  winningBid?: number | null;
  isClubsTurnUp?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'mobile';
  gameId?: string;
}

export function Scoreboard({
  players,
  currentPlayerPosition,
  phase,
  winningBidderPosition,
  className,
  variant = 'default',
  gameId
}: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const leader = sortedPlayers[0];
  const previousScores = useRef<Map<string, number>>(new Map());
  const [roundHistory, setRoundHistory] = useState<Array<{
    roundNumber: number;
    scores: Record<string, number>;
  }>>([]);

  useEffect(() => {
    // Update previous scores after a delay to show animation
    const timeout = setTimeout(() => {
      players.forEach(player => {
        previousScores.current.set(player.id, player.score);
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [players]);

  // Fetch round history for mobile variant
  useEffect(() => {
    if (variant === 'mobile' && gameId) {
      getRoundHistory(gameId)
        .then(response => {
          setRoundHistory(response.rounds);
        })
        .catch(error => {
          console.error('Failed to fetch round history:', error);
        });
    }
  }, [variant, gameId]);

  const entries = players.map((player, index) => {
    const needsFoldDecision = (
      phase === 'FOLDING_DECISION' &&
      index !== winningBidderPosition &&
      player.foldDecision === 'UNDECIDED'
    );
    const isCurrentTurn = phase === 'FOLDING_DECISION'
      ? needsFoldDecision
      : currentPlayerPosition === index;
    const isLeader = player.id === leader.id;
    const hasFolded = player.folded === true;
    const previousScore = previousScores.current.get(player.id);
    const scoreChanged = previousScore !== undefined && previousScore !== player.score;

    return {
      player,
      index,
      isCurrentTurn,
      isLeader,
      hasFolded,
      scoreChanged,
    };
  });

  if (variant === 'mobile') {
    // Calculate score history for each player
    const scoreHistory: Record<number, number[]> = {};

    // Initialize with starting score (15)
    players.forEach(player => {
      scoreHistory[player.position] = [15];
    });

    // Build cumulative score history from round data
    roundHistory.forEach(round => {
      players.forEach(player => {
        const scoreChange = round.scores[player.position.toString()] || 0;
        const previousScore = scoreHistory[player.position][scoreHistory[player.position].length - 1];
        scoreHistory[player.position].push(previousScore + scoreChange);
      });
    });

    return (
      <div
        className={cn(
          'rounded-xl border border-white/10 bg-white/5 p-3 text-slate-100 shadow-md backdrop-blur',
          className
        )}
      >
        <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
          Score History
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-white/10 bg-white/5">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
              <tr>
                <th className="border-r border-white/10 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  Rnd
                </th>
                {players.map((player, idx) => (
                  <th
                    key={player.id}
                    className={cn(
                      'px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white',
                      idx < players.length - 1 && 'border-r border-white/10'
                    )}
                    title={player.name}
                  >
                    <div className="truncate">{player.name || `P${player.position + 1}`}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Starting scores */}
              <tr className="border-t border-white/10">
                <td className="border-r border-white/10 px-2 py-1.5 text-[10px] text-emerald-200/70">
                  Start
                </td>
                {players.map((player, idx) => (
                  <td
                    key={player.id}
                    className={cn(
                      'px-2 py-1.5 text-center font-medium text-white/70',
                      idx < players.length - 1 && 'border-r border-white/10'
                    )}
                  >
                    15
                  </td>
                ))}
              </tr>

              {/* Round scores */}
              {roundHistory.map((round, roundIdx) => (
                <tr key={round.roundNumber} className="border-t border-white/10">
                  <td className="border-r border-white/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-200">
                    {round.roundNumber}
                  </td>
                  {players.map((player, idx) => {
                    const score = scoreHistory[player.position][roundIdx + 1];
                    return (
                      <td
                        key={player.id}
                        className={cn(
                          'px-2 py-1.5 text-center font-semibold',
                          idx < players.length - 1 && 'border-r border-white/10'
                        )}
                      >
                        {score}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Current score (highlighted) */}
              <tr className="border-t-2 border-emerald-400/50 bg-emerald-500/10">
                <td className="border-r border-white/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Now
                </td>
                {players.map((player, idx) => (
                  <td
                    key={player.id}
                    className={cn(
                      'px-2 py-1.5 text-center text-base font-bold text-emerald-100',
                      idx < players.length - 1 && 'border-r border-white/10'
                    )}
                  >
                    {player.score}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'rounded-3xl border border-white/10 bg-white/5 p-3 text-slate-100 shadow-lg backdrop-blur',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
            Table tally
          </p>
          <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/70">
            {phase.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2" role="list" aria-label="Player scores">
          {entries.map(({ player, index, isCurrentTurn, hasFolded }) => (
            <div
              key={player.id}
              className={cn(
                'flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-2 text-[11px] text-white/90 transition-colors duration-200',
                isCurrentTurn && 'ring-1 ring-emerald-400/70 bg-emerald-500/10 shadow-[0_18px_40px_-20px_rgba(16,185,129,0.8)]',
                hasFolded && 'opacity-60'
              )}
              role="listitem"
              aria-label={`${player.name}, score ${player.score}, seat ${index + 1}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn(
                  'truncate font-semibold',
                  isCurrentTurn ? 'text-emerald-100' : 'text-white'
                )}>
                  {player.name || `Player ${index + 1}`}
                </span>
                <span className="text-base font-bold text-emerald-100">{player.score}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[9px] uppercase tracking-[0.28em] text-emerald-200/70">
                <span>Seat {index + 1}</span>
                <span>Tricks {player.tricksTaken}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {!player.connected && (
                  <Badge variant="danger" className="text-[9px] uppercase tracking-wide">
                    Offline
                  </Badge>
                )}
                {player.foldDecision === 'UNDECIDED' && phase === 'FOLDING_DECISION' && index !== winningBidderPosition && (
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-white/80">
                    Decide
                  </Badge>
                )}
                {hasFolded && (
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-slate-200">
                    Folded
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
      <CardContent className="pt-4 sm:pt-5">
        <div className="space-y-2 sm:space-y-3" role="list" aria-label="Player scores">
          {players.map((player, index) => {
            const needsFoldDecision = (
              phase === 'FOLDING_DECISION' &&
              index !== winningBidderPosition &&
              player.foldDecision === 'UNDECIDED'
            );
            const isCurrentTurn = phase === 'FOLDING_DECISION'
              ? needsFoldDecision
              : currentPlayerPosition === index;
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
                className={cn(
                  'flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition-all duration-300 sm:gap-4 sm:px-4 sm:py-3',
                  isCurrentTurn && 'ring-1 ring-emerald-400/70 shadow-[0_18px_40px_-20px_rgba(16,185,129,0.8)]',
                  hasFolded && 'opacity-60'
                )}
              >
                <div className="flex flex-1 min-w-0 items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span
                        className={cn(
                          'truncate text-sm font-semibold sm:text-base',
                          isCurrentTurn ? 'text-emerald-200' : 'text-white'
                        )}
                      >
                        {player.name || `Player ${index + 1}`}
                      </span>
                      {!player.connected && (
                        <Badge variant="danger" className="text-[10px] uppercase tracking-wide">
                          Offline
                        </Badge>
                      )}
                      {hasFolded && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-slate-200">
                          Folded
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/60">
                      Seat {index + 1} ? Tricks {player.tricksTaken}
                    </div>
                    {isLeader && player.score <= 0 && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                        In the lead
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2 flex flex-col items-end">
                  <div
                    className={cn(
                      'text-lg font-bold text-emerald-100 transition-all duration-500 sm:text-2xl',
                      scoreChanged && 'animate-bounce scale-110 text-white'
                    )}
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

        <div className="mt-4 border-t border-white/5 pt-4 sm:mt-5 sm:pt-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-emerald-200/80 sm:text-xs">
            <span className="truncate pr-2">Game phase</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white">
              {phase.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
