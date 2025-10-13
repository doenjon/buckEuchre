/**
 * @module components/game/PlayerHand
 * @description Display player's hand of cards
 */

import { useMemo } from 'react';
import type { Card as CardType, Suit } from '@buck-euchre/shared';
import {
  TRUMP_RANK_VALUES,
  NON_TRUMP_RANK_VALUES,
  getEffectiveSuit,
} from '@buck-euchre/shared';
import { Card } from './Card';

export interface PlayerHandProps {
  cards: CardType[];
  onCardClick?: (cardId: string) => void;
  disabled?: boolean;
  selectedCardId?: string | null;
  trumpSuit?: Suit | null;
}

const SUIT_DISPLAY_ORDER: readonly Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];

function getTrumpRankValue(card: CardType, trumpSuit: Suit): number {
  if (card.rank === 'JACK' && card.suit === trumpSuit) {
    // Right Bower
    return 7;
  }

  const effectiveSuit = getEffectiveSuit(card, trumpSuit);

  if (effectiveSuit !== trumpSuit) {
    return 0;
  }

  if (card.rank === 'JACK' && card.suit !== trumpSuit) {
    // Left Bower (Jack of same color)
    return 6;
  }

  return TRUMP_RANK_VALUES[card.rank] ?? 0;
}

function getSuitOrderValue(suit: Suit): number {
  const index = SUIT_DISPLAY_ORDER.indexOf(suit);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function compareCards(a: CardType, b: CardType, trumpSuit: Suit | null): number {
  if (trumpSuit) {
    const aIsTrump = getEffectiveSuit(a, trumpSuit) === trumpSuit;
    const bIsTrump = getEffectiveSuit(b, trumpSuit) === trumpSuit;

    if (aIsTrump && !bIsTrump) {
      return -1;
    }

    if (!aIsTrump && bIsTrump) {
      return 1;
    }

    if (aIsTrump && bIsTrump) {
      return getTrumpRankValue(b, trumpSuit) - getTrumpRankValue(a, trumpSuit);
    }
  }

  if (a.suit === b.suit) {
    return (NON_TRUMP_RANK_VALUES[b.rank] ?? 0) - (NON_TRUMP_RANK_VALUES[a.rank] ?? 0);
  }

  return getSuitOrderValue(a.suit) - getSuitOrderValue(b.suit);
}

export function PlayerHand({
  cards,
  onCardClick,
  disabled = false,
  selectedCardId = null,
  trumpSuit = null
}: PlayerHandProps) {
  const sortedCards = useMemo(() => {
    if (!cards || cards.length === 0) {
      return [];
    }

    return [...cards].sort((a, b) => compareCards(a, b, trumpSuit ?? null));
  }, [cards, trumpSuit]);

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
      className="flex w-full flex-wrap items-end justify-center gap-1 px-2 sm:flex-nowrap sm:gap-2 sm:px-0"
      role="group"
      aria-label={`Your hand: ${cards.length} cards`}
    >
      {sortedCards.map((card, index) => (
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
