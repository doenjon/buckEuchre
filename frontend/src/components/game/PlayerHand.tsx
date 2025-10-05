/**
 * @module components/game/PlayerHand
 * @description Display player's hand of cards
 */

import type { Card as CardType } from '@buck-euchre/shared';
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
      className="flex flex-wrap sm:flex-nowrap justify-center items-end gap-1 sm:gap-2 px-2 sm:px-0"
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
          }}
        >
          <Card
            card={card}
            onClick={onCardClick ? () => onCardClick(card.id) : undefined}
            disabled={disabled || !onCardClick}
            selected={selectedCardId === card.id}
            size="large"
          />
        </div>
      ))}
    </div>
  );
}
