import { useEffect, useRef, useState, useCallback } from 'react';

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
 * Supports both touch (mobile) and mouse (desktop) interactions
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
  const isPullingRef = useRef<boolean>(false);
  const pullDistanceRef = useRef<number>(0);

  const isAtTop = useCallback(() => {
    return window.scrollY === 0 && document.documentElement.scrollTop === 0;
  }, []);

  const checkScrollableParent = useCallback((target: HTMLElement): boolean => {
    // For the game screen with overflow-hidden, we're more permissive
    // Only block if we find a scrollable element that's currently scrolled down
    let element: HTMLElement | null = target;
    while (element && element !== document.body) {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const isScrollable = scrollHeight > clientHeight;
      const isScrolledDown = scrollTop > 5; // Small threshold to account for rounding

      console.log('[PullToRefresh] Checking element:', {
        tag: element.tagName,
        className: element.className,
        scrollTop,
        scrollHeight,
        clientHeight,
        isScrollable,
        isScrolledDown
      });

      if (isScrollable && isScrolledDown) {
        // Element is scrollable and not at the top
        console.log('[PullToRefresh] Blocked by scrolled element');
        return false;
      }
      element = element.parentElement;
    }
    return true;
  }, []);

  const handleStart = useCallback((clientY: number, target: HTMLElement) => {
    if (!enabled) return;

    console.log('[PullToRefresh] Start:', {
      clientY,
      isAtTop: isAtTop(),
      scrollableParent: checkScrollableParent(target),
      windowScrollY: window.scrollY,
      docScrollTop: document.documentElement.scrollTop
    });

    if (isAtTop() && checkScrollableParent(target)) {
      console.log('[PullToRefresh] Starting pull');
      startY.current = clientY;
      isPullingRef.current = true;
    }
  }, [enabled, isAtTop, checkScrollableParent]);

  const handleMove = useCallback((clientY: number, shouldPreventDefault: () => boolean) => {
    if (!isPullingRef.current || startY.current === 0) return;

    const distance = clientY - startY.current;

    console.log('[PullToRefresh] Move:', { distance, clientY, startY: startY.current });

    // Only handle pull down
    if (distance > 0) {
      if (shouldPreventDefault()) {
        // We'll prevent default in the actual event handler
      }

      // Apply resistance
      const resistance = 0.5;
      const resistedDistance = Math.min(
        distance * resistance,
        maxPullDistance
      );

      pullDistanceRef.current = resistedDistance;
      setPullDistance(resistedDistance);
      setIsPulling(true);
      console.log('[PullToRefresh] Pulling:', resistedDistance);
    }
  }, [maxPullDistance]);

  const handleEnd = useCallback(() => {
    if (!isPullingRef.current) {
      startY.current = 0;
      return;
    }

    // If pulled beyond threshold, trigger refresh
    if (pullDistanceRef.current >= threshold) {
      setIsRefreshing(true);
      // Small delay for visual feedback
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } else {
      // Reset to initial state
      setPullDistance(0);
      setIsPulling(false);
    }

    startY.current = 0;
    isPullingRef.current = false;
  }, [threshold]);

  useEffect(() => {
    if (!enabled) return;

    console.log('[PullToRefresh] Hook initialized and event listeners being added');

    // Touch event handlers
    const handleTouchStart = (e: TouchEvent) => {
      console.log('[PullToRefresh] TouchStart event received');
      handleStart(e.touches[0].clientY, e.target as HTMLElement);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current) return;

      handleMove(e.touches[0].clientY, () => isAtTop());

      const distance = e.touches[0].clientY - startY.current;
      if (distance > 0 && isAtTop()) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    // Mouse event handlers (for desktop testing)
    const handleMouseDown = (e: MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      handleStart(e.clientY, e.target as HTMLElement);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPullingRef.current) return;

      handleMove(e.clientY, () => isAtTop());

      const distance = e.clientY - startY.current;
      if (distance > 0 && isAtTop()) {
        e.preventDefault();
      }
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    // Also handle mouse leaving the window
    document.addEventListener('mouseleave', handleMouseUp);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);

      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [enabled, handleStart, handleMove, handleEnd, isAtTop]);

  return {
    pullDistance,
    isPulling,
    isRefreshing
  };
}
