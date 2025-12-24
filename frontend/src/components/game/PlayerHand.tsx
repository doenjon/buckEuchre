/**
 * @module components/game/PlayerHand
 * @description Display player's hand of cards
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, TouchEvent } from 'react';
import type { Card as CardType, Suit } from '@buck-euchre/shared';
import {
  TRUMP_RANK_VALUES,
  NON_TRUMP_RANK_VALUES,
  getEffectiveSuit,
} from '@buck-euchre/shared';
import { Card } from './Card';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Loader2 } from 'lucide-react';

export interface PlayerHandProps {
  cards: CardType[];
  onCardClick?: (cardId: string) => boolean | void; // Returns true if loading should be shown
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
  const { showCardOverlay, autoSortHand } = useSettingsStore();
  const sortedCardIds = useMemo(() => {
    if (!cards || cards.length === 0) {
      return [] as string[];
    }

    return [...cards]
      .sort((a, b) => compareCards(a, b, trumpSuit ?? null))
      .map(card => card.id);
  }, [cards, trumpSuit]);

  // Initial order: sorted if autoSortHand is enabled, otherwise preserve original order
  const initialCardIds = useMemo(() => {
    if (!cards || cards.length === 0) {
      return [] as string[];
    }
    return autoSortHand ? sortedCardIds : cards.map(card => card.id);
  }, [cards, autoSortHand, sortedCardIds]);

  const [cardOrder, setCardOrder] = useState<string[]>(() => initialCardIds);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [touchDraggedCardId, setTouchDraggedCardId] = useState<string | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
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
        // Use sorted order if auto-sort is enabled, otherwise preserve original order
        return autoSortHand ? sortedCardIds : cards.map(card => card.id);
      }

      const cardIdSet = new Set(cards.map(card => card.id));
      const filteredOrder = previousOrder.filter(id => cardIdSet.has(id));
      
      // For missing cards: use sorted order if auto-sort is enabled, otherwise use original order
      const cardOrderToUse = autoSortHand ? sortedCardIds : cards.map(card => card.id);
      const missingCards = cardOrderToUse.filter(id => !filteredOrder.includes(id));

      if (filteredOrder.length === previousOrder.length && missingCards.length === 0) {
        return previousOrder;
      }

      return [...filteredOrder, ...missingCards];
    });
  }, [cards, sortedCardIds, autoSortHand]);

  // Auto-sort hand when trump suit changes (only if autoSortHand is enabled)
  useEffect(() => {
    if (trumpSuit !== previousTrumpSuit.current) {
      previousTrumpSuit.current = trumpSuit;
      // Reset to sorted order when trump changes, but only if auto-sort is enabled
      if (autoSortHand) {
        setCardOrder(sortedCardIds);
      }
    }
  }, [trumpSuit, sortedCardIds, autoSortHand]);

  // Handle autoSortHand setting changes
  useEffect(() => {
    if (autoSortHand) {
      // When auto-sort is enabled, sort the cards
      setCardOrder(sortedCardIds);
    }
    // When auto-sort is disabled, preserve current order (no action needed)
  }, [autoSortHand, sortedCardIds]);

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

  // Clear playing state when card is no longer in hand (it was played) or after timeout
  useEffect(() => {
    if (!playingCardId) return;

    // Check if card is still in hand
    const cardStillInHand = cards.some(card => card.id === playingCardId);
    
    if (!cardStillInHand) {
      // Card was played, clear loading state
      setPlayingCardId(null);
      return;
    }

    // Set timeout to clear loading state after 5 seconds (in case of error or no response)
    const timeout = setTimeout(() => {
      setPlayingCardId(null);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [cards, playingCardId]);

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
      // onCardClick should validate and only set loading if valid
      // Don't set loading here - let the validation happen first
      const result = onCardClick(card.id);
      // Only set loading if the function returns true (validation passed)
      if (result === true) {
        setPlayingCardId(card.id);
      }
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
          const showAnalysis = !disabled && aiAnalysis && analysis && showCardOverlay;
          const isPlaying = playingCardId === card.id;

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
                touchAction: 'none', // Prevent default touch actions during drag
                zIndex: index, // Cards to the right appear on top
              }}
            >
              <Card
                card={card}
                onClick={() => handleCardClick(card)}
                disabled={disabled || isPlaying}
                selected={selectedCardId === card.id}
                size="large"
              />
              {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <Loader2 className="h-10 w-10 md:h-12 md:w-12 text-emerald-300 animate-spin" strokeWidth={3} />
                </div>
              )}
              {showAnalysis && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/95 to-black/30 rounded-t-lg p-1.5 pointer-events-none shadow-lg">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <div className="flex items-center gap-1">
                      {analysis.rank === 1 && (
                        <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="Best card">⭐</span>
                      )}
                      <span
                        className={`drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
                          analysis.expectedScore < 0 ? 'text-green-300' : analysis.expectedScore > 0 ? 'text-red-300' : 'text-yellow-300'
                        }`}
                        title={`Expected score change: ${analysis.expectedScore.toFixed(1)} (negative is good)`}
                      >
                        {analysis.expectedScore > 0 ? '+' : ''}{analysis.expectedScore.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-green-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" title="MCTS visits (exploration count)">
                      {analysis.visits}
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
