/**
 * @module components/lobby/GameList
 * @description List of available games in the lobby
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listGames } from '@/services/api';
import type { GameSummary } from '@buck-euchre/shared';
import { useUIStore } from '@/stores/uiStore';
import { Users, Clock, Play, Loader2 } from 'lucide-react';
import { AddAIButton } from './AddAIButton';
import { Button } from '@/components/ui/button';

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
    const statusColors: Record<GameSummary['status'], string> = {
      WAITING: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100',
      IN_PROGRESS: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
      COMPLETED: 'border-slate-300/30 bg-slate-500/10 text-slate-200',
    };

    const statusText: Record<GameSummary['status'], string> = {
      WAITING: 'Waiting',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
    };

    return (
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] ${statusColors[status]}`}
      >
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
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-white/20 bg-white/5 py-16 text-center text-sm text-emerald-100/80">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/10">
          <Users className="h-8 w-8 text-emerald-200" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">No games available</h3>
          <p className="mt-1 text-sm text-emerald-100/70">Create a new table to get the first deal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Available games</h2>
        <span className="text-xs uppercase tracking-[0.3em] text-emerald-100/60">{games.length} active</span>
      </div>

      <div className="space-y-4">
        {games
          .filter(game => game.gameId)
          .map(game => (
            <div
              key={game.gameId}
              className="rounded-[28px] border border-white/15 bg-white/5 p-5 transition-transform duration-300 hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-[0_25px_80px_-45px_rgba(16,185,129,0.85)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">
                      {game.creatorName || 'Unknown'}'s table
                    </h3>
                    {getStatusBadge(game.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-sm text-emerald-100/80">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-200" />
                      <span>
                        {game.playerCount}/{game.maxPlayers} players
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-200" />
                      <span>{formatTime(game.createdAt)}</span>
                    </div>
                    <span className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                      ID · {game.gameId?.slice(0, 8) || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start lg:self-center">
                  {game.status === 'WAITING' && game.playerCount < game.maxPlayers && (
                    <AddAIButton gameId={game.gameId!} onAIAdded={fetchGames} />
                  )}

                  <Button
                    onClick={() => handleJoinGame(game.gameId)}
                    disabled={game.status === 'COMPLETED'}
                    variant={game.status === 'WAITING' ? 'primary' : 'default'}
                    className="gap-2"
                    aria-label={`Join game ${game.gameId}`}
                  >
                    <Play className="h-4 w-4" />
                    {game.status === 'WAITING' ? 'Join table' : 'Watch table'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
