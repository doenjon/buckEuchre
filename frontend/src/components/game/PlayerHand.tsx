/**
 * @module components/game/PlayerHand
 * @description Display player's hand of cards
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
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
  const sortedCardIds = useMemo(() => {
    if (!cards || cards.length === 0) {
      return [] as string[];
    }

    return [...cards]
      .sort((a, b) => compareCards(a, b, trumpSuit ?? null))
      .map(card => card.id);
  }, [cards, trumpSuit]);

  const [cardOrder, setCardOrder] = useState<string[]>(() => sortedCardIds);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const cardPositions = useRef(new Map<string, DOMRect>());

  const setCardRef = useCallback(
    (cardId: string) => (node: HTMLDivElement | null) => {
      if (!node) {
        cardRefs.current.delete(cardId);
        return;
      }

      cardRefs.current.set(cardId, node);
    },
    []
  );

  useEffect(() => {
    if (!cards || cards.length === 0) {
      setCardOrder([]);
      return;
    }

    setCardOrder(previousOrder => {
      if (!previousOrder || previousOrder.length === 0) {
        return sortedCardIds;
      }

      const cardIdSet = new Set(cards.map(card => card.id));
      const filteredOrder = previousOrder.filter(id => cardIdSet.has(id));
      const missingCards = sortedCardIds.filter(id => !filteredOrder.includes(id));

      if (filteredOrder.length === previousOrder.length && missingCards.length === 0) {
        return previousOrder;
      }

      return [...filteredOrder, ...missingCards];
    });
  }, [cards, sortedCardIds]);

  const cardsById = useMemo(() => {
    if (!cards) {
      return new Map<string, CardType>();
    }

    return cards.reduce((map, card) => {
      map.set(card.id, card);
      return map;
    }, new Map<string, CardType>());
  }, [cards]);

  const orderedCards = useMemo(() => {
    if (!cards || cards.length === 0) {
      return [] as CardType[];
    }

    const mappedCards = cardOrder
      .map(cardId => cardsById.get(cardId))
      .filter((card): card is CardType => Boolean(card));

    if (mappedCards.length === cards.length) {
      return mappedCards;
    }

    const existingIds = new Set(mappedCards.map(card => card.id));
    const fallbackCards = sortedCardIds
      .map(cardId => cardsById.get(cardId))
      .filter((card): card is CardType => Boolean(card) && !existingIds.has(card.id));

    return [...mappedCards, ...fallbackCards];
  }, [cardOrder, cards, cardsById, sortedCardIds]);

  useLayoutEffect(() => {
    const previousPositions = cardPositions.current;
    const nextPositions = new Map<string, DOMRect>();

    orderedCards.forEach(card => {
      const element = cardRefs.current.get(card.id);

      if (!element) {
        return;
      }

      const newRect = element.getBoundingClientRect();
      nextPositions.set(card.id, newRect);

      const previousRect = previousPositions.get(card.id);

      if (!previousRect) {
        return;
      }

      const deltaX = previousRect.left - newRect.left;
      const deltaY = previousRect.top - newRect.top;

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      if (typeof element.animate !== 'function') {
        return;
      }

      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' }
        ],
        {
          duration: 250,
          easing: 'ease-in-out'
        }
      );
    });

    cardPositions.current = nextPositions;
  }, [orderedCards]);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, cardId: string) => {
    if (disabled) {
      return;
    }

    setDraggedCardId(cardId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', cardId);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
  };

  const handleDropOnCard = (
    event: DragEvent<HTMLDivElement>,
    targetCardId: string
  ) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const draggedId = draggedCardId ?? event.dataTransfer?.getData('text/plain');

    if (!draggedId || draggedId === targetCardId) {
      setDraggedCardId(null);
      return;
    }

    setCardOrder(previousOrder => {
      if (!previousOrder.includes(draggedId)) {
        return previousOrder;
      }

      const nextOrder = previousOrder.filter(id => id !== draggedId);
      const targetIndex = nextOrder.indexOf(targetCardId);

      const insertionIndex = targetIndex === -1 ? nextOrder.length : targetIndex;
      nextOrder.splice(insertionIndex, 0, draggedId);
      return [...nextOrder];
    });

    setDraggedCardId(null);
  };

  const handleDropOnContainer = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();

    const draggedId = draggedCardId ?? event.dataTransfer?.getData('text/plain');

    if (!draggedId) {
      setDraggedCardId(null);
      return;
    }

    setCardOrder(previousOrder => {
      if (!previousOrder.includes(draggedId)) {
        return previousOrder;
      }

      const nextOrder = previousOrder.filter(id => id !== draggedId);
      nextOrder.push(draggedId);
      return [...nextOrder];
    });

    setDraggedCardId(null);
  };

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
      onDragOver={handleDragOver}
      onDrop={handleDropOnContainer}
    >
      {orderedCards.map((card, index) => (
        <div
          key={card.id}
          className={`transition-all duration-300 hover:z-10 ${
            draggedCardId === card.id ? 'opacity-60' : 'opacity-100'
          }`}
          ref={setCardRef(card.id)}
          data-testid="player-hand-card-wrapper"
          draggable={!disabled}
          onDragStart={event => handleDragStart(event, card.id)}
          onDragOver={handleDragOver}
          onDrop={event => handleDropOnCard(event, card.id)}
          onDragEnd={handleDragEnd}
          aria-grabbed={draggedCardId === card.id}
          aria-label={`Card position ${index + 1} of ${orderedCards.length}`}
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
