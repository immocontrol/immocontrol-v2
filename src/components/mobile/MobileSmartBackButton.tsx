/**
 * MOB6-1: Mobile Smart Back Button
 * Context-aware back button with breadcrumb preview and edge-swipe gesture (iOS-style).
 * Shows where the user will navigate to, supports swipe-from-edge gesture.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavigationHistoryItem {
  /** Route path */
  path: string;
  /** Display label */
  label: string;
  /** Icon name (optional) */
  icon?: React.ReactNode;
}

interface MobileSmartBackButtonProps {
  /** Navigation history stack */
  history: NavigationHistoryItem[];
  /** Navigate handler */
  onNavigate: (path: string) => void;
  /** Go back handler */
  onBack?: () => void;
  /** Enable edge swipe gesture */
  enableEdgeSwipe?: boolean;
  /** Edge swipe zone width in px */
  edgeSwipeWidth?: number;
  /** Show breadcrumb preview on long press */
  showPreview?: boolean;
  /** Additional class */
  className?: string;
}

export const MobileSmartBackButton = memo(function MobileSmartBackButton({
  history,
  onNavigate,
  onBack,
  enableEdgeSwipe = true,
  edgeSwipeWidth = 20,
  showPreview = true,
  className,
}: MobileSmartBackButtonProps) {
  const isMobile = useIsMobile();
  const [showBreadcrumb, setShowBreadcrumb] = useState(false);
  const [edgeSwipeProgress, setEdgeSwipeProgress] = useState(0);
  const [isEdgeSwiping, setIsEdgeSwiping] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const previousPage = history.length > 1 ? history[history.length - 2] : null;

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (previousPage) {
      onNavigate(previousPage.path);
    }
  }, [onBack, previousPage, onNavigate]);

  // Long press to show breadcrumb preview
  const handlePointerDown = useCallback(() => {
    if (!showPreview || history.length < 2) return;
    longPressTimerRef.current = setTimeout(() => {
      setShowBreadcrumb(true);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 500);
  }, [showPreview, history.length]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup long press timer
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Edge swipe gesture
  useEffect(() => {
    if (!enableEdgeSwipe || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      if (touchX <= edgeSwipeWidth) {
        startXRef.current = touchX;
        startYRef.current = touchY;
        setIsEdgeSwiping(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwiping) return;
      const deltaX = e.touches[0].clientX - startXRef.current;
      const deltaY = Math.abs(e.touches[0].clientY - startYRef.current);
      
      // Cancel if vertical movement is dominant
      if (deltaY > deltaX) {
        setIsEdgeSwiping(false);
        setEdgeSwipeProgress(0);
        return;
      }

      const progress = Math.min(1, Math.max(0, deltaX / 200));
      setEdgeSwipeProgress(progress);
    };

    const handleTouchEnd = () => {
      if (isEdgeSwiping && edgeSwipeProgress > 0.5) {
        handleBack();
      }
      setIsEdgeSwiping(false);
      setEdgeSwipeProgress(0);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enableEdgeSwipe, isMobile, isEdgeSwiping, edgeSwipeProgress, edgeSwipeWidth, handleBack]);

  if (!previousPage && history.length < 2) return null;

  return (
    <>
      {/* Back button */}
      <div className={cn("flex items-center", className)}>
        <button
          onClick={handleBack}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-lg",
            "hover:bg-muted active:bg-muted/80 transition-all",
            "text-sm font-medium text-primary",
            isMobile && "min-h-[44px] -ml-2"
          )}
          aria-label={`Zurück zu ${previousPage?.label || "vorherige Seite"}`}
        >
          <ArrowLeft className="w-4 h-4" />
          {previousPage && (
            <span className="truncate max-w-[120px]">{previousPage.label}</span>
          )}
        </button>
      </div>

      {/* Breadcrumb preview overlay */}
      {showBreadcrumb && history.length > 1 && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/20"
            onClick={() => setShowBreadcrumb(false)}
          />
          <div className={cn(
            "fixed left-3 top-16 z-50 rounded-xl border bg-background shadow-2xl overflow-hidden",
            "animate-in fade-in slide-in-from-left-2 duration-200",
            "max-w-[280px]"
          )}>
            {history.map((item, index) => (
              <button
                key={item.path}
                onClick={() => {
                  onNavigate(item.path);
                  setShowBreadcrumb(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-left",
                  "hover:bg-muted active:bg-muted/80 transition-colors",
                  "border-b last:border-0",
                  index === history.length - 1 && "bg-primary/5 font-medium",
                  isMobile && "min-h-[44px]"
                )}
              >
                {item.icon || <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <span className="text-xs truncate">{item.label}</span>
                {index === history.length - 1 && (
                  <span className="ml-auto text-[10px] text-primary">Aktuell</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Edge swipe indicator */}
      {isEdgeSwiping && edgeSwipeProgress > 0 && (
        <div
          className="fixed left-0 top-0 bottom-0 z-50 pointer-events-none"
          style={{ width: `${edgeSwipeProgress * 100}px` }}
        >
          <div className={cn(
            "absolute inset-y-0 left-0 w-1 bg-primary rounded-r-full",
            "transition-opacity",
            edgeSwipeProgress > 0.5 ? "opacity-100" : "opacity-50"
          )} />
          <div className="absolute top-1/2 -translate-y-1/2 left-2 flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center",
              "transition-transform",
              edgeSwipeProgress > 0.5 && "scale-110"
            )}>
              <ArrowLeft className={cn(
                "w-4 h-4 text-primary transition-opacity",
                edgeSwipeProgress > 0.5 ? "opacity-100" : "opacity-50"
              )} />
            </div>
          </div>
        </div>
      )}
    </>
  );
});
