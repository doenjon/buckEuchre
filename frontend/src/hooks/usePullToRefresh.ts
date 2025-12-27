import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  /**
   * The threshold distance (in pixels) the user must pull down to trigger a refresh
   * @default 80
   */
  threshold?: number;

  /**
   * Maximum pull distance (in pixels) beyond which pulling won't have additional visual effect
   * @default 120
   */
  maxPullDistance?: number;

  /**
   * Whether pull-to-refresh is enabled
   * @default true
   */
  enabled?: boolean;
}

interface PullToRefreshState {
  /**
   * Current pull distance in pixels
   */
  pullDistance: number;

  /**
   * Whether the user is currently pulling
   */
  isPulling: boolean;

  /**
   * Whether a refresh is in progress
   */
  isRefreshing: boolean;
}

/**
 * Hook to implement pull-to-refresh functionality
 * Triggers a browser refresh when user pulls down on the screen
 */
export function usePullToRefresh(
  options: PullToRefreshOptions = {}
): PullToRefreshState {
  const {
    threshold = 80,
    maxPullDistance = 120,
    enabled = true
  } = options;

  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if at the top of the page
      if (window.scrollY === 0 && document.documentElement.scrollTop === 0) {
        const target = e.target as HTMLElement;
        // Check if the touch started on a scrollable element that's not at the top
        let element: HTMLElement | null = target;
        while (element && element !== document.body) {
          const { scrollTop, scrollHeight, clientHeight } = element;
          if (scrollHeight > clientHeight && scrollTop > 0) {
            // Element is scrollable and not at the top, don't start pull-to-refresh
            return;
          }
          element = element.parentElement;
        }

        startY.current = e.touches[0].clientY;
        currentY.current = startY.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only pull down
      if (distance > 0) {
        // Prevent default scrolling behavior when pulling
        if (window.scrollY === 0 && document.documentElement.scrollTop === 0) {
          e.preventDefault();
        }

        // Apply resistance: the further you pull, the harder it gets
        const resistance = 0.5;
        const resistedDistance = Math.min(
          distance * resistance,
          maxPullDistance
        );

        setPullDistance(resistedDistance);
        setIsPulling(true);
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling) {
        startY.current = 0;
        currentY.current = 0;
        return;
      }

      // If pulled beyond threshold, trigger refresh
      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        // Trigger browser refresh
        window.location.reload();
      } else {
        // Reset to initial state
        setPullDistance(0);
        setIsPulling(false);
      }

      startY.current = 0;
      currentY.current = 0;
    };

    // Add event listeners with passive: false to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isPulling, pullDistance, threshold, maxPullDistance]);

  return {
    pullDistance,
    isPulling,
    isRefreshing
  };
}
