/**
 * @module components/lobby/AddAIButton
 * @description Button to add AI players to a game
 */

import { useState } from 'react';
import { Bot } from 'lucide-react';
import { addAIToGame } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';

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
    <button
      onClick={handleAddAI}
      disabled={adding}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Add AI player"
    >
      <Bot className="h-4 w-4" />
      {adding ? 'Adding...' : 'Add AI'}
    </button>
  );
}
