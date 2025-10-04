/**
 * @module pages/HomePage
 * @description Home page with authentication and game creation
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createGame } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';

export function HomePage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, playerName } = useAuth();
  const { isLoading, error, setError, setLoading } = useUIStore();
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || name.length < 2 || name.length > 20) {
      setError('Name must be between 2 and 20 characters');
      return;
    }
    
    try {
      await login(name);
    } catch (err) {
      console.error('Failed to join:', err);
    }
  };

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

  const handleJoinGame = () => {
    if (!gameId || gameId.length === 0) {
      setError('Please enter a game ID');
      return;
    }
    navigate(`/game/${gameId}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-4xl font-bold text-center text-gray-900 mb-2">
            Buck Euchre
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Join a session to start playing
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                minLength={2}
                maxLength={20}
                required
              />
              <p className="text-xs text-gray-500 mt-1">2-20 characters</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Joining...' : 'Join Session'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-2">
          Buck Euchre
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Welcome, {playerName}!
        </p>

        <div className="space-y-4">
          <button
            onClick={handleCreateGame}
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Creating...' : 'Create New Game'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <div>
            <label htmlFor="gameId" className="block text-sm font-medium text-gray-700 mb-2">
              Join Existing Game
            </label>
            <div className="flex gap-2">
              <input
                id="gameId"
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="Enter game ID"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleJoinGame}
                disabled={!gameId}
                className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Join
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
