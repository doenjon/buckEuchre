/**
 * @module components/lobby/CreateGame
 * @description Button to create a new game
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CreateGame() {
  const navigate = useNavigate();
  const { setError } = useUIStore();
  const [loading, setLoading] = useState(false);

  const handleCreateGame = async () => {
    try {
      setLoading(true);
      const response = await createGame();
      navigate(`/game/${response.gameId}`);
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Failed to create game';
      
      // Improve error message for users already in a game
      if (message.includes('already in an active game') || message.includes('User is already in an active game')) {
        message = 'You are already in an active game. Please leave your current game(s) above before creating a new one.';
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCreateGame}
      disabled={loading}
      variant="primary"
      size="lg"
      className="w-full justify-center gap-2"
      aria-label="Create new game"
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Creating game…</span>
        </>
      ) : (
        <>
          <Plus className="h-5 w-5" />
          <span>Create new game</span>
        </>
      )}
    </Button>
  );
}
