/**
 * @module components/game/CurrentTrick
 * @description Display cards played in current trick
 */

import { useRef, useLayoutEffect, useState } from 'react';
import type { Trick, Player, GameState } from '@buck-euchre/shared';
import { Card } from './Card';

export interface CurrentTrickProps {
  trick: Trick | null;
  players: Player[];
  currentPlayerPosition: number;
  myPosition: number;
  gameState: GameState;
}

export function CurrentTrick({
  trick,
  players: _players,
  currentPlayerPosition: _currentPlayerPosition,
  myPosition,
  gameState
}: CurrentTrickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [borderRadius, setBorderRadius] = useState<string>('9999px');

  useLayoutEffect(() => {
    const updateBorderRadius = () => {
      if (containerRef.current && window.innerWidth < 768) {
        const height = containerRef.current.offsetHeight;
        // Use 30% of height instead of 50% to create squished elliptical ends (not perfect semicircles)
        // This creates a more pill-shaped stadium look on mobile
        const radius = height * 0.3; // Squished curve, not a semicircle
        setBorderRadius(`${radius}px`);
        containerRef.current.style.borderRadius = `${radius}px`;
      } else {
        setBorderRadius('9999px');
        if (containerRef.current) {
          containerRef.current.style.borderRadius = '9999px';
        }
      }
    };

    const resizeObserver = new ResizeObserver(updateBorderRadius);
    const currentRef = containerRef.current;
    
    if (currentRef) {
      resizeObserver.observe(currentRef);
      setTimeout(updateBorderRadius, 0);
    }

    window.addEventListener('resize', updateBorderRadius);

    return () => {
      window.removeEventListener('resize', updateBorderRadius);
      resizeObserver.disconnect();
    };
  }, [trick]);

  if (!trick || trick.cards.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex w-full h-full items-center justify-center border border-white/10 bg-gradient-to-br from-emerald-950/90 via-emerald-900/80 to-emerald-800/60 shadow-lg md:shadow-2xl backdrop-blur"
        style={{ borderRadius }}
        role="region"
        aria-label="Current trick area"
      />
    );
  }

  // Arrange cards around the center with the local player seated at the bottom
  const cardPositions = [
    'bottom-6 left-1/2 -translate-x-1/2 sm:bottom-10', // South (you)
    'left-4 top-1/2 -translate-y-1/2 sm:left-8', // Seat to your left
    'top-6 left-1/2 -translate-x-1/2 sm:top-10', // Across from you
    'right-4 top-1/2 -translate-y-1/2 sm:right-8' // Seat to your right
  ];

  // Positions for fold/stay indicators - closer to center than cards
  const indicatorPositions = [
    'bottom-3 left-1/2 -translate-x-1/2 sm:bottom-5', // South (you)
    'left-2 top-1/2 -translate-y-1/2 sm:left-4', // Seat to your left
    'top-3 left-1/2 -translate-x-1/2 sm:top-5', // Across from you
    'right-2 top-1/2 -translate-y-1/2 sm:right-4' // Seat to your right
  ];


  // Determine if we should show "Stay" indicators (only before first card is played)
  const hasCardsPlayed = trick && trick.cards.length > 0;

  return (
    <div
      ref={containerRef}
      className="relative flex w-full h-full items-center justify-center overflow-visible border border-white/10 bg-gradient-to-br from-emerald-950/90 via-emerald-900/80 to-emerald-800/60 shadow-lg md:shadow-[0_30px_80px_-40px_rgba(16,185,129,0.9)] backdrop-blur"
      style={{ borderRadius }}
      role="region"
      aria-label={`Trick ${trick.number}, ${trick.cards.length} of 4 cards played`}
    >
      {/* Glow effect in center */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-900/60 blur-3xl" />

      {/* Fold/Stay indicators for each player position */}
      {gameState.players.map((player) => {
        // Skip if this player already has a card in the current trick
        const hasPlayedCard = trick?.cards.some(c => c.playerPosition === player.position);
        if (hasPlayedCard) return null;

        // Check fold decision
        const showStay = player.foldDecision === 'STAY' && !hasCardsPlayed;
        const showFold = player.foldDecision === 'FOLD';

        if (!showStay && !showFold) return null;

        const relativeSeatIndex = ((player.position - myPosition) % 4 + 4) % 4;
        const positionClass = indicatorPositions[relativeSeatIndex];

        return (
          <div
            key={`indicator-${player.position}`}
            className={`absolute ${positionClass} z-10 flex items-center justify-center`}
          >
            <div className={`
              px-3 py-1.5 rounded-lg font-semibold text-sm
              ${showFold
                ? 'bg-slate-600/20 text-slate-400 border border-slate-500/50'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'}
            `}>
              {showFold ? 'Fold' : 'Stay'}
            </div>
          </div>
        );
      })}

      {trick.cards.map((playedCard, index) => {
        const relativeSeatIndex =
          ((playedCard.playerPosition - myPosition) % 4 + 4) % 4;
        const positionClass = cardPositions[relativeSeatIndex];
        const isWinner = trick.winner === playedCard.playerPosition;

        return (
          <div
            key={playedCard.playerPosition}
            className={`
              absolute ${positionClass} z-10
              flex flex-col items-center transition-transform duration-500
              ${isWinner ? 'scale-105 drop-shadow-[0_15px_25px_rgba(250,204,21,0.35)]' : ''}
            `}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className={`${isWinner ? 'rounded-2xl ring-4 ring-emerald-300/60' : 'drop-shadow-[0_20px_32px_rgba(16,185,129,0.35)]'}`}>
              <Card card={playedCard.card} size="large" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
