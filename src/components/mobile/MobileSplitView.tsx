/**
 * MOB6-3: Mobile Split View
 * Tablet-optimized split view (master/detail) for iPad/large phones in landscape.
 * Automatically collapses to single-pane on small screens.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileSplitViewProps {
  /** Master panel content */
  master: React.ReactNode;
  /** Detail panel content */
  detail: React.ReactNode;
  /** Whether detail is currently shown (for mobile single-pane) */
  showDetail?: boolean;
  /** Handler when detail visibility changes */
  onShowDetailChange?: (show: boolean) => void;
  /** Master panel width ratio (0-1, default 0.35) */
  masterRatio?: number;
  /** Minimum width to show split view (default 900px) */
  splitMinWidth?: number;
  /** Allow resizing the split */
  resizable?: boolean;
  /** Master panel title */
  masterTitle?: string;
  /** Detail panel title */
  detailTitle?: string;
  /** Additional class */
  className?: string;
}

export const MobileSplitView = memo(function MobileSplitView({
  master,
  detail,
  showDetail = false,
  onShowDetailChange,
  masterRatio: initialRatio = 0.35,
  splitMinWidth = 900,
  resizable = true,
  masterTitle,
  detailTitle,
  className,
}: MobileSplitViewProps) {
  const isMobile = useIsMobile();
  const [isSplit, setIsSplit] = useState(false);
  const [masterRatio, setMasterRatio] = useState(initialRatio);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startRatioRef = useRef(0);

  // Check if split view is possible
  useEffect(() => {
    const checkWidth = () => {
      setIsSplit(window.innerWidth >= splitMinWidth);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, [splitMinWidth]);

  // Resizer drag handling
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = (e.clientX - rect.left) / rect.width;
      setMasterRatio(Math.max(0.2, Math.min(0.6, newRatio)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Touch resizer
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startRatioRef.current = masterRatio;
    setIsResizing(true);
  }, [masterRatio]);

  useEffect(() => {
    if (!isResizing) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = (e.touches[0].clientX - rect.left) / rect.width;
      setMasterRatio(Math.max(0.2, Math.min(0.6, newRatio)));
    };

    const handleTouchEnd = () => setIsResizing(false);

    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isResizing]);

  const handleBackToMaster = useCallback(() => {
    onShowDetailChange?.(false);
  }, [onShowDetailChange]);

  // Single-pane mobile mode
  if (!isSplit || isMobile) {
    return (
      <div className={cn("w-full h-full relative", className)}>
        {/* Master panel */}
        <div className={cn(
          "w-full h-full transition-transform duration-300",
          showDetail && "-translate-x-full absolute inset-0"
        )}>
          {masterTitle && (
            <div className="px-4 py-3 border-b bg-background sticky top-0 z-10">
              <h2 className="text-sm font-semibold">{masterTitle}</h2>
            </div>
          )}
          {master}
        </div>

        {/* Detail panel */}
        <div className={cn(
          "w-full h-full transition-transform duration-300",
          !showDetail && "translate-x-full absolute inset-0"
        )}>
          {detailTitle && (
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-background sticky top-0 z-10">
              <button
                onClick={handleBackToMaster}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Zurück"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-semibold">{detailTitle}</h2>
            </div>
          )}
          {detail}
        </div>
      </div>
    );
  }

  // Split view mode
  return (
    <div
      ref={containerRef}
      className={cn("flex w-full h-full relative", className)}
    >
      {/* Master panel */}
      <div
        className={cn(
          "h-full overflow-auto border-r shrink-0",
          isFullscreen && "hidden"
        )}
        style={{ width: isFullscreen ? 0 : `${masterRatio * 100}%` }}
      >
        {masterTitle && (
          <div className="px-4 py-3 border-b bg-background sticky top-0 z-10">
            <h2 className="text-sm font-semibold">{masterTitle}</h2>
          </div>
        )}
        {master}
      </div>

      {/* Resizer handle */}
      {resizable && !isFullscreen && (
        <div
          onMouseDown={() => setIsResizing(true)}
          onTouchStart={handleTouchStart}
          className={cn(
            "w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors",
            "flex items-center justify-center group shrink-0",
            isResizing && "bg-primary/30"
          )}
        >
          <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>
      )}

      {/* Detail panel */}
      <div className={cn(
        "h-full overflow-auto flex-1 min-w-0",
        isFullscreen && "w-full"
      )}>
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background sticky top-0 z-10">
          {detailTitle && (
            <h2 className="text-sm font-semibold">{detailTitle}</h2>
          )}
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label={isFullscreen ? "Split-View" : "Vollbild"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
        {detail}
      </div>
    </div>
  );
});
