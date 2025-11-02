/**
 * @module pages/LobbyPage
 * @description Lobby page with game list and creation
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { GameList } from '@/components/lobby/GameList';
import { CreateGame } from '@/components/lobby/CreateGame';
import { LogOut, User, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';

export function LobbyPage() {
  const navigate = useNavigate();
  const { isAuthenticated, displayName, isGuest, logout } = useAuth();
  const { error, clearError } = useUIStore();

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
    <>
      <Header />
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]" />
          <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-[-20%] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-col gap-2 text-left">
              <span className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Buck Euchre</span>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Game Lobby</h1>
              <p className="max-w-2xl text-sm text-emerald-100/80">
                Assemble a four-player table, fill empty seats with AI, or jump into an in-progress match to spectate the action.
              </p>
            </div>

          <div className="flex flex-col gap-4 rounded-[28px] border border-white/15 bg-white/10 p-4 text-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-emerald-100/80">
              <Trophy className="h-5 w-5 text-emerald-200" />
              <span>
                {displayName} ·{' '}
                <span className="text-white">{isGuest ? 'Guest seat' : 'Ready to play'}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-emerald-100/80">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-200" />
                <span className="text-xs uppercase tracking-[0.3em]">{isGuest ? 'Guest' : 'Member'}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="px-5">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
          </div>

          <div className="mt-10 grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 shadow-[0_25px_70px_-45px_rgba(16,185,129,0.85)] backdrop-blur">
              <h2 className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Create</h2>
              <p className="mt-2 text-2xl font-semibold text-white">Start a new table</p>

              <div className="mt-6">
                <CreateGame />
              </div>

              <div className="mt-8 space-y-3 text-sm text-emerald-100/70">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
                  <span>Invite friends or add AI teammates to keep the rotation flowing.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
                  <span>Bid boldly, declare trump, and drive your score to zero.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
                  <span>Spectators can watch any table already in progress.</span>
                </div>
              </div>
            </div>
          </aside>

          <section className="rounded-[28px] border border-white/15 bg-white/10 p-6 shadow-[0_25px_70px_-45px_rgba(16,185,129,0.85)] backdrop-blur">
            {error && (
              <div className="mb-4 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                <div className="flex items-center justify-between gap-4">
                  <span>{error}</span>
                  <button
                    onClick={clearError}
                    className="text-xs uppercase tracking-[0.3em] text-rose-200/80 hover:text-rose-100"
                    aria-label="Dismiss error"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <GameList />
          </section>
          </div>
        </div>
      </div>
    </>
  );
}
