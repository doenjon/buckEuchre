/**
 * @module pages/GamePage
 * @description Main game page
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGame';
import { useAuthStore } from '@/stores/authStore';

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const { joinGame, gameState, myPosition, setMyPosition } = useGame();
  const { playerId } = useAuthStore();

  // Check authentication
  useEffect(() => {
    if (!checkAuth()) {
      navigate('/');
    }
  }, [checkAuth, navigate]);

  // Join game when component mounts
  useEffect(() => {
    if (gameId && playerId) {
      joinGame(gameId);
    }
  }, [gameId, playerId, joinGame]);

  // Set player position when game state updates
  useEffect(() => {
    if (gameState && playerId && myPosition === null) {
      const playerIndex = gameState.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        setMyPosition(playerIndex);
      }
    }
  }, [gameState, playerId, myPosition, setMyPosition]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading game...</h2>
          <p className="text-gray-600">Connecting to game {gameId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-4">
          Buck Euchre - Game {gameId?.slice(0, 8)}
        </h1>
        
        <div className="bg-white rounded-lg shadow-xl p-8">
          <p className="text-gray-600 text-center mb-4">
            Game components will be added in next tasks
          </p>
          
          <div className="space-y-2">
            <p><strong>Phase:</strong> {gameState.phase}</p>
            <p><strong>Players:</strong> {gameState.players.length}/4</p>
            <p><strong>Your Position:</strong> {myPosition !== null ? myPosition : 'Unknown'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
