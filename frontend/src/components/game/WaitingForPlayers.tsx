/**
 * @module components/game/WaitingForPlayers
 * @description Component shown while waiting for players to join
 */

import { Users, Copy, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface WaitingForPlayersProps {
  gameId: string;
  playerCount: number;
  playersNeeded: number;
}

export function WaitingForPlayers({ 
  gameId, 
  playerCount, 
  playersNeeded 
}: WaitingForPlayersProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyGameUrl = async () => {
    const gameUrl = `${window.location.origin}/game/${gameId}`;
    await navigator.clipboard.writeText(gameUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-6">
          {/* Icon */}
          <div className="relative">
            <Users className="h-16 w-16 text-primary" />
            <Badge 
              className="absolute -top-2 -right-2 px-2 py-1"
              variant={playerCount === 4 ? 'success' : 'default'}
            >
              {playerCount}/4
            </Badge>
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">
              Waiting for Players
            </h2>
            <p className="text-muted-foreground">
              {playersNeeded === 1 
                ? 'Waiting for 1 more player...'
                : `Waiting for ${playersNeeded} more players...`
              }
            </p>
          </div>

          {/* Player Progress */}
          <div className="w-full">
            <div className="flex gap-2 justify-center mb-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-3 w-12 rounded-full transition-colors ${
                    i <= playerCount
                      ? 'bg-primary'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {playerCount} player{playerCount !== 1 ? 's' : ''} joined
            </p>
          </div>

          {/* Share Game Link */}
          <div className="w-full space-y-2">
            <p className="text-sm font-medium text-center">
              Share this game with friends:
            </p>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-100 rounded-md text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {gameId}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyGameUrl}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Loading Animation */}
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </Card>
    </div>
  );
}
