/**
 * @module pages/GamePage
 * @description Main game page
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGame';
import { useAuthStore } from '@/stores/authStore';
import { GameBoard } from '@/components/game/GameBoard';
import { WaitingForPlayers } from '@/components/game/WaitingForPlayers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { checkAuth, loginAsGuest } = useAuth();
  const { joinGame, gameState, myPosition, setMyPosition, waitingInfo, error, clearGame } = useGame();
  const authStore = useAuthStore();
  const userId = authStore.userId;
  
  // Debug: Log auth state changes
  useEffect(() => {
    console.log('[GamePage] Auth store state:', {
      userId: authStore.userId,
      username: authStore.username,
      displayName: authStore.displayName,
      isAuthenticated: authStore.isAuthenticated,
      isGuest: authStore.isGuest
    });
  }, [authStore.userId, authStore.username, authStore.displayName, authStore.isAuthenticated, authStore.isGuest]);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Attempt to ensure the visitor is authenticated, logging in as a guest if needed
  useEffect(() => {
    if (authReady || isAuthenticating) {
      return;
    }

    let isActive = true;

    async function ensureAuthenticated() {
      if (checkAuth()) {
        if (isActive) {
          setAuthReady(true);
        }
        return;
      }

      try {
        setIsAuthenticating(true);
        await loginAsGuest();
        if (isActive) {
          setAuthReady(true);
        }
      } catch (err) {
        if (!isActive) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to join as a guest right now.';
        setAuthError(message);
        setAuthReady(true);
      } finally {
        if (isActive) {
          setIsAuthenticating(false);
        }
      }
    }

    ensureAuthenticated();

    return () => {
      isActive = false;
    };
  }, [authReady, checkAuth, loginAsGuest, isAuthenticating]);

  // Check authentication
  useEffect(() => {
    if (!authReady || authError) {
      return;
    }

    if (!checkAuth()) {
      navigate('/');
    }
  }, [authReady, authError, checkAuth, navigate]);

  // Join game when component mounts
  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (gameId && userId) {
      joinGame(gameId);
    }
  }, [authReady, gameId, userId, joinGame]);

  // Set player position when game state updates
  useEffect(() => {
    console.log('[GamePage] useEffect triggered:', {
      hasGameState: !!gameState,
      hasUserId: !!userId,
      userId,
      gameStatePhase: gameState?.phase,
      myPosition,
      gameStatePlayers: gameState?.players?.map(p => ({ id: p.id, name: p.name, position: p.position }))
    });

    if (gameState && userId) {
      console.log('[GamePage] Looking for player with userId:', userId, {
        gameId: gameState.gameId,
        phase: gameState.phase,
        availablePlayers: gameState.players.map(p => ({ id: p.id, name: p.name, position: p.position }))
      });
      
      const player = gameState.players.find(p => p.id === userId);
      
      if (player && myPosition !== player.position) {
        console.log('[GamePage] ✓ Found player! Setting myPosition:', player.position, 'for userId:', userId, 'playerId:', player.id);
        setMyPosition(player.position);
      } else if (!player) {
        console.error('[GamePage] ✗ Could not find player with userId:', userId, {
          userId,
          userIdType: typeof userId,
          availablePlayerIds: gameState.players.map(p => ({ id: p.id, idType: typeof p.id, name: p.name, position: p.position })),
          matches: gameState.players.filter(p => {
            const match = p.id === userId;
            console.log('[GamePage] Comparing:', { playerId: p.id, userId, match, strictEqual: p.id === userId, looseEqual: p.id == userId });
            return match;
          })
        });
      } else {
        console.log('[GamePage] Player found but position already set:', { myPosition, playerPosition: player.position });
      }
    } else {
      console.log('[GamePage] Skipping position check:', { hasGameState: !!gameState, hasUserId: !!userId, userId });
    }
  }, [gameState, userId, myPosition, setMyPosition]);

  const activeError = useMemo(() => authError || error, [authError, error]);

  if (!authReady || isAuthenticating) {
    return (
      <div className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_#1f6f43,_transparent_55%)] text-slate-100">
        <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
          <Card className="border-white/10 bg-white/5 text-center text-slate-200 backdrop-blur">
            <CardHeader className="items-center gap-2 text-center">
              <CardTitle className="text-lg font-semibold tracking-[0.25em] text-emerald-200/80 uppercase">Joining Table</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-8">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />
              <p className="text-sm text-slate-300">Preparing a guest seat for you&hellip;</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_#1f6f43,_transparent_55%)] text-slate-100">
        <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
          <Card className="border-rose-400/30 bg-rose-950/30 text-slate-100 backdrop-blur">
            <CardHeader className="items-center gap-2 text-center">
              <AlertCircle className="h-10 w-10 text-rose-300" />
              <CardTitle className="text-lg font-semibold">We couldn&apos;t seat you at this table</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-8 text-center text-sm text-slate-200">
              <p>{activeError}</p>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  clearGame();
                  navigate('/');
                }}
              >
                Return to lobby
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!gameState) {
    const fallbackWaiting =
      waitingInfo && (!gameId || waitingInfo.gameId === gameId)
        ? waitingInfo
        : {
            gameId: gameId ?? '',
            playerCount: waitingInfo?.playerCount ?? (userId ? 1 : 0),
            playersNeeded:
              waitingInfo?.playersNeeded ??
              Math.max(0, 4 - (waitingInfo?.playerCount ?? (userId ? 1 : 0))),
            message: waitingInfo?.message ?? 'Waiting for more players to join...'
          };

    return (
      <WaitingForPlayers
        gameId={fallbackWaiting.gameId}
        playerCount={fallbackWaiting.playerCount}
        playersNeeded={fallbackWaiting.playersNeeded}
        message={fallbackWaiting.message}
      />
    );
  }

  if (gameState.phase === 'WAITING_FOR_PLAYERS') {
    const connectedPlayers = gameState.players.filter(player => player.connected).length;
    const seatsRemaining = Math.max(0, 4 - connectedPlayers);

    return (
      <WaitingForPlayers
        gameId={gameId ?? gameState.gameId}
        playerCount={connectedPlayers}
        playersNeeded={seatsRemaining}
        message={waitingInfo?.message}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 bg-[radial-gradient(circle_at_top,_#1f6f43,_transparent_55%)] text-slate-100">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-2 md:gap-5 px-4 py-2 sm:px-6 sm:py-4 lg:px-8 md:py-6 md:py-8">
        <header className="flex-shrink-0 flex flex-col gap-2 text-center">
          <span className="text-xs uppercase tracking-[0.35em] text-emerald-300/70 sm:text-sm">
            Buck Euchre
          </span>
        </header>

        {myPosition !== null ? (
          <div className="flex-1 min-h-0">
            <GameBoard gameState={gameState} myPosition={myPosition} />
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-200 backdrop-blur">
            <p className="text-sm font-medium tracking-wide text-emerald-200/80">
              Finding your position in the game…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
