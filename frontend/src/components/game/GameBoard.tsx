/**
 * @module components/game/GameBoard
 * @description Main game board component
 */

import { Scoreboard } from './Scoreboard';
import { TurnIndicator } from './TurnIndicator';
import { CurrentTrick } from './CurrentTrick';
import { PlayerHand } from './PlayerHand';
import { BiddingPanel } from './BiddingPanel';
import { TrumpSelector } from './TrumpSelector';
import { FoldDecision } from './FoldDecision';
import { WaitingForPlayers } from './WaitingForPlayers';
import { useGame } from '@/hooks/useGame';
import type { GameState } from '@buck-euchre/shared';

interface GameBoardProps {
  gameState: GameState;
  myPosition: number;
}

export function GameBoard({ gameState, myPosition }: GameBoardProps) {
  const { phase, currentPlayerPosition, currentBidder, players } = gameState;
  const { playCard } = useGame();

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

  const myPlayer = players[myPosition];
  
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
      activePosition = gameState.currentTrick?.winner ?? null;
      isMyTurn = false;
      break;
    default:
      activePosition = null;
      isMyTurn = false;
  }

  const currentPlayer = activePosition !== null ? players[activePosition] : null;
  const completedTrick =
    gameState.tricks.length > 0
      ? gameState.tricks[gameState.tricks.length - 1]
      : null;
  const displayTrick =
    gameState.currentTrick && gameState.currentTrick.cards.length > 0
      ? gameState.currentTrick
      : completedTrick;
  const showCurrentTrick = !!displayTrick && displayTrick.cards.length > 0;
  const trickHighlightPosition =
    activePosition !== null
      ? activePosition
      : displayTrick?.cards[displayTrick.cards.length - 1]?.playerPosition ?? 0;

  const actionPanel = (() => {
    if (phase === 'BIDDING') {
      return (
        <BiddingPanel
          currentBid={gameState.highestBid}
          isMyTurn={isMyTurn}
        />
      );
    }

    if (phase === 'DECLARING_TRUMP') {
      return <TrumpSelector isMyTurn={gameState.winningBidderPosition === myPosition} />;
    }

    if (phase === 'FOLDING_DECISION' && gameState.winningBidderPosition !== myPosition) {
      return (
        <FoldDecision
          gameState={gameState}
          myPosition={myPosition}
          isMyTurn={isMyTurn}
        />
      );
    }

    return null;
  })();

  return (
    <div className="flex flex-col gap-6 text-white">
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="flex flex-col gap-6">
          <Scoreboard
            players={players}
            currentPlayerPosition={activePosition}
            phase={phase}
            trumpSuit={gameState.trumpSuit}
            winningBidderPosition={gameState.winningBidderPosition}
          />

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-white/60">Phase</span>
                <span className="text-base font-semibold text-white/90">{phase.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-white/60">Round</span>
                <span className="text-base font-semibold text-white/90">{gameState.round}</span>
              </div>
              {gameState.trumpSuit && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/60">Trump</span>
                  <span className="text-base font-semibold text-white/90">{gameState.trumpSuit}</span>
                </div>
              )}
              {gameState.highestBid !== null && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/60">Highest Bid</span>
                  <span className="text-base font-semibold text-white/90">{gameState.highestBid}</span>
                </div>
              )}
            </div>
          </div>

          {actionPanel && (
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
              {actionPanel}
            </div>
          )}
        </aside>

        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/10 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.35),_transparent_60%)]" />

          <div className="relative flex h-full flex-col gap-6 p-6 sm:p-10">
            {currentPlayer && (
              <TurnIndicator
                currentPlayer={currentPlayer}
                isMyTurn={isMyTurn}
                phase={phase}
                className="shadow-lg"
              />
            )}

            {showCurrentTrick ? (
              <CurrentTrick
                trick={displayTrick}
                players={players}
                currentPlayerPosition={trickHighlightPosition}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="rounded-full border border-dashed border-white/30 px-6 py-4 text-center text-sm font-medium uppercase tracking-[0.2em] text-white/60">
                  Waiting for the first card...
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {myPlayer.folded !== true && (
        <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="mb-4 text-center text-xs font-medium uppercase tracking-[0.3em] text-white/60">
            Your Hand
          </div>
          <PlayerHand
            cards={myPlayer.hand}
            onCardClick={isMyTurn && phase === 'PLAYING' ? playCard : undefined}
            disabled={!isMyTurn || phase !== 'PLAYING'}
          />
        </div>
      )}

      {myPlayer.folded === true && (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
          <p className="text-xl font-semibold text-white">
            You have folded this round
          </p>
          <p className="mt-2 text-sm text-white/70">
            Watch the table to see how the hand plays out.
          </p>
        </div>
      )}

      {phase === 'GAME_OVER' && gameState.winner !== null && (
        <div className="rounded-[32px] border border-yellow-300/40 bg-gradient-to-br from-yellow-400/30 via-amber-400/30 to-transparent p-8 text-center text-white shadow-[0_20px_80px_-40px_rgba(250,204,21,0.8)] backdrop-blur">
          <h2 className="mb-4 text-3xl font-semibold">Game Over</h2>
          <p className="text-xl">
            Winner: <span className="font-bold">{players[gameState.winner].name}</span>
          </p>
          <p className="mt-2 text-sm uppercase tracking-[0.4em] text-white/70">
            Final score {players[gameState.winner].score}
          </p>
        </div>
      )}
    </div>
  );
}
