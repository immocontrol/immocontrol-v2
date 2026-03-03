/**
 * #12: Swipe gestures for Mobile
 * Provides swipe-to-action functionality for list items.
 */
import { useRef, useCallback } from "react";

interface SwipeActionOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipeAction({ onSwipeLeft, onSwipeRight, threshold = 80 }: SwipeActionOptions = {}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current || !elementRef.current) return;
    const diffX = e.touches[0].clientX - startX.current;
    const diffY = e.touches[0].clientY - startY.current;

    // If vertical scroll is dominant, cancel swipe
    if (Math.abs(diffY) > Math.abs(diffX)) {
      swiping.current = false;
      elementRef.current.style.transform = "";
      return;
    }

    // Clamp swipe distance
    const clampedX = Math.max(-threshold * 1.2, Math.min(threshold * 1.2, diffX));
    elementRef.current.style.transform = `translateX(${clampedX}px)`;
    elementRef.current.style.transition = "none";
  }, [threshold]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current || !elementRef.current) return;
    swiping.current = false;

    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX.current;

    elementRef.current.style.transition = "transform 0.2s ease-out";
    elementRef.current.style.transform = "";

    if (diff < -threshold && onSwipeLeft) {
      onSwipeLeft();
    } else if (diff > threshold && onSwipeRight) {
      onSwipeRight();
    }
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return {
    ref: elementRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
