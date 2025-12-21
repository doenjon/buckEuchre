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
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
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

  // Check if user is authenticated - if not, redirect to home with gameId
  useEffect(() => {
    if (authReady) {
      return;
    }

    if (checkAuth()) {
      setAuthReady(true);
    } else {
      // Not authenticated - redirect to home page with gameId so they can login
      // The redirect will happen in the next useEffect
      setAuthReady(true); // Set to true so we don't block the redirect
    }
  }, [authReady, checkAuth]);

  // Check authentication - if not authenticated, redirect to home with gameId in URL
  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!checkAuth()) {
      // Store gameId in URL so we can redirect back after login
      navigate(`/?gameId=${gameId}`, { replace: true });
    }
  }, [authReady, checkAuth, navigate, gameId]);

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

  const activeError = useMemo(() => error, [error]);

  // Show minimal loading state while checking auth
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_#1f6f43,_transparent_55%)] text-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_#1f6f43,_transparent_55%)] text-slate-100">
        <div
          className="mx-auto flex max-w-md flex-col gap-6 px-4 sm:px-6 lg:px-8"
          style={{
            paddingTop: `calc(4rem + env(safe-area-inset-top, 0px))`,
            paddingBottom: `calc(4rem + env(safe-area-inset-bottom, 0px))`
          }}
        >
          <div className="rounded-[32px] border border-rose-400/30 bg-rose-950/30 p-6 text-slate-100 backdrop-blur shadow-[0_30px_80px_-45px_rgba(239,68,68,0.3)]">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-rose-300" />
              <h2 className="text-lg font-semibold text-slate-100">We couldn&apos;t seat you at this table</h2>
              <p className="text-sm text-slate-200">{activeError}</p>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  clearGame();
                  navigate('/lobby');
                }}
                className="mt-4"
              >
                Return to lobby
              </Button>
            </div>
          </div>
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
        players={[]}
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
        players={gameState.players.map(p => ({ id: p.id, name: p.name, position: p.position }))}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 bg-[radial-gradient(circle_at_top,_#1f6f43,_transparent_55%)] text-slate-100">
      <div
        className="mx-auto flex h-full w-full max-w-6xl flex-col gap-2 md:gap-5 px-4 sm:px-6 lg:px-8"
        style={{
          paddingTop: `calc(0.5rem + env(safe-area-inset-top, 0px))`,
          paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))`
        }}
      >
        <header className="flex-shrink-0 flex flex-col gap-2 text-center pt-2 sm:pt-4 md:pt-6">
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
