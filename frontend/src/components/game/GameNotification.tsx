/**
 * @module components/game/GameNotification
 * @description Animated notification component for game events
 */

import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';

export function GameNotification() {
  const notification = useGameStore((state) => state.currentNotification);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isVisibleRef = useRef(false);
  const isExitingRef = useRef(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      setIsExiting(false);
      isVisibleRef.current = true;
      isExitingRef.current = false;

      // Start exit animation after 2 seconds
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
        isExitingRef.current = true;
      }, 2000);

      // Remove notification after exit animation completes (smooth fade - 0.5s animation)
      const clearTimer = setTimeout(() => {
        setIsVisible(false);
        isVisibleRef.current = false;
      }, 3000); // 2000ms delay + 500ms exit animation + 500ms buffer

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(clearTimer);
      };
    } else {
      // When notification is cleared externally, smoothly fade out if still visible
      if (isVisibleRef.current && !isExitingRef.current) {
        setIsExiting(true);
        isExitingRef.current = true;
        const clearTimer = setTimeout(() => {
          setIsVisible(false);
          isVisibleRef.current = false;
        }, 500); // Match exit animation duration
        return () => clearTimeout(clearTimer);
      } else {
        // Already fading or not visible, just reset
        setIsVisible(false);
        setIsExiting(false);
        isVisibleRef.current = false;
        isExitingRef.current = false;
      }
    }
  }, [notification]);

  if (!notification || !isVisible) {
    return null;
  }

  const typeStyles = {
    success: 'text-emerald-200 drop-shadow-[0_0_8px_rgba(0,0,0,0.9),0_0_16px_rgba(16,185,129,0.9),0_0_24px_rgba(16,185,129,0.6)]',
    warning: 'text-rose-300 drop-shadow-[0_0_8px_rgba(0,0,0,0.9),0_0_16px_rgba(244,63,94,0.9),0_0_24px_rgba(244,63,94,0.6)]',
    info: 'text-emerald-200 drop-shadow-[0_0_8px_rgba(0,0,0,0.9),0_0_16px_rgba(59,130,246,0.8),0_0_24px_rgba(59,130,246,0.5)]',
    special: 'text-amber-200 drop-shadow-[0_0_8px_rgba(0,0,0,0.9),0_0_16px_rgba(251,191,36,0.9),0_0_24px_rgba(251,191,36,0.6)]',
  };

  const animationClass = isExiting ? 'animate-notification-exit' : 'animate-notification-enter';

  return (
    <div
      className="pointer-events-none absolute left-1/2 bottom-[240px] md:bottom-[280px] z-[100] w-full max-w-[90vw] -translate-x-1/2 px-4"
      style={{ isolation: 'isolate' }}
    >
      <p
        className={`
          text-center text-2xl font-bold uppercase tracking-[0.1em] leading-tight
          md:text-3xl md:tracking-[0.15em]
          lg:text-4xl lg:tracking-[0.2em]
          ${typeStyles[notification.type]}
          ${animationClass}
          [text-shadow:_0_0_4px_rgba(0,0,0,1),0_0_8px_rgba(0,0,0,0.8)]
        `}
      >
        {notification.message}
      </p>
    </div>
  );
}

