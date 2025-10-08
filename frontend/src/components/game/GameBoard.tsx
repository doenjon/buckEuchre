/**
 * @module components/game/GameBoard
 * @description Main game board component
 */

import type { ReactNode } from 'react';
import { Scoreboard } from './Scoreboard';
import { TurnIndicator } from './TurnIndicator';
import { CurrentTrick } from './CurrentTrick';
import { PlayerHand } from './PlayerHand';
import { BiddingPanel } from './BiddingPanel';
import { TrumpSelector } from './TrumpSelector';
import { FoldDecision } from './FoldDecision';
import { WaitingForPlayers } from './WaitingForPlayers';
import { useGame } from '@/hooks/useGame';
import { Button } from '@/components/ui/button';
import type { GameState } from '@buck-euchre/shared';

interface GameBoardProps {
  gameState: GameState;
  myPosition: number;
}

export function GameBoard({ gameState, myPosition }: GameBoardProps) {
  const { phase, currentPlayerPosition, currentBidder, players } = gameState;
  const { playCard, startNextRound } = useGame();

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

  const suitSymbols: Record<string, string> = {
    SPADES: '♠',
    HEARTS: '♥',
    DIAMONDS: '♦',
    CLUBS: '♣'
  };

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

  const phaseLabel = phase.replace(/_/g, ' ');
  const infoItems = [
    {
      label: 'Phase',
      value: phaseLabel
    },
    {
      label: 'Round',
      value: `#${gameState.round}`
    },
    gameState.trumpSuit
      ? {
          label: 'Trump',
          value: `${suitSymbols[gameState.trumpSuit] ?? ''} ${gameState.trumpSuit}`
        }
      : null,
    gameState.highestBid !== null
      ? {
          label: 'High Bid',
          value: gameState.highestBid
        }
      : null
  ].filter(Boolean) as { label: string; value: string | number }[];

  const personalItems = [
    {
      label: 'Your seat',
      value: myPosition + 1
    },
    {
      label: 'Score',
      value: myPlayer.score
    },
    {
      label: 'Tricks',
      value: myPlayer.tricksTaken
    },
    myPlayer.folded === true
      ? {
          label: 'Status',
          value: 'Folded'
        }
      : null
  ].filter(Boolean) as { label: string; value: string | number }[];

  let actionPanel: ReactNode = null;

  if (phase === 'BIDDING') {
    actionPanel = (
      <BiddingPanel
        currentBid={gameState.highestBid}
        isMyTurn={isMyTurn}
      />
    );
  } else if (phase === 'DECLARING_TRUMP') {
    actionPanel = (
      <TrumpSelector
        isMyTurn={gameState.winningBidderPosition === myPosition}
      />
    );
  } else if (phase === 'FOLDING_DECISION' && gameState.winningBidderPosition !== myPosition) {
    actionPanel = (
      <FoldDecision
        gameState={gameState}
        myPosition={myPosition}
        isMyTurn={isMyTurn}
      />
    );
  } else if (phase === 'ROUND_OVER' && !gameState.gameOver) {
    actionPanel = (
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
          className="w-full justify-center bg-emerald-500/90 text-white shadow-[0_18px_40px_-20px_rgba(16,185,129,0.9)] transition hover:bg-emerald-500"
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

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,260px)] lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
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

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/70">
              Game state
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-white/90">
              {infoItems.map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                    {item.label}
                  </span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {personalItems.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 shadow-xl backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                You at the table
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/90">
                {personalItems.map(item => (
                  <div key={item.label} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/60">
                      {item.label}
                    </span>
                    <span className="text-base font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Middle Column: Table */}
        <section className="order-1 flex flex-col gap-6 xl:order-2">
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
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-4 shadow-[0_25px_70px_-40px_rgba(16,185,129,0.8)] backdrop-blur">
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
            </div>
          )}
        </section>

        {/* Right Column: Actions */}
        {actionPanel && (
          <aside className="order-3 flex flex-col gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-slate-100 shadow-xl backdrop-blur">
              {actionPanel}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
