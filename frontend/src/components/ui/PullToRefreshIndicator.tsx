import { RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
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

  /**
   * The threshold distance to trigger a refresh
   */
  threshold?: number;
}

/**
 * Visual indicator for pull-to-refresh functionality
 * Shows a spinner that animates as the user pulls down
 */
export function PullToRefreshIndicator({
  pullDistance,
  isPulling,
  isRefreshing,
  threshold = 80
}: PullToRefreshIndicatorProps) {
  // Calculate opacity and scale based on pull distance
  const progress = Math.min(pullDistance / threshold, 1);
  const opacity = progress * 0.9 + 0.1; // From 0.1 to 1
  const scale = progress * 0.5 + 0.5; // From 0.5 to 1

  // Rotation based on pull distance (more pull = more rotation)
  const rotation = progress * 360;

  if (!isPulling && !isRefreshing) {
    return null;
  }

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        top: `max(${pullDistance}px, env(safe-area-inset-top, 0px))`,
        transition: isPulling ? 'none' : 'top 0.3s ease-out, opacity 0.3s ease-out',
        opacity: isPulling || isRefreshing ? opacity : 0
      }}
    >
      <div
        className="flex items-center justify-center rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 shadow-lg"
        style={{
          width: '40px',
          height: '40px',
          transform: `scale(${scale})`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        <RefreshCw
          className="text-emerald-300"
          style={{
            width: '20px',
            height: '20px',
            transform: `rotate(${isRefreshing ? 0 : rotation}deg)`,
            transition: isRefreshing ? 'none' : 'transform 0.1s linear',
            animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
          }}
        />
      </div>
    </div>
  );
}
