/**
 * @module components/game/TurnIndicator
 * @description Enhanced turn indicator with animations and connection status
 */

import { Clock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GamePhase, Player } from '@buck-euchre/shared';

interface TurnIndicatorProps {
  currentPlayer: Player | null;
  isMyTurn: boolean;
  phase: GamePhase;
  className?: string;
}

const phaseActions: Record<GamePhase, string> = {
  'WAITING_FOR_PLAYERS': 'waiting for players',
  'DEALING': 'dealing cards',
  'TRUMP_REVEAL': 'revealing trump card',
  'BIDDING': 'place a bid',
  'DECLARING_TRUMP': 'declare trump',
  'FOLDING_DECISION': 'decide to fold or stay',
  'PLAYING': 'play a card',
  'ROUND_OVER': 'view round results',
  'GAME_OVER': 'game over',
};

export function TurnIndicator({ currentPlayer, isMyTurn, phase, className }: TurnIndicatorProps) {
  const actionText = phaseActions[phase] || 'take action';

  if (phase === 'WAITING_FOR_PLAYERS' || phase === 'GAME_OVER') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isMyTurn ? `Your turn to ${actionText}` : `Waiting for ${currentPlayer?.name || 'player'}`}
      className={cn(
        'flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm transition-all duration-300 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4',
        isMyTurn
          ? 'border-emerald-300/60 bg-emerald-400/20 text-white shadow-lg backdrop-blur'
          : 'border-white/20 bg-white/10 text-white/90 backdrop-blur',
        className
      )}
    >
      {isMyTurn ? (
        <div className="flex flex-1 items-center justify-center gap-3 sm:justify-start">
          <Sparkles className="h-5 w-5 text-emerald-200" />
          <span className="text-center text-base font-semibold uppercase tracking-[0.25em] sm:text-left sm:text-lg">
            Your turn to {actionText}
          </span>
        </div>
      ) : currentPlayer ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 sm:flex-row sm:justify-start sm:gap-3">
          <div className="flex items-center gap-2 text-white/80">
            <Clock className="h-5 w-5 text-white/60" />
            <span className="text-center text-sm font-medium uppercase tracking-[0.2em] sm:text-left">
              Waiting for {currentPlayer.name} to {actionText}
            </span>
          </div>
          {!currentPlayer.connected && (
            <Badge variant="destructive" className="bg-red-100/90 text-red-700">
              Disconnected
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-white/80 sm:justify-start">
          <Clock className="h-5 w-5 text-white/60" />
          <span className="text-sm font-medium uppercase tracking-[0.2em]">
            {phase === 'DEALING' && 'Dealing cards'}
            {phase === 'TRUMP_REVEAL' && 'Revealing trump card'}
            {phase === 'ROUND_OVER' && 'Round complete'}
          </span>
        </div>
      )}
    </div>
  );
}
