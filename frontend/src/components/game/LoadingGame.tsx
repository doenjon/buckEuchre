/**
 * @module components/game/LoadingGame
 * @description Loading state component for game initialization
 */

import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface LoadingGameProps {
  message?: string;
}

export function LoadingGame({ message = 'Loading game...' }: LoadingGameProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <h2 className="text-xl font-semibold text-center">{message}</h2>
          <p className="text-sm text-muted-foreground text-center">
            Please wait while we set everything up...
          </p>
        </div>
      </Card>
    </div>
  );
}
