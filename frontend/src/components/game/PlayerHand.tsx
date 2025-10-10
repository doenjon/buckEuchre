/**
 * @module components/game/PlayerHand
 * @description Display player's hand of cards
 */

import type { Card as CardType } from '@buck-euchre/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './Card';

export interface PlayerHandProps {
  cards: CardType[];
  onCardClick?: (cardId: string) => void;
  disabled?: boolean;
  selectedCardId?: string | null;
}

export function PlayerHand({
  cards,
  onCardClick,
  disabled = false,
  selectedCardId = null
}: PlayerHandProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      const rect = element.getBoundingClientRect();
      setContainerWidth(rect.width);
    };

    updateWidth();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });

      observer.observe(element);

      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const { cardWidth, cardHeight, cardSize } = useMemo(() => {
    if (!cards || cards.length === 0) {
      return { cardWidth: 80, cardHeight: 136, cardSize: 'large' as const };
    }

    const gap = containerWidth >= 640 ? 8 : 4;
    const availableWidth = Math.max(containerWidth - gap * (cards.length - 1), 0);
    const minWidth = 48;
    const maxWidth = 112;
    const computedWidth = containerWidth > 0 ? availableWidth / cards.length : 80;
    const clampedWidth = Math.min(Math.max(computedWidth, minWidth), maxWidth);
    const aspectRatio = 136 / 80; // Matches large card size (height / width)
    const height = Math.round(clampedWidth * aspectRatio);

    const size: 'small' | 'medium' | 'large' =
      clampedWidth >= 88 ? 'large' : clampedWidth >= 72 ? 'medium' : 'small';

    return { cardWidth: clampedWidth, cardHeight: height, cardSize: size };
  }, [cards, containerWidth]);

  if (!cards || cards.length === 0) {
    return (
      <div
        className="text-center text-gray-500 py-8"
        role="status"
        aria-label="No cards in hand"
      >
        <p>No cards in hand</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-nowrap items-end justify-center gap-1 px-2 sm:gap-2 sm:px-0"
      role="group"
      aria-label={`Your hand: ${cards.length} cards`}
    >
      {cards.map((card, index) => (
        <div
          key={card.id}
          className="transition-all duration-300 hover:z-10"
          style={{
            transform: `translateY(${index % 2 === 0 ? '0' : '4px'}) scale(${selectedCardId === card.id ? 1.05 : 1})`,
            animationDelay: `${index * 50}ms`,
            width: `${cardWidth}px`,
          }}
        >
          <Card
            card={card}
            onClick={onCardClick ? () => onCardClick(card.id) : undefined}
            disabled={disabled || !onCardClick}
            selected={selectedCardId === card.id}
            size={cardSize}
            style={{
              width: `${cardWidth}px`,
              height: `${cardHeight}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
