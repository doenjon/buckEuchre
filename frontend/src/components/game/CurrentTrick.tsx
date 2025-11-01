/**
 * @module components/game/CurrentTrick
 * @description Display cards played in current trick
 */

import { useRef, useLayoutEffect, useState } from 'react';
import type { Trick, Player } from '@buck-euchre/shared';
import { Card } from './Card';

export interface CurrentTrickProps {
  trick: Trick | null;
  players: Player[];
  currentPlayerPosition: number;
  myPosition: number;
}

export function CurrentTrick({
  trick,
  players,
  currentPlayerPosition,
  myPosition
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
    'bottom-10 left-1/2 -translate-x-1/2 sm:bottom-16', // South (you)
    'left-8 top-1/2 -translate-y-1/2 sm:left-16', // Seat to your left
    'top-10 left-1/2 -translate-x-1/2 sm:top-16', // Across from you
    'right-8 top-1/2 -translate-y-1/2 sm:right-16' // Seat to your right
  ];


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
