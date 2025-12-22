/**
 * @module pages/LobbyPage
 * @description Lobby page with game list and creation
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { useGameList } from '@/hooks/useGameList';
import { GameList } from '@/components/lobby/GameList';
import { CreateGame } from '@/components/lobby/CreateGame';
import { LogOut, User, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LobbyPage() {
  const navigate = useNavigate();
  const { isAuthenticated, displayName, isGuest, logout } = useAuth();
  const { error, clearError } = useUIStore();
  const { games, initialLoading, fetchGames } = useGameList();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]" />
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-[-20%] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-12 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-left">
            <span className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Buck Euchre</span>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Game Lobby</h1>
            <p className="max-w-2xl text-sm text-emerald-100/80">
              Assemble a four-player table, fill empty seats with AI, or jump into an in-progress match to spectate the action.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <User className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{displayName || 'Player'}</span>
                {isGuest && (
                  <span className="text-xs text-emerald-200/60">Guest Account</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/leaderboard')}
                className="border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Leaderboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-red-500/30 text-red-200 hover:bg-red-500/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={clearError}
                className="text-red-300 hover:text-red-100"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <aside className="lg:col-span-1">
            <div className="rounded-lg border border-emerald-500/20 bg-slate-800/50 p-6 backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-semibold text-white">How to Play</h2>
              <ul className="space-y-3 text-sm text-emerald-100/80">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">1.</span>
                  <span>Create a new game or join an existing one</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">2.</span>
                  <span>Wait for 4 players to join (or add AI players)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">3.</span>
                  <span>Bid to win tricks and declare trump</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">4.</span>
                  <span>Race from 15 points down to 0 to win!</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <CreateGame />
            </div>
          </aside>

          <main className="lg:col-span-2">
            <GameList games={games} initialLoading={initialLoading} onRefresh={fetchGames} />
          </main>
        </div>
      </div>
    </div>
  );
}
