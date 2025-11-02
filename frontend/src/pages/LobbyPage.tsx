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
import { ActiveGames } from '@/components/lobby/ActiveGames';
import { Header } from '@/components/layout/Header';

export function LobbyPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { error, clearError } = useUIStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="flex flex-col gap-6">
              <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur">
                <h2 className="text-sm uppercase tracking-[0.35em] text-emerald-200/80 mb-6">Create game</h2>
                <CreateGame />
              </div>

              <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur">
                <h2 className="text-sm uppercase tracking-[0.35em] text-emerald-200/80 mb-6">Your games</h2>
                <ActiveGames />
              </div>
            </aside>

            <section className="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur">
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
