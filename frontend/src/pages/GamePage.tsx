/**
 * @module pages/GamePage
 * @description Main game page
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGame';
import { useAuthStore } from '@/stores/authStore';
import { GameBoard } from '@/components/game/GameBoard';
import { WaitingForPlayers } from '@/components/game/WaitingForPlayers';

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const { joinGame, gameState, myPosition, setMyPosition, waitingInfo } = useGame();
  const { playerId } = useAuthStore();

  // Check authentication
  useEffect(() => {
    if (!checkAuth()) {
      navigate('/');
    }
  }, [checkAuth, navigate]);

  // Join game when component mounts
  useEffect(() => {
    if (gameId && playerId) {
      joinGame(gameId);
    }
  }, [gameId, playerId, joinGame]);

  // Set player position when game state updates
  useEffect(() => {
    if (gameState && playerId && myPosition === null) {
      const playerIndex = gameState.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        setMyPosition(playerIndex);
      }
    }
  }, [gameState, playerId, myPosition, setMyPosition]);

  if (!gameState) {
    const fallbackWaiting =
      waitingInfo && (!gameId || waitingInfo.gameId === gameId)
        ? waitingInfo
        : {
            gameId: gameId ?? '',
            playerCount: waitingInfo?.playerCount ?? (playerId ? 1 : 0),
            playersNeeded:
              waitingInfo?.playersNeeded ??
              Math.max(0, 4 - (waitingInfo?.playerCount ?? (playerId ? 1 : 0))),
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
    <div className="relative min-h-screen overflow-hidden bg-[#061f11]">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 bg-emerald-600/30 blur-3xl" />
        <div className="absolute right-0 top-10 h-64 w-64 bg-teal-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col items-center justify-between gap-3 text-white sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <span className="text-xs font-medium uppercase tracking-[0.35em] text-emerald-200/90">
              Buck Euchre
            </span>
            <h1 className="text-center text-2xl font-semibold leading-tight sm:text-left sm:text-3xl">
              Game {gameId?.slice(0, 8)}
            </h1>
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-medium text-white/80 backdrop-blur">
            Live table view
          </div>
        </header>

        {myPosition !== null ? (
          <GameBoard gameState={gameState} myPosition={myPosition} />
        ) : (
          <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-2xl backdrop-blur">
            <p className="text-sm font-medium tracking-wide text-white/80">
              Finding your seat at the table...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
