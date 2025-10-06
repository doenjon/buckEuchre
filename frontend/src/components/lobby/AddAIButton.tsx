/**
 * @module components/lobby/AddAIButton
 * @description Button to add AI players to a game
 */

import { useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { addAIToGame } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';

interface AddAIButtonProps {
  gameId: string;
  onAIAdded?: () => void;
}

export function AddAIButton({ gameId, onAIAdded }: AddAIButtonProps) {
  const [adding, setAdding] = useState(false);
  const { setError } = useUIStore();

  const handleAddAI = async () => {
    try {
      setAdding(true);
      await addAIToGame(gameId, {
        difficulty: 'medium',
      });
      
      // Notify parent component to refresh
      if (onAIAdded) {
        onAIAdded();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add AI player';
      setError(message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Button
      onClick={handleAddAI}
      disabled={adding}
      size="sm"
      className="gap-2"
      aria-label="Add AI player"
    >
      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
      {adding ? 'Adding…' : 'Add AI'}
    </Button>
  );
}
