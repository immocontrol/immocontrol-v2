/**
 * #11: Pull-to-Refresh for Mobile
 * Touch-based pull-to-refresh; content follows finger (iOS-style pull-down).
 * Only triggers when user is at the very top and then pulls down — not when scrolling up from below.
 */
import { useRef, useEffect, useCallback, useState } from "react";

const MAX_PULL_PX = 120;
const SNAP_DURATION_MS = 280;
const SNAP_EASING = "cubic-bezier(0.33, 1, 0.68, 1)"; // smooth ease-out, slight overshoot feel
/** Min downward movement (px) before we treat the gesture as pull — avoids trigger when scrolling up (finger moves up). */
const PULL_START_THRESHOLD_PX = 26;
/** Indicator only visible after this pull distance — avoids brief flash when scrolling up past top. */
const INDICATOR_VISIBLE_AFTER_PX = 32;

/** Rubber-band: more movement at start, then resistance toward max (smooth curve) */
function pullDistance(diff: number): number {
  if (diff <= 0) return 0;
  const t = diff / MAX_PULL_PX;
  const eased = 1 - Math.exp(-t * 1.8);
  return Math.min(MAX_PULL_PX * eased, MAX_PULL_PX);
}

export interface PullToRefreshIndicatorState {
  opacity: number;
  translateY: number;
  /** 0–1 ring fill */
  progress: number;
  /** Threshold reached — show checkmark, user can release */
  ready: boolean;
  /** Refresh in progress — show spinner */
  refreshing: boolean;
}

const IDLE_INDICATOR: PullToRefreshIndicatorState = {
  opacity: 0,
  translateY: -40,
  progress: 0,
  ready: false,
  refreshing: false,
};

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
  /** True once user has actually pulled down past PULL_START_THRESHOLD_PX; avoids starting pull when scrolling up. */
  const pullStarted = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const refreshingRef = useRef(false);

  const [indicator, setIndicator] = useState<PullToRefreshIndicatorState>(IDLE_INDICATOR);

  const getScrollTop = useCallback(() => {
    if (contentRef?.current) return contentRef.current.scrollTop;
    return window.scrollY;
  }, [contentRef]);

  const setContentTransform = useCallback((yPx: number, withTransition: boolean) => {
    if (contentRef?.current) {
      contentRef.current.style.transform = yPx > 0 ? `translateY(${yPx}px)` : "";
      contentRef.current.style.transition = withTransition
        ? `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`
        : "none";
    }
  }, [contentRef]);

  /** Touch started at scroll top; we only treat as pull once user moves finger down past PULL_START_THRESHOLD_PX. */
  const atTopTouch = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshingRef.current) return;
    const scrollTop = getScrollTop();
    if (scrollTop > 0) return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    startY.current = e.touches[0].clientY;
    pulling.current = false;
    pullStarted.current = false;
    atTopTouch.current = true;
  }, [disabled, getScrollTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || refreshingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (atTopTouch.current && !pullStarted.current) {
      if (diff >= PULL_START_THRESHOLD_PX) {
        pullStarted.current = true;
        pulling.current = true;
      } else if (diff < -5) {
        atTopTouch.current = false;
      }
    }

    if (!pulling.current) return;
    if (diff < 0) {
      pulling.current = false;
      pullStarted.current = false;
      atTopTouch.current = false;
      setContentTransform(0, true);
      setIndicator(IDLE_INDICATOR);
      return;
    }
    const distance = pullDistance(diff);
    setContentTransform(distance, false);
    const progress = Math.min(diff / threshold, 1);
    const opacity = distance >= INDICATOR_VISIBLE_AFTER_PX ? progress : 0;
    const translateY = Math.min(distance * 0.6, threshold * 0.6);
    const ready = diff >= threshold;
    setIndicator({
      opacity,
      translateY,
      progress,
      ready,
      refreshing: false,
    });
  }, [threshold, disabled, setContentTransform]);

  const resetPullGesture = useCallback(() => {
    pulling.current = false;
    pullStarted.current = false;
    atTopTouch.current = false;
    setContentTransform(0, true);
    setIndicator(IDLE_INDICATOR);
  }, [setContentTransform]);

  const handleTouchEnd = useCallback(
    async (e: TouchEvent) => {
      const wasPulling = pulling.current;
      pulling.current = false;
      pullStarted.current = false;
      atTopTouch.current = false;

      if (!wasPulling || disabled || refreshingRef.current) return;
      const endY = e.changedTouches[0].clientY;
      const diff = endY - startY.current;

      setContentTransform(0, true);

      if (diff >= threshold) {
        refreshingRef.current = true;
        setIndicator({
          opacity: 1,
          translateY: 8,
          progress: 1,
          ready: false,
          refreshing: true,
        });
        try {
          await onRefresh();
        } finally {
          refreshingRef.current = false;
          setIndicator(IDLE_INDICATOR);
        }
      } else {
        setIndicator(IDLE_INDICATOR);
      }
    },
    [onRefresh, threshold, disabled, setContentTransform],
  );

  /** System cancelled gesture (call, gesture conflict) — same as abort without refresh */
  const handleTouchCancel = useCallback(() => {
    if (!pulling.current || refreshingRef.current) return;
    resetPullGesture();
  }, [resetPullGesture]);

  useEffect(() => {
    if (disabled) return;
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
      setContentTransform(0, false);
      refreshingRef.current = false;
      setIndicator(IDLE_INDICATOR);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, disabled, setContentTransform]);

  return { indicatorRef, indicator };
}
