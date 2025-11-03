/**
 * @module components/game/GameBoard
 * @description Main game board component
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RotateCcw, LogOut, Trophy, X } from 'lucide-react';
import { Scoreboard } from './Scoreboard';
import { CurrentTrick } from './CurrentTrick';
import { PlayerHand } from './PlayerHand';
import { BiddingPanel } from './BiddingPanel';
import { TrumpSelector } from './TrumpSelector';
import { FoldDecision } from './FoldDecision';
import { WaitingForPlayers } from './WaitingForPlayers';
import { PlayerStatusIndicators } from './PlayerStatusIndicators';
import { GameNotification } from './GameNotification';
import { useGame } from '@/hooks/useGame';
import { useGameNotifications } from '@/hooks/useGameNotifications';
import { createGame } from '@/services/api';
import { Button } from '@/components/ui/button';
import { GAME_TIMEOUTS } from '@buck-euchre/shared';
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
  const [nextHandCountdown, setNextHandCountdown] = useState<number | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);

  // Setup game notifications
  useGameNotifications(gameState, myPosition);

  useEffect(() => {
    if (phase === 'ROUND_OVER' && !gameState.gameOver) {
      const autoStartAt = gameState.updatedAt + GAME_TIMEOUTS.ROUND_OVER_DISPLAY_TIME;

      const updateCountdown = () => {
        const remainingMs = Math.max(0, autoStartAt - Date.now());
        setNextHandCountdown(Math.ceil(remainingMs / 1000));
      };

      updateCountdown();
      const intervalId = window.setInterval(updateCountdown, 200);

      return () => window.clearInterval(intervalId);
    }

    setNextHandCountdown(null);
    return undefined;
  }, [phase, gameState.gameOver, gameState.updatedAt]);


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
        <p className="text-base font-medium tracking-wide text-emerald-200/80">
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
      // Ensure both values are numbers for comparison
      isMyTurn = currentPlayerPosition !== null && 
                 myPosition !== null && 
                 Number(currentPlayerPosition) === Number(myPosition);
      console.log('[GameBoard] PLAYING phase check:', {
        currentPlayerPosition,
        myPosition,
        currentPlayerType: typeof currentPlayerPosition,
        myPositionType: typeof myPosition,
        isMyTurn,
        players: players.map(p => ({ id: p.id, name: p.name, position: p.position, positionType: typeof p.position }))
      });
      break;
    case 'ROUND_OVER':
      activePosition = myPosition;
      isMyTurn = true;
      break;
    default:
      activePosition = null;
      isMyTurn = false;
  }

  // Debug logging for card selection
  useEffect(() => {
    if (phase === 'PLAYING' && myPlayer) {
      console.log('[GameBoard] PLAYING phase debug:', {
        myPosition,
        currentPlayerPosition,
        isMyTurn,
        phase,
        myPlayerName: myPlayer?.name,
        currentPlayerName: getPlayerByPosition(currentPlayerPosition)?.name,
        cardsInHand: myPlayer?.hand?.length || 0
      });
    }
  }, [phase, myPosition, currentPlayerPosition, isMyTurn, myPlayer]);

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
    inlineActionPanel = (
      <FoldDecision
        gameState={gameState}
        myPosition={myPosition}
        isMyTurn={isMyTurn}
      />
    );
  }

  const showNextHandPopup = phase === 'ROUND_OVER' && !gameState.gameOver;

  return (
    <div className="flex flex-col w-full h-full">
      {/* Mobile Layout: Fixed score button + flex areas | Desktop: sidebar + content */}
      <div className="flex flex-col flex-1 min-h-0 md:h-auto md:grid md:gap-4 lg:gap-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        
        {/* Mobile: Fixed Score Button (Top Right) - Above bot names */}
        <div className="md:hidden fixed top-2 right-2 z-40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowScoreboard(!showScoreboard)}
            className="rounded-full border-white/20 bg-white/5 text-emerald-200 hover:bg-white/10 backdrop-blur text-xs px-2 py-1 shadow-lg"
            aria-label={showScoreboard ? 'Hide scoreboard' : 'Show scoreboard'}
          >
            <Trophy className="h-3 w-3 mr-1" />
            <span className="text-xs">Scores</span>
          </Button>
        </div>

        {/* Mobile Info Bar - Scoreboard Popup Only */}
        <div className="md:hidden relative">


          {showScoreboard && (
            <div 
              className="pointer-events-auto fixed inset-x-0 top-16 bottom-0 z-30 flex items-start justify-center px-4 pt-2" 
              style={{ opacity: 1, filter: 'none', isolation: 'isolate' }}
              onClick={() => setShowScoreboard(false)}
            >
              <div 
                className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-3 text-slate-100 shadow-lg" 
                style={{ opacity: 1, filter: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold text-white">Table Tally</h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowScoreboard(false)}
                    className="h-6 w-6 p-0 text-emerald-200 hover:text-white hover:bg-white/10"
                    aria-label="Close scoreboard"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <Scoreboard
                  players={players}
                  currentPlayerPosition={activePosition}
                  phase={phase}
                  trumpSuit={gameState.trumpSuit}
                  winningBidderPosition={gameState.winningBidderPosition}
                  winningBid={gameState.highestBid ?? undefined}
                  isClubsTurnUp={gameState.isClubsTurnUp}
                  variant="mobile"
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Sidebar - Visible sidebar with info panel */}
        <aside className="hidden md:flex md:flex-col gap-6 md:order-1 py-4 lg:py-6">
          {/* Desktop Info Panel - shows trump, bidder, bid amount, etc. */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-lg backdrop-blur">
            <div className="space-y-3">
              {gameState.trumpSuit && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">TRUMP:</span>
                  <span className={`text-xl font-bold ${gameState.trumpSuit === 'HEARTS' || gameState.trumpSuit === 'DIAMONDS' ? 'text-red-400' : 'text-gray-300'}`}>
                    {gameState.trumpSuit === 'SPADES' ? '♠' : gameState.trumpSuit === 'HEARTS' ? '♥' : gameState.trumpSuit === 'DIAMONDS' ? '♦' : '♣'}
                  </span>
                  {gameState.isClubsTurnUp && (
                    <span className="ml-2 rounded-md bg-red-500/20 border border-red-400/50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-red-300 animate-pulse">
                      ♣ Dirty Clubs!
                    </span>
                  )}
                </div>
              )}
              {gameState.winningBidderPosition !== null && gameState.highestBid !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">BID:</span>
                  <span className="text-lg font-bold text-white">{gameState.highestBid}</span>
                  <span className="text-sm text-emerald-200/70">by</span>
                  <span className="text-base font-medium text-white">
                    {players.find(p => p.position === gameState.winningBidderPosition)?.name || `P${gameState.winningBidderPosition}`}
                  </span>
                </div>
              )}
              {phase === 'BIDDING' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">PHASE:</span>
                  <span className="text-base font-medium text-white">Bidding</span>
                </div>
              )}
            </div>
          </div>
          
          <Scoreboard
            players={players}
            currentPlayerPosition={activePosition}
            phase={phase}
            trumpSuit={gameState.trumpSuit}
            winningBidderPosition={gameState.winningBidderPosition}
            winningBid={gameState.highestBid ?? undefined}
            isClubsTurnUp={gameState.isClubsTurnUp}
            className="shadow-[0_25px_60px_-35px_rgba(16,185,129,0.75)]"
          />
        </aside>

        {/* Main Game Area */}
        <section className="flex flex-col md:gap-8 lg:gap-12 md:order-2 flex-1 min-h-0 md:h-auto md:overflow-visible relative md:py-6 lg:py-8">
          {/* Mobile: Top bar with opponents | Desktop: Labels around table */}

          {/* Mobile: Info Bar - floating just above player names */}
          <div className="md:hidden px-2 pt-10 pb-1.5 flex-shrink-0">
            <div className="w-full rounded-lg px-3 py-1.5 bg-white/15 border border-white/20 shadow-md backdrop-blur">
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-200/90">
                {gameState.trumpSuit && (
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-300 font-semibold">TRUMP:</span>
                    <span className={`font-bold text-base ${gameState.trumpSuit === 'HEARTS' || gameState.trumpSuit === 'DIAMONDS' ? 'text-red-400' : 'text-gray-300'}`}>
                      {gameState.trumpSuit === 'SPADES' ? '♠' : gameState.trumpSuit === 'HEARTS' ? '♥' : gameState.trumpSuit === 'DIAMONDS' ? '♦' : '♣'}
                    </span>
                    {gameState.isClubsTurnUp && (
                      <span className="ml-0.5 rounded bg-red-500/20 border border-red-400/50 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 animate-pulse">
                        Dirty Clubs!
                      </span>
                    )}
                  </div>
                )}
                {gameState.winningBidderPosition !== null && gameState.highestBid !== null && (
                  <>
                    {gameState.trumpSuit && <span className="text-emerald-200/50">•</span>}
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-300 font-semibold">BID:</span>
                      <span className="text-white font-bold text-sm">{gameState.highestBid}</span>
                      <span className="text-emerald-200/70 text-[11px]">by</span>
                      <span className="text-white font-medium text-sm">
                        {players.find(p => p.position === gameState.winningBidderPosition)?.name || `P${gameState.winningBidderPosition}`}
                      </span>
                    </div>
                  </>
                )}
                {phase === 'BIDDING' && (
                  <>
                    {(gameState.trumpSuit || (gameState.winningBidderPosition !== null && gameState.highestBid !== null)) && <span className="text-emerald-200/50">•</span>}
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-300 font-semibold">PHASE:</span>
                      <span className="text-white font-medium text-sm">Bidding</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mobile: Opponents bar at top - below score button */}
          <div className="md:hidden px-2 pb-1 flex-shrink-0">
            <div className="flex items-center justify-between gap-1">
              {[1, 2, 3].map((offset) => {
                const absolutePosition = ((myPosition + offset) % 4) as 0 | 1 | 2 | 3;
                const player = players.find(p => p.position === absolutePosition);
                const isCurrentTurn = absolutePosition === trickHighlightPosition;
                const hasCardInTrick = displayTrick?.cards.some(c => c.playerPosition === absolutePosition) ?? false;

                return (
                  <div key={offset} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={`
                      w-full rounded-lg px-2 py-1 text-xs font-medium uppercase tracking-[0.15em] text-center whitespace-nowrap overflow-hidden text-ellipsis
                      ${isCurrentTurn ? 'bg-emerald-400 text-slate-900 ring-1 ring-emerald-300' : hasCardInTrick ? 'bg-white/20 text-emerald-100' : 'bg-white/10 text-emerald-200/70'}
                    `} title={player?.name || `Player ${absolutePosition + 1}`}>
                      {player?.name || `P${absolutePosition}`}
                    </div>
                    <PlayerStatusIndicators 
                      gameState={gameState} 
                      playerPosition={absolutePosition}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Area */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center w-full px-2 md:px-2 lg:px-3 md:min-h-[360px] lg:min-h-[420px]">
            {/* Desktop: Labels around table */}
            <div className="hidden md:block relative w-full h-full flex items-center justify-center">
              {/* Left label */}
              {(() => {
                const leftPlayer = players.find(p => p.position === ((myPosition + 1) % 4) as 0 | 1 | 2 | 3);
                const absolutePosition = ((myPosition + 1) % 4) as 0 | 1 | 2 | 3;
                const isCurrentTurn = absolutePosition === trickHighlightPosition;
                const hasCardInTrick = displayTrick?.cards.some(c => c.playerPosition === absolutePosition) ?? false;
                
                return (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-0.5">
                    <div className={`
                      rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.25em] whitespace-nowrap
                      ${isCurrentTurn ? 'bg-emerald-400 text-slate-900 ring-1 ring-emerald-300' : hasCardInTrick ? 'bg-white/20 text-emerald-100' : 'bg-white/10 text-emerald-200/70'}
                    `}>
                      {leftPlayer?.name || `P${absolutePosition}`}
                    </div>
                    <PlayerStatusIndicators 
                      gameState={gameState} 
                      playerPosition={absolutePosition}
                      size="sm"
                    />
                  </div>
                );
              })()}

              {/* Right label */}
              {(() => {
                const rightPlayer = players.find(p => p.position === ((myPosition + 3) % 4) as 0 | 1 | 2 | 3);
                const absolutePosition = ((myPosition + 3) % 4) as 0 | 1 | 2 | 3;
                const isCurrentTurn = absolutePosition === trickHighlightPosition;
                const hasCardInTrick = displayTrick?.cards.some(c => c.playerPosition === absolutePosition) ?? false;
                
                return (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-0.5">
                    <div className={`
                      rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.25em] whitespace-nowrap
                      ${isCurrentTurn ? 'bg-emerald-400 text-slate-900 ring-1 ring-emerald-300' : hasCardInTrick ? 'bg-white/20 text-emerald-100' : 'bg-white/10 text-emerald-200/70'}
                    `}>
                      {rightPlayer?.name || `P${absolutePosition}`}
                    </div>
                    <PlayerStatusIndicators 
                      gameState={gameState} 
                      playerPosition={absolutePosition}
                      size="sm"
                    />
                  </div>
                );
              })()}

              {/* Top and bottom labels */}
              {(() => {
                const getPlayerByRelativePosition = (relativeIndex: number) => {
                  const absolutePosition = ((myPosition + relativeIndex) % 4) as 0 | 1 | 2 | 3;
                  return players.find(player => player.position === absolutePosition) ?? null;
                };

                const topBottomPositions = [
                  { position: 'bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2', relativeIndex: 0 }, // You (bottom)
                  { position: 'top-6 lg:top-8 left-1/2 -translate-x-1/2', relativeIndex: 2 }, // Across (top)
                ];

                return topBottomPositions.map(({ position, relativeIndex }) => {
                  const player = getPlayerByRelativePosition(relativeIndex);
                  const absolutePosition = ((myPosition + relativeIndex) % 4) as 0 | 1 | 2 | 3;
                  const isCurrentTurn = absolutePosition === trickHighlightPosition;
                  const hasCardInTrick = displayTrick?.cards.some(c => c.playerPosition === absolutePosition) ?? false;

                  return (
                    <div key={relativeIndex} className={`absolute ${position} z-10 flex flex-col items-center gap-0.5`}>
                      <div className={`
                        rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.25em] whitespace-nowrap
                        ${isCurrentTurn ? 'bg-emerald-400 text-slate-900 ring-1 ring-emerald-300' : hasCardInTrick ? 'bg-white/20 text-emerald-100' : 'bg-white/10 text-emerald-200/70'}
                      `}>
                        {player?.name || `P${absolutePosition}`}
                      </div>
                      <PlayerStatusIndicators 
                        gameState={gameState} 
                        playerPosition={absolutePosition}
                        size="sm"
                      />
                    </div>
                  );
                });
              })()}

              {/* Desktop: Stadium-shaped poker table - full width with margins for side labels */}
              <div className="absolute left-16 right-16 top-1/2 -translate-y-1/2 aspect-[1.4/1] flex items-center justify-center">
                <CurrentTrick
                  trick={displayTrick}
                  players={players}
                  currentPlayerPosition={trickHighlightPosition}
                  myPosition={myPosition}
                />
              </div>
            </div>

            {/* Mobile: Stadium-shaped poker table - full width, scaled to fit */}
            <div className="md:hidden w-full h-full max-w-full max-h-full aspect-[2.05/1] flex items-center justify-center" style={{ maxHeight: '100%', maxWidth: '100%' }}>
              <CurrentTrick
                trick={displayTrick}
                players={players}
                currentPlayerPosition={trickHighlightPosition}
                myPosition={myPosition}
              />
            </div>

            {inlineActionPanel && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 md:px-6 lg:px-8" style={{ opacity: 1, filter: 'none', isolation: 'isolate' }}>
                <div className={`pointer-events-auto w-full ${gameState.phase === 'DECLARING_TRUMP' ? 'max-w-xs' : 'max-w-md'} rounded-2xl md:rounded-3xl border border-white/10 bg-slate-950 ${gameState.phase === 'DECLARING_TRUMP' ? 'p-[0.875rem] md:p-4 lg:p-[1.375rem]' : 'p-5 md:p-6 lg:p-8'} text-slate-100 shadow-lg md:shadow-[0_35px_80px_-35px_rgba(16,185,129,0.9)]`} style={{ opacity: 1, filter: 'none' }}>
                  {inlineActionPanel}
                </div>
              </div>
            )}

          </div>

          {/* Mobile: Current player label above hand */}
          <div className="md:hidden px-2 pt-1 pb-1 flex-shrink-0">
            {(() => {
              const absolutePosition = myPosition as 0 | 1 | 2 | 3;
              const isCurrentTurn = absolutePosition === trickHighlightPosition;
              const hasCardInTrick = displayTrick?.cards.some(c => c.playerPosition === absolutePosition) ?? false;

              return (
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`
                    w-full max-w-[200px] rounded-lg px-3 py-1.5 text-sm font-medium uppercase tracking-[0.2em] text-center
                    ${isCurrentTurn ? 'bg-emerald-400 text-slate-900 ring-1 ring-emerald-300' : hasCardInTrick ? 'bg-white/20 text-emerald-100' : 'bg-white/10 text-emerald-200/70'}
                  `}>
                    {myPlayer?.name || `P${absolutePosition}`}
                  </div>
                  <div className="w-full max-w-[200px]">
                    <PlayerStatusIndicators 
                      gameState={gameState} 
                      playerPosition={absolutePosition}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Player Hand Area (Bottom) */}
          <div
            className={
              myPlayer.folded !== true
                ? 'relative flex-1 min-h-0 flex flex-col justify-center px-4 md:px-6 lg:px-8 py-2 md:py-6 lg:py-8 md:min-h-[200px] lg:min-h-[240px]'
                : 'relative flex-1 min-h-0 flex items-center justify-center px-4 md:px-6 lg:px-8 py-2 md:py-6 lg:py-8 md:min-h-[200px] lg:min-h-[240px]'
            }
          >
            {/* Game Notifications - absolutely positioned in space above player hand.
                 Absolute positioning removes it from layout flow, preventing shifts when appearing/disappearing */}
            <GameNotification />

            {myPlayer.folded !== true ? (
              <>
                <PlayerHand
                  cards={myPlayer.hand}
                  onCardClick={isMyTurn && phase === 'PLAYING' ? playCard : undefined}
                  disabled={!isMyTurn || phase !== 'PLAYING'}
                  trumpSuit={gameState.trumpSuit}
                />
              </>
            ) : (
              <div className="text-center">
                <p className="text-base md:text-lg font-semibold text-white/90">
                  You have folded this round
                </p>
                <p className="mt-2 text-base md:text-sm text-emerald-200/70">
                  Sit back and watch the remaining tricks play out.
                </p>
              </div>
            )}

            {showNextHandPopup && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 md:px-6 lg:px-8" style={{ opacity: 1, filter: 'none', isolation: 'isolate' }}>
                <div className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-3 md:gap-4 rounded-2xl border border-white/15 bg-slate-950 px-5 md:px-6 py-4 md:py-5 text-center text-slate-100 shadow-lg md:shadow-[0_35px_80px_-35px_rgba(16,185,129,0.9)]" style={{ opacity: 1, filter: 'none' }}>
                  <p className="text-sm md:text-[0.7rem] font-semibold uppercase tracking-[0.3em] md:tracking-[0.35em] text-emerald-200/70">
                    Round complete
                  </p>
                  <div className="flex w-full items-center justify-between gap-2 md:gap-3">
                      <p className="text-left text-base md:text-sm text-white" aria-live="polite">
                      Next hand in{' '}
                      <span className="font-semibold text-emerald-200">
                        {nextHandCountdown ?? '—'}s
                      </span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-emerald-500/90 text-white transition hover:bg-emerald-500"
                      onClick={startNextRound}
                    >
                      Start now
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Game Over Screen */}
          {phase === 'GAME_OVER' && gameState.winner !== null && (
            <div className="rounded-2xl md:rounded-[32px] border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 p-6 md:p-8 text-center shadow-xl md:shadow-2xl backdrop-blur">
              <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-[0.35em] md:tracking-[0.4em] text-emerald-100">
                Game complete
              </h2>
              <p className="mt-2 md:mt-3 text-lg md:text-lg text-white">
                Winner · <span className="font-semibold">{getPlayerByPosition(gameState.winner)?.name}</span>
              </p>
              <p className="mt-1 text-base md:text-sm text-emerald-200/70">
                Final score {getPlayerByPosition(gameState.winner)?.score}
              </p>
              <p className="mt-4 md:mt-6 text-base md:text-sm text-emerald-100/80">
                Ready for another showdown? Start a fresh table or head back to the lobby to celebrate.
              </p>
              <div className="mt-4 md:mt-6 flex flex-col items-center justify-center gap-2 md:gap-3 sm:flex-row">
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto min-w-[160px] md:min-w-[180px] justify-center bg-emerald-500/90 text-white transition hover:bg-emerald-500"
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
                  className="w-full sm:w-auto min-w-[160px] md:min-w-[180px] justify-center border-white/40 bg-white/10 text-white transition hover:bg-white/20"
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
                <p className="mt-3 md:mt-4 text-base md:text-sm text-rose-200/80">{actionError}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
