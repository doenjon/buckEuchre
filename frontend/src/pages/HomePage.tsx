/**
 * @module pages/HomePage
 * @description Home page with authentication and game creation
 */

import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');
  const { loginAsGuest, isAuthenticated } = useAuth();
  const { isLoading, error, setError } = useUIStore();

  const handleGetStarted = () => {
    // If there's a gameId, pass it to the login page
    if (gameId) {
      navigate(`/login?gameId=${gameId}`);
    } else {
      navigate('/login');
    }
  };

  const handleGuestJoin = async () => {
    try {
      setError(null);
      await loginAsGuest();
      // If there's a gameId, redirect to game instead of lobby
      if (gameId) {
        navigate(`/game/${gameId}`);
      } else {
        navigate('/lobby');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to join as guest: ${String(err)}`;
      console.error('Failed to join as guest:', {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(errorMessage);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        {/* Animated background layers */}
        <div className="pointer-events-none absolute inset-0">
          {/* Animated radial gradient */}
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]"
            style={{
              animation: 'gradient-shift 20s ease-in-out infinite'
            }}
          />

          {/* Floating animated orbs - minimal and subtle */}
          <div
            className="absolute -left-1/4 top-1/3 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl"
            style={{
              animation: 'orb-float-1 25s ease-in-out infinite'
            }}
          />
          <div
            className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-emerald-400/8 blur-3xl"
            style={{
              animation: 'orb-float-2 30s ease-in-out infinite 8s'
            }}
          />
        </div>

        <div
          className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-start px-4 sm:px-6 lg:px-8"
          style={{
            paddingTop: `calc(6rem + env(safe-area-inset-top, 0px))`,
            paddingBottom: `calc(4rem + env(safe-area-inset-bottom, 0px))`
          }}
        >
          <div className="flex flex-col items-center gap-12">
            <h1 className="text-4xl font-bold leading-normal text-white text-center sm:text-5xl lg:text-6xl tracking-normal">
              <span
                className="inline-block mr-2"
                style={{
                  animation: 'fade-in 1s ease-out 0.3s both',
                  opacity: 0
                }}
              >
                Welcome to
              </span>
              <span
                className="whitespace-nowrap inline-block relative"
                style={{
                  animation: 'fade-in 1.2s ease-out 0.8s both, glow-pulse 4s ease-in-out infinite 2.5s',
                  opacity: 0,
                  background: 'linear-gradient(120deg, #6ee7b7 0%, #10b981 50%, #6ee7b7 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                <span
                  style={{
                    animation: 'shimmer 4s linear infinite 3s',
                    background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                    backgroundSize: '200% auto',
                    position: 'absolute',
                    inset: 0,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    pointerEvents: 'none'
                  }}
                >
                  Buck Euchre Online
                </span>
                Buck Euchre Online
              </span>
            </h1>

            <div
              className="rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-[0_30px_80px_-45px_rgba(16,185,129,0.85)] backdrop-blur w-full max-w-md"
              style={{
                animation: 'fade-in 1.2s ease-out 2s both',
                opacity: 0
              }}
            >
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-400/50 rounded-md">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              <div className="space-y-4">
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

  // If authenticated, redirect to game if gameId provided, otherwise lobby
  if (isAuthenticated) {
    if (gameId) {
      return <Navigate to={`/game/${gameId}`} replace />;
    }
    return <Navigate to="/lobby" replace />;
  }

  return null;
}

