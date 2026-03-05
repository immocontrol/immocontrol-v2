/**
 * MOB3-10: Mobile KPI Comparison Slider
 * Two-finger swipe on KPI cards shows previous month comparison.
 * Animated transition between current and previous values.
 * Safari-safe: CSS transitions with transform for GPU acceleration.
 */
import { memo, useState, useCallback, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface KPIPeriod {
  label: string; // e.g. "März 2026"
  value: string; // formatted value
  rawValue: number;
}

interface MobileKPIComparisonProps {
  title: string;
  icon?: React.ReactNode;
  current: KPIPeriod;
  previous: KPIPeriod;
  /** Format difference (default: absolute) */
  formatDiff?: (current: number, previous: number) => string;
  className?: string;
}

export const MobileKPIComparison = memo(function MobileKPIComparison({
  title, icon, current, previous, formatDiff, className,
}: MobileKPIComparisonProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [showPrevious, setShowPrevious] = useState(false);
  const touchStartX = useRef(0);

  const diff = current.rawValue - previous.rawValue;
  const diffPercent = previous.rawValue !== 0
    ? ((diff / Math.abs(previous.rawValue)) * 100)
    : 0;

  const diffDisplay = formatDiff
    ? formatDiff(current.rawValue, previous.rawValue)
    : `${diff >= 0 ? "+" : ""}${diffPercent.toFixed(1)}%`;

  const toggle = useCallback(() => {
    haptic.tap();
    setShowPrevious(prev => !prev);
  }, [haptic]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 40) {
        toggle();
      }
    }
  }, [toggle]);

  const displayed = showPrevious ? previous : current;
  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendColor = diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "gradient-card rounded-xl border border-border p-3 relative overflow-hidden",
        isMobile && "active:scale-[0.98] transition-transform cursor-pointer",
        className,
      )}
      onClick={isMobile ? toggle : undefined}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      role="button"
      aria-label={`${title}: ${showPrevious ? "Vormonat" : "Aktuell"}`}
    >
      {/* Period indicator */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
          {icon && <span className="h-3 w-3 flex items-center justify-center">{icon}</span>}
          {title}
        </div>
        {isMobile && (
          <div className="flex items-center gap-0.5">
            <ChevronLeft className={cn("h-3 w-3 transition-opacity", showPrevious ? "opacity-30" : "opacity-100 text-primary")} />
            <span className="text-[9px] text-muted-foreground">{displayed.label}</span>
            <ChevronRight className={cn("h-3 w-3 transition-opacity", showPrevious ? "opacity-100 text-primary" : "opacity-30")} />
          </div>
        )}
      </div>

      {/* Value with slide animation */}
      <div className="relative h-8 overflow-hidden">
        <div
          className="absolute inset-0 flex items-center transition-transform duration-300 ease-out"
          style={{
            transform: showPrevious ? "translateX(-100%)" : "translateX(0)",
            /* Safari GPU */
            willChange: "transform",
          }}
        >
          <span className="text-lg font-bold whitespace-nowrap">{current.value}</span>
        </div>
        <div
          className="absolute inset-0 flex items-center transition-transform duration-300 ease-out"
          style={{
            transform: showPrevious ? "translateX(0)" : "translateX(100%)",
            willChange: "transform",
          }}
        >
          <span className="text-lg font-bold whitespace-nowrap text-muted-foreground">{previous.value}</span>
        </div>
      </div>

      {/* Trend indicator */}
      <div className={cn("flex items-center gap-1 text-[11px] font-medium", trendColor)}>
        <TrendIcon className="h-3 w-3" />
        {diffDisplay}
        <span className="text-muted-foreground font-normal ml-1">
          vs. {showPrevious ? current.label : previous.label}
        </span>
      </div>

      {/* Swipe hint on mobile */}
      {isMobile && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          <div className={cn("w-1 h-1 rounded-full transition-colors", !showPrevious ? "bg-primary" : "bg-border")} />
          <div className={cn("w-1 h-1 rounded-full transition-colors", showPrevious ? "bg-primary" : "bg-border")} />
        </div>
      )}
    </div>
  );
});
