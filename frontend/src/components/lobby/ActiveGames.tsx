/**
 * @module components/lobby/ActiveGames
 * @description List of user's active games with leave functionality
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserGames, leaveGame } from '@/services/api';
import type { GameSummary } from '@buck-euchre/shared';
import { useUIStore } from '@/stores/uiStore';
import { useGame } from '@/hooks/useGame';
import { Users, Clock, Play, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ActiveGames() {
  const navigate = useNavigate();
  const { setError } = useUIStore();
  const { leaveGame: socketLeaveGame, clearGame } = useGame();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [leavingGameId, setLeavingGameId] = useState<string | null>(null);

  const fetchGames = async (isInitial = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true);
      }
      const response = await getUserGames();
      console.log('[ActiveGames] Fetched games:', response);
      console.log('[ActiveGames] Games array:', response.games);
      setGames(response.games || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load your games';
      console.error('[ActiveGames] Error fetching games:', err);
      setError(message);
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchGames(true);
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => fetchGames(false), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinGame = (gameId: string | undefined) => {
    if (!gameId) {
      setError('Invalid game ID');
      return;
    }
    navigate(`/game/${gameId}`);
  };

  const handleLeaveGame = async (gameId: string) => {
    if (!gameId) {
      setError('Invalid game ID');
      return;
    }

    try {
      setLeavingGameId(gameId);
      
      // 1. Call REST API to remove from database first
      // This ensures we have the latest state before doing client-side cleanup
      await leaveGame(gameId);
      
      // 2. Notify the socket to leave the game room
      socketLeaveGame(gameId);
      
      // 3. Clear the client-side game state
      clearGame();
      
      // 4. Refresh the list after leaving
      await fetchGames(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave game';
      console.error('[ActiveGames] Error leaving game:', err);
      
      // If the error is "User is not in this game", it might mean:
      // - The game was already left/deleted
      // - The user's session changed
      // In this case, just refresh the list to update the UI
      if (message.includes('not in this game') || message.includes('not found')) {
        console.log('[ActiveGames] User not in game - refreshing list');
        await fetchGames(false);
        // Don't show error for this case, just refresh
        return;
      }
      
      setError(message);
    } finally {
      setLeavingGameId(null);
    }
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

  if (initialLoading && games.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (games.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Your games</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-emerald-100/60">{games.length} game{games.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="space-y-3">
          {games
            .filter(game => game.gameId)
            .map(game => (
              <div
                key={game.gameId}
                className="rounded-[20px] border border-white/15 bg-white/5 p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:border-emerald-300/40 hover:shadow-[0_25px_80px_-45px_rgba(16,185,129,0.85)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-white">
                        {game.creatorName || 'Unknown'}'s table
                      </h4>
                      {getStatusBadge(game.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-100/80">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-emerald-200" />
                        <span>
                          {game.playerCount}/{game.maxPlayers} players
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-200" />
                        <span>{formatTime(game.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Button
                      onClick={() => handleJoinGame(game.gameId)}
                      variant={game.status === 'IN_PROGRESS' ? 'primary' : 'default'}
                      size="sm"
                      className="gap-1.5"
                      aria-label={`Join game ${game.gameId}`}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {game.status === 'IN_PROGRESS' ? 'Resume' : 'Join'}
                    </Button>
                    <Button
                      onClick={() => handleLeaveGame(game.gameId!)}
                      disabled={leavingGameId === game.gameId}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-rose-400/40 text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
                      aria-label={`Leave game ${game.gameId}`}
                    >
                      {leavingGameId === game.gameId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Leave
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}


