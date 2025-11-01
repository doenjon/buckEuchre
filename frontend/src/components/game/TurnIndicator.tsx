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
        'turn-indicator rounded-xl md:rounded-2xl border border-white/10 bg-white/5 p-2 md:p-3 lg:p-4 transition-all duration-300 backdrop-blur',
        isMyTurn
          ? 'ring-1 ring-emerald-400/60 shadow-md md:shadow-[0_20px_50px_-25px_rgba(16,185,129,0.65)]'
          : 'text-slate-200',
        className
      )}
    >
      {isMyTurn ? (
        <div className="flex items-center justify-center gap-2 md:gap-3 text-emerald-200">
          <Sparkles className="h-4 w-4 md:h-5 md:w-5 animate-bounce" />
          <span className="text-[10px] md:text-sm font-semibold uppercase tracking-[0.25em] md:tracking-[0.35em]">
            Your turn • {actionText}
          </span>
        </div>
      ) : currentPlayer ? (
        <div className="flex flex-col items-center gap-1 md:gap-2 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center gap-1.5 md:gap-2 text-slate-200">
            <Clock className="h-3.5 w-3.5 md:h-5 md:w-5 text-emerald-300/80" />
            <span className="text-[10px] md:text-sm font-medium">
              Waiting for {currentPlayer.name} to {actionText}
            </span>
          </div>
          {!currentPlayer.connected && (
            <Badge variant="destructive" className="text-[9px] md:text-xs">
              Disconnected
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 md:gap-2 text-slate-200">
          <Clock className="h-3.5 w-3.5 md:h-5 md:w-5 text-emerald-300/80" />
          <span className="text-[10px] md:text-sm">
            {phase === 'DEALING' && 'Dealing cards…'}
            {phase === 'TRUMP_REVEAL' && 'Revealing trump card…'}
            {phase === 'ROUND_OVER' && 'Round complete'}
          </span>
        </div>
      )}
    </div>
  );
}
