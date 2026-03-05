/**
 * MOB-4: Mobile Widget Carousel
 * Horizontal snap-scroll carousel for dashboard widgets on mobile.
 * Users swipe through widgets like Instagram Stories instead of endless scrolling.
 */
import { memo, useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileWidgetCarouselProps {
  children: React.ReactNode[];
  /** Labels for the dot indicator */
  labels?: string[];
  className?: string;
}

export const MobileWidgetCarousel = memo(function MobileWidgetCarousel({
  children, labels, className,
}: MobileWidgetCarouselProps) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const totalItems = children.length;

  // Track scroll position to update active index
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const index = Math.round(scrollLeft / clientWidth);
    setActiveIndex(Math.max(0, Math.min(index, totalItems - 1)));
  }, [totalItems]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollTo = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const clamped = Math.max(0, Math.min(index, totalItems - 1));
    scrollRef.current.scrollTo({
      left: clamped * scrollRef.current.clientWidth,
      behavior: "smooth",
    });
    setActiveIndex(clamped);
  }, [totalItems]);

  if (!isMobile) {
    // Desktop: render children normally
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Current widget label */}
      {labels && labels[activeIndex] && (
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-semibold text-foreground">{labels[activeIndex]}</span>
          <span className="text-[10px] text-muted-foreground">{activeIndex + 1} / {totalItems}</span>
        </div>
      )}

      {/* Scrollable carousel */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 gap-3"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {children.map((child, idx) => (
          <div
            key={idx}
            className="snap-center shrink-0 w-[calc(100vw-2rem)] min-w-[calc(100vw-2rem)]"
          >
            {child}
          </div>
        ))}
      </div>

      {/* Dot indicator */}
      {totalItems > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {/* Left arrow */}
          <button
            onClick={() => scrollTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30 transition-opacity"
            aria-label="Vorheriges Widget"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalItems, 10) }).map((_, idx) => {
              // For many items, show subset of dots around active
              let dotIdx = idx;
              if (totalItems > 10) {
                const start = Math.max(0, Math.min(activeIndex - 4, totalItems - 10));
                dotIdx = start + idx;
              }
              return (
                <button
                  key={dotIdx}
                  onClick={() => scrollTo(dotIdx)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    dotIdx === activeIndex
                      ? "w-5 h-1.5 bg-primary"
                      : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                  aria-label={`Widget ${dotIdx + 1}`}
                />
              );
            })}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scrollTo(activeIndex + 1)}
            disabled={activeIndex >= totalItems - 1}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30 transition-opacity"
            aria-label="Nächstes Widget"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
});
