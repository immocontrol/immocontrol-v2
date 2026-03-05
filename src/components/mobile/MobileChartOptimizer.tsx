/**
 * MOB4-1: Mobile Chart Optimization
 * Wraps Recharts charts with mobile-friendly features:
 * - Horizontal scroll container for wide charts
 * - Fullscreen mode on tap
 * - Larger touch targets for tooltips
 * - Responsive font sizing
 */
import { useState, useRef, useCallback, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileChartOptimizerProps {
  children: ReactNode;
  /** Minimum width for chart content when scrollable */
  minWidth?: number;
  /** Chart title shown in fullscreen header */
  title?: string;
  /** Additional class names */
  className?: string;
  /** Whether to enable horizontal scroll */
  scrollable?: boolean;
  /** Whether to show fullscreen button */
  allowFullscreen?: boolean;
}

export const MobileChartOptimizer = memo(function MobileChartOptimizer({
  children,
  minWidth = 600,
  title = "Diagramm",
  className,
  scrollable = true,
  allowFullscreen = true,
}: MobileChartOptimizerProps) {
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // On desktop, just render children normally
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors"
            aria-label="Vollbild schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="w-full h-full min-h-[300px]">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Fullscreen toggle button */}
      {allowFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-1 right-1 z-10 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-muted transition-colors"
          aria-label="Vollbild anzeigen"
        >
          <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Scrollable container */}
      {scrollable ? (
        <div
          ref={scrollRef}
          className="overflow-x-auto -mx-2 px-2 scrollbar-thin"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div style={{ minWidth: `${minWidth}px` }}>
            {children}
          </div>
        </div>
      ) : (
        <div className="touch-chart-container">
          {children}
        </div>
      )}

      {/* Scroll indicator */}
      {scrollable && (
        <div className="flex justify-center mt-1">
          <span className="text-[10px] text-muted-foreground/60">
            ← Wischen zum Scrollen →
          </span>
        </div>
      )}
    </div>
  );
});
