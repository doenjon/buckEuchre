/**
 * @module components/lobby/CreateGame
 * @description Button to create a new game
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { Plus } from 'lucide-react';

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
      const message = err instanceof Error ? err.message : 'Failed to create game';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCreateGame}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
      aria-label="Create new game"
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          <span>Creating Game...</span>
        </>
      ) : (
        <>
          <Plus className="h-5 w-5" />
          <span>Create New Game</span>
        </>
      )}
    </button>
  );
}
