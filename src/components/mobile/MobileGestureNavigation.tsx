/**
 * MOB4-11: Mobile Gesture Navigation
 * Swipe from left edge = back navigation.
 * Natural iOS/Android-like gesture pattern.
 */
import { useRef, useCallback, useEffect, memo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileGestureNavigationProps {
  children: ReactNode;
  /** Enable back swipe from left edge */
  enableBackSwipe?: boolean;
  /** Swipe threshold in pixels */
  swipeThreshold?: number;
  /** Edge zone width in pixels */
  edgeZone?: number;
  /** Additional class */
  className?: string;
  /** Custom back action */
  onBack?: () => void;
}

export const MobileGestureNavigation = memo(function MobileGestureNavigation({
  children,
  enableBackSwipe = true,
  swipeThreshold = 80,
  edgeZone = 30,
  className,
  onBack,
}: MobileGestureNavigationProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const touchState = useRef<{
    startX: number;
    startY: number;
    isEdgeSwipe: boolean;
    currentX: number;
  }>({
    startX: 0,
    startY: 0,
    isEdgeSwipe: false,
    currentX: 0,
  });

  const indicatorRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enableBackSwipe) return;
    const touch = e.touches[0];
    const isFromLeftEdge = touch.clientX < edgeZone;

    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      isEdgeSwipe: isFromLeftEdge,
      currentX: touch.clientX,
    };
  }, [enableBackSwipe, edgeZone]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchState.current.isEdgeSwipe) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchState.current.startX;
    const dy = Math.abs(touch.clientY - touchState.current.startY);

    // Cancel if vertical movement is dominant
    if (dy > Math.abs(dx) * 1.5) {
      touchState.current.isEdgeSwipe = false;
      if (indicatorRef.current) {
        indicatorRef.current.style.opacity = "0";
        indicatorRef.current.style.width = "0px";
      }
      return;
    }

    touchState.current.currentX = touch.clientX;

    // Show visual indicator
    if (dx > 0 && indicatorRef.current) {
      const progress = Math.min(dx / swipeThreshold, 1);
      indicatorRef.current.style.opacity = String(progress * 0.6);
      indicatorRef.current.style.width = `${Math.min(dx * 0.3, 40)}px`;
    }
  }, [swipeThreshold]);

  const handleTouchEnd = useCallback(() => {
    if (!touchState.current.isEdgeSwipe) return;

    const dx = touchState.current.currentX - touchState.current.startX;

    // Reset indicator
    if (indicatorRef.current) {
      indicatorRef.current.style.opacity = "0";
      indicatorRef.current.style.width = "0px";
    }

    // Trigger back navigation if threshold met
    if (dx > swipeThreshold) {
      if (onBack) {
        onBack();
      } else {
        navigate(-1);
      }
    }

    touchState.current.isEdgeSwipe = false;
  }, [swipeThreshold, onBack, navigate]);

  useEffect(() => {
    if (!isMobile || !enableBackSwipe) return;

    const opts: AddEventListenerOptions = { passive: true };
    document.addEventListener("touchstart", handleTouchStart, opts);
    document.addEventListener("touchmove", handleTouchMove, opts);
    document.addEventListener("touchend", handleTouchEnd, opts);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, enableBackSwipe, handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Edge swipe indicator */}
      {enableBackSwipe && (
        <div
          ref={indicatorRef}
          className="fixed left-0 top-0 bottom-0 z-50 bg-primary/20 rounded-r-full pointer-events-none transition-[width] duration-75"
          style={{ opacity: 0, width: 0 }}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
});
