/**
 * MOB4-20: Mobile Quick Property Switcher
 * Horizontal scroll bar with property thumbnails at top of PropertyDetail.
 * Quick switching between properties without going back to dashboard.
 */
import { useRef, useCallback, useEffect, memo, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProperties } from "@/context/PropertyContext";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";
import { formatCurrency } from "@/lib/formatters";

interface MobileQuickPropertySwitcherProps {
  /** Currently selected property ID */
  currentPropertyId?: string;
  /** Additional class */
  className?: string;
  /** Max properties to show (default: all) */
  maxVisible?: number;
  /** Show property value */
  showValue?: boolean;
  /** Compact mode (smaller cards) */
  compact?: boolean;
}

export const MobileQuickPropertySwitcher = memo(function MobileQuickPropertySwitcher({
  currentPropertyId,
  className,
  maxVisible,
  showValue = false,
  compact = false,
}: MobileQuickPropertySwitcherProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { properties } = useProperties();
  const haptic = useHaptic();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { id: paramId } = useParams();

  const activeId = currentPropertyId ?? paramId;

  const visibleProperties = useMemo(() => {
    const sorted = [...properties].sort((a, b) => a.name.localeCompare(b.name));
    return maxVisible ? sorted.slice(0, maxVisible) : sorted;
  }, [properties, maxVisible]);

  // Auto-scroll to active property
  useEffect(() => {
    if (!scrollRef.current || !activeId) return;
    const activeEl = scrollRef.current.querySelector(`[data-property-id="${activeId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeId]);

  const handleSelect = useCallback((propertyId: string) => {
    if (propertyId === activeId) return;
    haptic.tap();
    navigate(`/immobilien/${propertyId}`);
  }, [activeId, haptic, navigate]);

  const scrollBy = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -200 : 200;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  if (visibleProperties.length <= 1) return null;

  // Find current index for next/prev navigation
  const currentIndex = visibleProperties.findIndex(p => p.id === activeId);

  return (
    <div className={cn("relative", className)}>
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none px-1 py-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {visibleProperties.map((property) => {
          const isActive = property.id === activeId;

          return (
            <button
              key={property.id}
              data-property-id={property.id}
              onClick={() => handleSelect(property.id)}
              className={cn(
                "shrink-0 rounded-lg border transition-all",
                "flex items-center gap-2",
                compact ? "px-2.5 py-1.5" : "px-3 py-2",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border hover:bg-muted active:bg-muted/80"
              )}
            >
              {/* Property icon / image placeholder */}
              <div className={cn(
                "rounded-md flex items-center justify-center shrink-0",
                compact ? "w-7 h-7" : "w-9 h-9",
                isActive ? "bg-primary-foreground/20" : "bg-muted"
              )}>
                <Building2 className={cn(
                  compact ? "w-3.5 h-3.5" : "w-4 h-4",
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                )} />
              </div>

              {/* Property info */}
              <div className="min-w-0 text-left">
                <p className={cn(
                  "font-medium truncate max-w-[120px]",
                  compact ? "text-[11px]" : "text-xs"
                )}>
                  {property.name}
                </p>
                {showValue && !compact && (
                  <p className={cn(
                    "text-[10px] truncate",
                    isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {formatCurrency(property.purchasePrice)}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop: Navigation arrows */}
      {!isMobile && visibleProperties.length > 4 && (
        <>
          <button
            onClick={() => scrollBy("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-7 h-7 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Links scrollen"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollBy("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-7 h-7 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Rechts scrollen"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Mobile: Quick prev/next buttons */}
      {isMobile && currentIndex >= 0 && (
        <div className="flex justify-between px-1 mt-1">
          <button
            onClick={() => {
              if (currentIndex > 0) handleSelect(visibleProperties[currentIndex - 1].id);
            }}
            disabled={currentIndex <= 0}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            <span>Vorherige</span>
          </button>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {currentIndex + 1} / {visibleProperties.length}
          </span>
          <button
            onClick={() => {
              if (currentIndex < visibleProperties.length - 1) handleSelect(visibleProperties[currentIndex + 1].id);
            }}
            disabled={currentIndex >= visibleProperties.length - 1}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <span>Nächste</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
});
