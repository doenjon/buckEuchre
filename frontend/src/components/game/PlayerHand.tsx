/**
 * @module components/game/PlayerHand
 * @description Display player's hand of cards
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, TouchEvent } from 'react';
import type { Card as CardType, Suit, CardAnalysis } from '@buck-euchre/shared';
import {
  TRUMP_RANK_VALUES,
  NON_TRUMP_RANK_VALUES,
  getEffectiveSuit,
} from '@buck-euchre/shared';
import { Card } from './Card';
import { useGameStore } from '@/stores/gameStore';

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
  const { aiAnalysis, getCardAnalysis } = useGameStore();
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
  const [touchDraggedCardId, setTouchDraggedCardId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const cardPositions = useRef(new Map<string, DOMRect>());
  const previousCardCount = useRef<number>(cards?.length ?? 0);
  const previousTrumpSuit = useRef<Suit | null>(trumpSuit);

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

  // Auto-sort hand when trump suit changes
  useEffect(() => {
    if (trumpSuit !== previousTrumpSuit.current) {
      previousTrumpSuit.current = trumpSuit;
      // Reset to sorted order when trump changes
      setCardOrder(sortedCardIds);
    }
  }, [trumpSuit, sortedCardIds]);

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
      .filter((card): card is CardType => {
        if (!card) {
          return false;
        }

        return !existingIds.has(card.id);
      });

    return [...mappedCards, ...fallbackCards];
  }, [cardOrder, cards, cardsById, sortedCardIds]);

  useLayoutEffect(() => {
    const currentCardCount = orderedCards.length;
    const cardCountChanged = currentCardCount !== previousCardCount.current;

    // Clear positions when card count changes to prevent jittery animations
    if (cardCountChanged) {
      cardPositions.current.clear();
      previousCardCount.current = currentCardCount;
      return;
    }

    // Only run FLIP animation when cards are reordered (not added/removed)
    const previousPositions = cardPositions.current;
    const nextPositions = new Map<string, DOMRect>();
    // Threshold to ignore minor position changes (sub-pixel movements)
    const POSITION_THRESHOLD = 2;

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

      // Ignore sub-pixel and minor position changes to prevent jitter
      if (Math.abs(deltaX) < POSITION_THRESHOLD && Math.abs(deltaY) < POSITION_THRESHOLD) {
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
    setDraggedCardId(cardId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', cardId);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
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

  // Touch event handlers for mobile support
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>, cardId: string) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    setTouchDraggedCardId(cardId);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!touchDraggedCardId) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    event.preventDefault(); // Prevent scrolling while dragging

    // Find which card is under the touch point
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) {
      return;
    }

    // Find the card element (might be nested)
    const cardElement = element.closest('[data-card-id]');
    if (!cardElement) {
      return;
    }

    const targetCardId = cardElement.getAttribute('data-card-id');
    if (!targetCardId || targetCardId === touchDraggedCardId) {
      return;
    }

    // Reorder the cards
    setCardOrder(previousOrder => {
      if (!previousOrder.includes(touchDraggedCardId)) {
        return previousOrder;
      }

      const nextOrder = previousOrder.filter(id => id !== touchDraggedCardId);
      const targetIndex = nextOrder.indexOf(targetCardId);

      const insertionIndex = targetIndex === -1 ? nextOrder.length : targetIndex;
      nextOrder.splice(insertionIndex, 0, touchDraggedCardId);
      return [...nextOrder];
    });
  };

  const handleTouchEnd = () => {
    setTouchDraggedCardId(null);
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

  const handleCardClick = (card: CardType) => {
    console.log('[PlayerHand] Card clicked:', {
      cardId: card.id,
      card: card,
      disabled,
      hasOnClick: !!onCardClick,
      onCardClick
    });
    if (!disabled && onCardClick) {
      console.log('[PlayerHand] Calling onCardClick with:', card.id);
      onCardClick(card.id);
    } else {
      console.warn('[PlayerHand] Card click ignored:', { disabled, hasOnClick: !!onCardClick });
    }
  };

  // Always fan cards - calculate rotation based on card count
  const cardCount = cards.length;
  // Use consistent center point for both rotation and arch calculations
  const centerPosition = (cardCount - 1) / 2;

  return (
    <div
      className="flex items-center justify-center w-full"
      role="group"
      aria-label="Your hand of cards"
      onDrop={handleDropOnContainer}
      onDragOver={handleDragOver}
    >
      <div
        className="flex items-end justify-center -space-x-2 md:-space-x-3 max-w-full px-2"
      >
        {orderedCards.map((card, index) => {
          // Calculate arch effect - center cards higher, edge cards slightly lower
          // Use same center point as rotation for consistency
          const distanceFromCenter = index - centerPosition;
          const normalizedDistance = cardCount > 1 ? distanceFromCenter / centerPosition : 0;
          const archOffset = normalizedDistance * normalizedDistance * 6; // 6px max offset

          const analysis = getCardAnalysis(card.id);
          const showAnalysis = !disabled && aiAnalysis && analysis;

          return (
            <div
              key={card.id}
              data-card-id={card.id}
              className={`
                hover:z-10 focus-within:z-10 relative
                ${touchDraggedCardId === card.id ? 'opacity-50' : ''}
              `}
              ref={setCardRef(card.id)}
              draggable={true}
              onDragStart={event => handleDragStart(event, card.id)}
              onDragOver={handleDragOver}
              onDrop={event => handleDropOnCard(event, card.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={event => handleTouchStart(event, card.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                // Slight rotation for fanning effect + subtle arch
                transform: `rotate(${distanceFromCenter * 2}deg) translateY(${archOffset}px)`,
                animationDelay: `${index * 50}ms`,
                opacity: 1,
                touchAction: 'none', // Prevent default touch actions during drag
                zIndex: index, // Cards to the right appear on top
              }}
            >
              <Card
                card={card}
                onClick={() => handleCardClick(card)}
                disabled={disabled}
                selected={selectedCardId === card.id}
                size="large"
              />
              {showAnalysis && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent rounded-t-lg p-1 pointer-events-none">
                  <div className="flex items-center justify-between text-[10px] font-semibold">
                    <div className="flex items-center gap-1">
                      {analysis.rank === 1 && (
                        <span className="text-yellow-400" title="Best card">⭐</span>
                      )}
                      <span
                        className={`${
                          analysis.winProbability > 0.6 ? 'text-green-400' :
                          analysis.winProbability > 0.4 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}
                        title="Win probability"
                      >
                        {(analysis.winProbability * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span
                      className="text-blue-300"
                      title={`Expected tricks: ${analysis.expectedTricks.toFixed(1)}`}
                    >
                      {analysis.expectedTricks.toFixed(1)}🃏
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
