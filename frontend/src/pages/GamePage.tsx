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
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_#1f6f43,_transparent_55%)] text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-2 text-center">
          <span className="text-xs uppercase tracking-[0.35em] text-emerald-300/70 sm:text-sm">
            Buck Euchre
          </span>
          <h1 className="text-xl font-semibold text-white sm:text-3xl">
            Game {gameId?.slice(0, 8)}
          </h1>
        </header>

        {myPosition !== null ? (
          <GameBoard gameState={gameState} myPosition={myPosition} />
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
