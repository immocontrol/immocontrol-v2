/**
 * MOB2-9: Pull-to-Refresh auf allen Seiten
 * Wrapper component that adds pull-to-refresh to any page.
 * Integrates with React Query's invalidateQueries for data refetch.
 */
import { memo, useRef, useState, useCallback, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface MobilePagePullToRefreshProps {
  /** Called when user pulls to refresh — should return a Promise */
  onRefresh: () => Promise<void>;
  /** Page content */
  children: React.ReactNode;
  /** Whether to disable pull-to-refresh */
  disabled?: boolean;
  className?: string;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export const MobilePagePullToRefresh = memo(function MobilePagePullToRefresh({
  onRefresh, children, disabled = false, className,
}: MobilePagePullToRefreshProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const hapticFired = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshing) return;
    // Only start if scrolled to top
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop > 5) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    hapticFired.current = false;
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || disabled || refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff < 0) { pulling.current = false; setPullDistance(0); return; }
    const distance = Math.min(diff * 0.5, MAX_PULL);
    setPullDistance(distance);
    if (distance >= PULL_THRESHOLD && !hapticFired.current) {
      haptic.tap();
      hapticFired.current = true;
    } else if (distance < PULL_THRESHOLD) {
      hapticFired.current = false;
    }
  }, [disabled, refreshing, haptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    hapticFired.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      haptic.medium();
      try { await onRefresh(); }
      catch { /* ignore */ }
      finally {
        setRefreshing(false);
        setPullDistance(0);
        haptic.success();
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, haptic, onRefresh]);

  useEffect(() => {
    if (!isMobile) return;
    const el = containerRef.current ?? document;
    el.addEventListener("touchstart", handleTouchStart as EventListener, { passive: true });
    el.addEventListener("touchmove", handleTouchMove as EventListener, { passive: true });
    el.addEventListener("touchend", handleTouchEnd as EventListener, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart as EventListener);
      el.removeEventListener("touchmove", handleTouchMove as EventListener);
      el.removeEventListener("touchend", handleTouchEnd as EventListener);
    };
  }, [isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (!isMobile) return <>{children}</>;

  const isReady = pullDistance >= PULL_THRESHOLD;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="absolute left-0 right-0 top-0 flex items-center justify-center z-10 transition-transform"
          style={{ height: `${refreshing ? 48 : pullDistance}px` }}
        >
          <div className={cn(
            "w-8 h-8 rounded-full bg-background border border-border shadow-sm flex items-center justify-center transition-all",
            isReady && "bg-primary text-primary-foreground border-primary",
            refreshing && "bg-primary text-primary-foreground animate-spin",
          )}>
            <RefreshCw className={cn("h-4 w-4", isReady && "rotate-180 transition-transform")} />
          </div>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        style={{ transform: pullDistance > 0 || refreshing ? `translateY(${refreshing ? 48 : pullDistance}px)` : undefined }}
        className={cn(!pulling.current && "transition-transform duration-200")}
      >
        {children}
      </div>
    </div>
  );
});
