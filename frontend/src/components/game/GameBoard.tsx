/**
 * @module components/game/GameBoard
 * @description Main game board component
 */

import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RotateCcw, LogOut } from 'lucide-react';
import { Scoreboard } from './Scoreboard';
import { TurnIndicator } from './TurnIndicator';
import { CurrentTrick } from './CurrentTrick';
import { PlayerHand } from './PlayerHand';
import { BiddingPanel } from './BiddingPanel';
import { TrumpSelector } from './TrumpSelector';
import { FoldDecision } from './FoldDecision';
import { WaitingForPlayers } from './WaitingForPlayers';
import { useGame } from '@/hooks/useGame';
import { createGame } from '@/services/api';
import { Button } from '@/components/ui/button';
import type { GameState } from '@buck-euchre/shared';

interface GameBoardProps {
  gameState: GameState;
  myPosition: number;
}

export function GameBoard({ gameState, myPosition }: GameBoardProps) {
  const navigate = useNavigate();
  const { phase, currentPlayerPosition, currentBidder, players } = gameState;
  const { playCard, startNextRound, leaveGame } = useGame();
  const [isRematching, setIsRematching] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleReturnToLobby = () => {
    if (isReturning) {
      return;
    }

    setActionError(null);
    setIsReturning(true);

    try {
      leaveGame(gameState.gameId);
    } finally {
      navigate('/lobby');
    }
  };

  const handleRematch = async () => {
    if (isRematching) {
      return;
    }

    setActionError(null);
    setIsRematching(true);

    try {
      // Leave the completed table before creating a new one
      leaveGame(gameState.gameId);

      const response = await createGame();
      navigate(`/game/${response.gameId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message || 'Failed to start a rematch. Please try again.'
          : 'Failed to start a rematch. Please try again.';
      setActionError(message);
      setIsRematching(false);
    }
  };

  // Wait for all players
  if (phase === 'WAITING_FOR_PLAYERS' || players.length < 4) {
    return (
      <WaitingForPlayers 
        gameId={gameState.gameId}
        playerCount={players.length}
        playersNeeded={4}
      />
    );
  }

  const getPlayerByPosition = (position: number | null) => {
    if (position === null) {
      return null;
    }
    return players.find(player => player.position === position) ?? null;
  };

  const myPlayer = getPlayerByPosition(myPosition);

  if (!myPlayer) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-200 backdrop-blur">
        <p className="text-sm font-medium tracking-wide text-emerald-200/80">
          Locating your seat at the table…
        </p>
      </div>
    );
  }

  // Determine whose turn it is based on the phase
  let isMyTurn = false;
  let activePosition: number | null = null;
  
  switch (phase) {
    case 'BIDDING':
      activePosition = currentBidder;
      isMyTurn = currentBidder === myPosition;
      break;
    case 'DECLARING_TRUMP':
      activePosition = gameState.winningBidderPosition;
      isMyTurn = gameState.winningBidderPosition === myPosition;
      break;
    case 'FOLDING_DECISION':
      // In folding phase, player acts if they haven't decided yet and aren't the bidder
      if (
        gameState.winningBidderPosition !== myPosition &&
        myPlayer.foldDecision === 'UNDECIDED'
      ) {
        isMyTurn = true;
      }
      activePosition = null; // Multiple players can act
      break;
    case 'PLAYING':
      activePosition = currentPlayerPosition;
      isMyTurn = currentPlayerPosition === myPosition;
      break;
    case 'ROUND_OVER':
      activePosition = myPosition;
      isMyTurn = true;
      break;
    default:
      activePosition = null;
      isMyTurn = false;
  }

  const currentPlayer = getPlayerByPosition(activePosition);
  const completedTrick =
    gameState.tricks.length > 0
      ? gameState.tricks[gameState.tricks.length - 1]
      : null;
  const displayTrick =
    gameState.currentTrick && gameState.currentTrick.cards.length > 0
      ? gameState.currentTrick
      : completedTrick;
  const trickHighlightPosition =
    activePosition !== null
      ? activePosition
      : displayTrick?.cards[displayTrick.cards.length - 1]?.playerPosition ?? 0;

  let inlineActionPanel: ReactNode = null;
  let sidebarActionPanel: ReactNode = null;

  if (phase === 'BIDDING') {
    inlineActionPanel = (
      <BiddingPanel
        currentBid={gameState.highestBid}
        isMyTurn={isMyTurn}
      />
    );
  } else if (phase === 'DECLARING_TRUMP') {
    inlineActionPanel = (
      <TrumpSelector
        isMyTurn={gameState.winningBidderPosition === myPosition}
      />
    );
  } else if (phase === 'FOLDING_DECISION' && gameState.winningBidderPosition !== myPosition) {
    sidebarActionPanel = (
      <FoldDecision
        gameState={gameState}
        myPosition={myPosition}
        isMyTurn={isMyTurn}
      />
    );
  } else if (phase === 'ROUND_OVER' && !gameState.gameOver) {
    sidebarActionPanel = (
      <div className="flex flex-col gap-4">
        <div className="space-y-2 text-sm text-white/80">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/70">
            Round complete
          </p>
          <p>
            Scores have been updated. When you're ready, start the next round to keep the game moving.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="min-w-[180px] justify-center bg-emerald-500/90 text-white transition hover:bg-emerald-500"
          onClick={startNextRound}
        >
          Start next round
        </Button>
        <p className="text-xs text-emerald-200/60">
          The round will auto-start shortly if no one clicks. Starting manually keeps things snappy.
        </p>
      </div>
    );
  }

  const gridLayoutClasses = sidebarActionPanel
    ? 'grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,260px)]'
    : 'grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]';

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className={gridLayoutClasses}>
        {/* Left Column: Scoreboard + Info */}
        <aside className="order-2 flex flex-col gap-4 xl:order-1">
          <Scoreboard
            players={players}
            currentPlayerPosition={activePosition}
            phase={phase}
            trumpSuit={gameState.trumpSuit}
            winningBidderPosition={gameState.winningBidderPosition}
            winningBid={gameState.highestBid ?? undefined}
            className="shadow-[0_25px_60px_-35px_rgba(16,185,129,0.75)]"
          />
        </aside>

        {/* Middle Column: Table */}
        <section className="order-1 flex flex-col gap-5 sm:gap-6 xl:order-2">
          <div className="relative">
            {inlineActionPanel && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
                <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-slate-100 shadow-[0_35px_80px_-35px_rgba(16,185,129,0.9)] backdrop-blur-xl sm:p-6">
                  {inlineActionPanel}
                </div>
              </div>
            )}

            <div className={inlineActionPanel ? 'space-y-5 sm:space-y-6 opacity-40 transition-opacity duration-300' : 'space-y-5 sm:space-y-6'}>
              {currentPlayer && (
                <TurnIndicator
                  currentPlayer={currentPlayer}
                  isMyTurn={isMyTurn}
                  phase={phase}
                />
              )}

              <CurrentTrick
                trick={displayTrick}
                players={players}
                currentPlayerPosition={trickHighlightPosition}
                myPosition={myPosition}
              />

              {myPlayer.folded !== true ? (
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-3 shadow-[0_25px_70px_-40px_rgba(16,185,129,0.8)] backdrop-blur sm:p-4">
                  <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/70">
                    Your hand
                  </p>
                  <PlayerHand
                    cards={myPlayer.hand}
                    onCardClick={isMyTurn && phase === 'PLAYING' ? playCard : undefined}
                    disabled={!isMyTurn || phase !== 'PLAYING'}
                  />
                </div>
              ) : (
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur">
                  <p className="text-lg font-semibold text-white/90">
                    You have folded this round
                  </p>
                  <p className="mt-2 text-sm text-emerald-200/70">
                    Sit back and watch the remaining tricks play out.
                  </p>
                </div>
              )}

              {phase === 'GAME_OVER' && gameState.winner !== null && (
                <div className="rounded-[32px] border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 p-8 text-center shadow-2xl backdrop-blur">
                  <h2 className="text-2xl font-semibold uppercase tracking-[0.4em] text-emerald-100">
                    Game complete
                  </h2>
                  <p className="mt-3 text-lg text-white">
                    Winner · <span className="font-semibold">{getPlayerByPosition(gameState.winner)?.name}</span>
                  </p>
                  <p className="mt-1 text-sm text-emerald-200/70">
                    Final score {getPlayerByPosition(gameState.winner)?.score}
                  </p>
                  <p className="mt-6 text-sm text-emerald-100/80">
                    Ready for another showdown? Start a fresh table or head back to the lobby to celebrate.
                  </p>
                  <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button
                      type="button"
                      size="lg"
                      className="min-w-[180px] justify-center bg-emerald-500/90 text-white transition hover:bg-emerald-500"
                      onClick={handleRematch}
                      disabled={isRematching || isReturning}
                    >
                      {isRematching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Start rematch
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="min-w-[180px] justify-center border-white/40 bg-white/10 text-white transition hover:bg-white/20"
                      onClick={handleReturnToLobby}
                      disabled={isRematching || isReturning}
                    >
                      {isReturning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4" />
                      )}
                      Return to lobby
                    </Button>
                  </div>
                  {actionError && (
                    <p className="mt-4 text-sm text-rose-200/80">{actionError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Actions */}
        {sidebarActionPanel && (
          <aside className="order-3 flex flex-col gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-xl backdrop-blur sm:p-5">
              {sidebarActionPanel}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
