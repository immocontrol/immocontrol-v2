/**
 * #11: Pull-to-Refresh for Mobile
 * Touch-based pull-to-refresh gesture that triggers a callback.
 */
import { useRef, useEffect, useCallback } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

export function usePullToRefresh({ onRefresh, threshold = 80, disabled = false }: PullToRefreshOptions) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    // Only activate when scrolled to top
    if (window.scrollY > 0) return;
    /* FIX: Don't trigger pull-to-refresh when an input is focused — prevents
       accidental refresh that steals focus on mobile */
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || disabled) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff < 0) { pulling.current = false; return; }
    if (diff > 10 && indicatorRef.current) {
      const progress = Math.min(diff / threshold, 1);
      indicatorRef.current.style.transform = `translateX(-50%) translateY(${Math.min(diff * 0.5, threshold * 0.6)}px)`;
      indicatorRef.current.style.opacity = String(progress);
    }
  }, [threshold, disabled]);

  const handleTouchEnd = useCallback(async (e: TouchEvent) => {
    if (!pulling.current || disabled) return;
    pulling.current = false;
    const endY = e.changedTouches[0].clientY;
    const diff = endY - startY.current;

    if (indicatorRef.current) {
      indicatorRef.current.style.transform = "translateX(-50%) translateY(0)";
      indicatorRef.current.style.opacity = "0";
    }

    if (diff >= threshold) {
      await onRefresh();
    }
  }, [onRefresh, threshold, disabled]);

  useEffect(() => {
    if (disabled) return;
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  return { indicatorRef };
}
