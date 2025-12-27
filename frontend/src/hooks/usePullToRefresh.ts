/**
 * @module hooks/usePullToRefresh
 * @description Custom hook for pull-to-refresh gesture handling
 */

import { useRef, useCallback, useState, useEffect } from 'react';

interface UsePullToRefreshOptions {
  /** Minimum pull distance (in px) to trigger refresh */
  threshold?: number;
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void> | void;
  /** Whether pull-to-refresh is enabled */
  enabled?: boolean;
}

interface UsePullToRefreshResult {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Current pull distance (0 when not pulling) */
  pullDistance: number;
  /** Handler for touch start */
  onTouchStart: (e: React.TouchEvent) => void;
  /** Handler for touch move */
  onTouchMove: (e: React.TouchEvent) => void;
  /** Handler for touch end */
  onTouchEnd: () => void;
}

export function usePullToRefresh({
  threshold = 80,
  onRefresh,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number>(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isPulling = useRef(false);

  // Reset pull distance when disabled
  useEffect(() => {
    if (!enabled) {
      setPullDistance(0);
      isPulling.current = false;
    }
  }, [enabled]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;

    const container = containerRef.current;
    // Only start pull if at top of scroll container
    if (container && container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [enabled, isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing || !isPulling.current) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      // User scrolled down, cancel pull
      isPulling.current = false;
      setPullDistance(0);
      return;
    }

    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY.current;

    if (distance > 0) {
      // Apply resistance to make it feel more natural
      const resistance = 0.5;
      const resistedDistance = Math.min(distance * resistance, threshold * 1.5);
      setPullDistance(resistedDistance);
    } else {
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing) return;

    isPulling.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Keep at threshold during refresh

      try {
        await onRefresh();
      } catch (err) {
        console.error('[usePullToRefresh] Refresh failed:', err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, pullDistance, threshold, onRefresh]);

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
