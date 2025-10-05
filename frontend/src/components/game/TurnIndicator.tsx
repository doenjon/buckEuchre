/**
 * @module components/game/TurnIndicator
 * @description Enhanced turn indicator with animations and connection status
 */

import { Clock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GamePhase, PlayerPosition, Player } from '@buck-euchre/shared';

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
      className={cn(
        'turn-indicator p-4 rounded-lg transition-all duration-300',
        isMyTurn
          ? 'bg-green-50 border-2 border-green-500 animate-pulse shadow-lg'
          : 'bg-gray-50 border border-gray-200',
        className
      )}
    >
      {isMyTurn ? (
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-green-600 animate-bounce" />
          <span className="font-bold text-green-900 text-lg">
            Your turn to {actionText}!
          </span>
        </div>
      ) : currentPlayer ? (
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <span className="text-gray-700">
            Waiting for {currentPlayer.name} to {actionText}
          </span>
          {!currentPlayer.connected && (
            <Badge variant="destructive" className="ml-2">
              Disconnected
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <span className="text-gray-700">
            {phase === 'DEALING' && 'Dealing cards...'}
            {phase === 'TRUMP_REVEAL' && 'Revealing trump card...'}
            {phase === 'ROUND_OVER' && 'Round complete'}
          </span>
        </div>
      )}
    </div>
  );
}
