/**
 * @module components/game/Scoreboard
 * @description Display player scores and game status
 */

import { useEffect, useRef } from 'react';
import type { Player, GamePhase } from '@buck-euchre/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ScoreHistoryRow {
  round: number;
  scoresByPlayerId: Record<string, number>;
}

export interface ScoreboardProps {
  players: Player[];
  currentPlayerPosition: number | null;
  phase: GamePhase;
  round?: number;
  /**
   * Completed-round cumulative scores (round 0..N). This should ONLY include
   * rounds that are finished (i.e. recorded when the game is in ROUND_OVER).
   * This is tracked in `GameBoard` so it persists on mobile when the popup unmounts.
   */
  scoreHistory?: ScoreHistoryRow[];
  trumpSuit?: string | null;
  winningBidderPosition?: number | null;
  winningBid?: number | null;
  isClubsTurnUp?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'mobile';
}

export function Scoreboard({
  players,
  currentPlayerPosition,
  phase,
  round = 1,
  scoreHistory = [],
  winningBidderPosition,
  className,
  variant = 'default'
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
    // Create table with rounds as rows and players as columns.
    // IMPORTANT: We intentionally do NOT show the in-progress round here; only completed rounds.
    const allRounds = [...scoreHistory].sort((a, b) => a.round - b.round);

    // Sort players by position for consistent column order
    const sortedByPosition = [...players].sort((a, b) => a.position - b.position);

    return (
      <div
        className={cn(
          'rounded-xl border border-white/10 bg-white/5 p-2 text-slate-100 shadow-md backdrop-blur',
          className
        )}
      >
        {allRounds.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-2 py-1.5 text-left font-semibold text-emerald-200/80">Round</th>
                  {sortedByPosition.map((player) => (
                    <th 
                      key={player.id}
                      className="px-2 py-1.5 text-center font-semibold text-white truncate max-w-[60px]"
                      title={player.name || `Player ${player.position + 1}`}
                    >
                      {player.name || `P${player.position + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRounds.map((roundScore, roundIndex) => {
                  // Get previous round to detect bucks (score increase of 5)
                  const previousRound = roundIndex > 0 ? allRounds[roundIndex - 1] : null;
                  
                  return (
                    <tr 
                      key={roundScore.round}
                      className={cn(
                        "border-b border-white/5",
                        phase === 'ROUND_OVER' && roundScore.round === round && "bg-emerald-500/10"
                      )}
                    >
                      <td className="px-2 py-1.5 text-emerald-200/70 font-medium">
                        {roundScore.round}
                      </td>
                      {sortedByPosition.map((player) => {
                        const score = roundScore.scoresByPlayerId[player.id] ?? player.score;
                        // Check if this player got bucked (score increased by 5 from previous round)
                        const previousScore = previousRound?.scoresByPlayerId[player.id];
                        const gotBucked = previousScore !== undefined && score === previousScore + 5;
                        
                        return (
                          <td 
                            key={player.id}
                            className={cn(
                              "px-2 py-1.5 text-center font-bold",
                              gotBucked ? "text-red-400" : "text-emerald-100"
                            )}
                          >
                            {score}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5" role="list" aria-label="Player scores">
            {entries.map(({ player, index, hasFolded }) => (
              <div
                key={player.id}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-1.5 text-center transition-colors duration-200',
                  hasFolded && 'opacity-50'
                )}
                role="listitem"
                aria-label={`${player.name}, score ${player.score}`}
              >
                <span 
                  className="text-[11px] md:text-xs font-semibold truncate max-w-full px-0.5 text-white"
                  title={player.name || `Player ${index + 1}`}
                >
                  {player.name || `P${index + 1}`}
                </span>
                <span className="text-base font-bold text-emerald-100">{player.score}</span>
              </div>
            ))}
          </div>
        )}
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
