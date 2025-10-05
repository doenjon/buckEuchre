/**
 * @module components/lobby/GameList
 * @description List of available games in the lobby
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listGames } from '@/services/api';
import type { GameSummary } from '@buck-euchre/shared';
import { useUIStore } from '@/stores/uiStore';
import { Users, Clock, Play } from 'lucide-react';
import { AddAIButton } from './AddAIButton';

export function GameList() {
  const navigate = useNavigate();
  const { setError } = useUIStore();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await listGames();
      setGames(response.games);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load games';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    
    // Auto-refresh game list every 5 seconds
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinGame = (gameId: string | undefined) => {
    if (!gameId) {
      setError('Invalid game ID');
      return;
    }
    navigate(`/game/${gameId}`);
  };

  const getStatusBadge = (status: GameSummary['status']) => {
    const statusColors = {
      WAITING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      IN_PROGRESS: 'bg-green-100 text-green-800 border-green-300',
      COMPLETED: 'bg-gray-100 text-gray-800 border-gray-300',
    };

    const statusText = {
      WAITING: 'Waiting',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status]}`}>
        {statusText[status]}
      </span>
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  };

  if (loading && games.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No games available</h3>
        <p className="text-gray-600">Create a new game to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Available Games</h2>
        <span className="text-sm text-gray-500">{games.length} games</span>
      </div>

      <div className="space-y-3">
        {games.filter(game => game.gameId).map((game) => (
          <div
            key={game.gameId}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium text-gray-900">
                    {game.creatorName || 'Unknown'}'s Game
                  </h3>
                  {getStatusBadge(game.status)}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>
                      {game.playerCount}/{game.maxPlayers} players
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(game.createdAt)}</span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500 font-mono">
                  ID: {game.gameId?.slice(0, 8) || 'N/A'}...
                </div>
              </div>

              <div className="ml-4 flex items-center gap-2">
                {/* Show Add AI button only for waiting games that aren't full */}
                {game.status === 'WAITING' && game.playerCount < game.maxPlayers && (
                  <AddAIButton gameId={game.gameId!} onAIAdded={fetchGames} />
                )}
                
                <button
                  onClick={() => handleJoinGame(game.gameId)}
                  disabled={game.status === 'COMPLETED'}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Join game ${game.gameId}`}
                >
                  <Play className="h-4 w-4" />
                  {game.status === 'WAITING' ? 'Join' : 'Watch'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
