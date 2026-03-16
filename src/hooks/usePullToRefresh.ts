/**
 * #11: Pull-to-Refresh for Mobile
 * Touch-based pull-to-refresh; content follows finger (iOS-style pull-down).
 */
import { useRef, useEffect, useCallback } from "react";

const MAX_PULL_PX = 120;
const PULL_RESISTANCE = 0.5;

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
  /** Ref to the scroll container (e.g. main). Used to check scrollTop and to apply translateY so content moves with finger. */
  contentRef?: React.RefObject<HTMLElement | null>;
}

export function usePullToRefresh({ onRefresh, threshold = 80, disabled = false, contentRef }: PullToRefreshOptions) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const getScrollTop = useCallback(() => {
    if (contentRef?.current) return contentRef.current.scrollTop;
    return window.scrollY;
  }, [contentRef]);

  const setContentTransform = useCallback((yPx: number) => {
    if (contentRef?.current) {
      contentRef.current.style.transform = yPx > 0 ? `translateY(${yPx}px)` : "";
      contentRef.current.style.transition = yPx === 0 ? "transform 0.2s ease-out" : "none";
    }
  }, [contentRef]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    if (getScrollTop() > 0) return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [disabled, getScrollTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || disabled) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff < 0) {
      pulling.current = false;
      setContentTransform(0);
      return;
    }
    const distance = Math.min(diff * PULL_RESISTANCE, MAX_PULL_PX);
    setContentTransform(distance);
    if (distance > 10 && indicatorRef.current) {
      const progress = Math.min(diff / threshold, 1);
      indicatorRef.current.style.transform = `translateX(-50%) translateY(${Math.min(distance, threshold * 0.6)}px)`;
      indicatorRef.current.style.opacity = String(progress);
    }
  }, [threshold, disabled, setContentTransform]);

  const handleTouchEnd = useCallback(async (e: TouchEvent) => {
    if (!pulling.current || disabled) return;
    const endY = e.changedTouches[0].clientY;
    const diff = endY - startY.current;
    pulling.current = false;

    setContentTransform(0);
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = "translateX(-50%) translateY(0)";
      indicatorRef.current.style.opacity = "0";
    }

    if (diff >= threshold) {
      await onRefresh();
    }
  }, [onRefresh, threshold, disabled, setContentTransform]);

  useEffect(() => {
    if (disabled) return;
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      setContentTransform(0);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled, setContentTransform]);

  return { indicatorRef };
}
