/**
 * @module pages/HomePage
 * @description Home page with authentication and game creation
 */

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Sparkles, Users, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';

export function HomePage() {
  const navigate = useNavigate();
  const { loginAsGuest, isAuthenticated } = useAuth();
  const { isLoading, setError } = useUIStore();

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleGuestJoin = async () => {
    try {
      setError(null);
      await loginAsGuest();
      navigate('/lobby');
    } catch (err) {
      console.error('Failed to join as guest:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]" />
          <div className="absolute -left-1/4 top-1/3 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <span className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">Modern Trick Taking</span>
                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                  Gather your crew and take the table in Buck Euchre.
                </h1>
                <p className="max-w-xl text-base text-emerald-100/80">
                  Seamless multiplayer, crisp visuals, and a smooth flow through bidding, trump and play.
                  Bring strategy and style to every hand.
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-4 text-sm text-emerald-100/80 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                    <Users className="h-4 w-4" />
                    Multiplayer
                  </dt>
                  <dd className="mt-3 text-2xl font-semibold text-white">Real-time</dd>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                    <Sparkles className="h-4 w-4" />
                    Atmosphere
                  </dt>
                  <dd className="mt-3 text-2xl font-semibold text-white">Glassy UI</dd>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                    <Crown className="h-4 w-4" />
                    Competitive
                  </dt>
                  <dd className="mt-3 text-2xl font-semibold text-white">Race to 0</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-[0_30px_80px_-45px_rgba(16,185,129,0.85)] backdrop-blur">
              <div className="flex flex-col gap-2 text-center">
                <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">Join the table</span>
                <h2 className="text-2xl font-semibold text-white">Get Started</h2>
              </div>

              <div className="mt-6 space-y-4">
                <Button
                  type="button"
                  onClick={handleGetStarted}
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                >
                  Sign In or Register
                </Button>

                <div className="relative flex items-center justify-center text-xs uppercase tracking-[0.3em] text-emerald-100/50">
                  <span className="absolute inset-x-6 h-px bg-white/10" aria-hidden="true" />
                  <span className="relative bg-white/0 px-4">or</span>
                </div>

                <Button
                  type="button"
                  onClick={handleGuestJoin}
                  disabled={isLoading}
                  variant="outline"
                  size="md"
                  className="w-full justify-center"
                >
                  {isLoading ? 'Creating guest…' : 'Continue as Guest'}
                </Button>
              </div>

              <p className="mt-6 text-center text-xs text-emerald-100/70">
                Create an account to save stats, make friends, and compete on leaderboards.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, redirect to lobby
  if (isAuthenticated) {
    return <Navigate to="/lobby" replace />;
  }

  return null;
}
