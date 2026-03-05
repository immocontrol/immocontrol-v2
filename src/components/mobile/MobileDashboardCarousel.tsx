/**
 * MOB2-7: Swipeable Dashboard-Widgets Integration
 * Wraps dashboard widget sections into a swipeable carousel on mobile.
 * Each section becomes a full-width card with snap scrolling.
 */
import { memo, useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface CarouselSection {
  id: string;
  title: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface MobileDashboardCarouselProps {
  sections: CarouselSection[];
  className?: string;
}

export const MobileDashboardCarousel = memo(function MobileDashboardCarousel({
  sections, className,
}: MobileDashboardCarouselProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;
    // Find the child whose offsetLeft is closest to the current scrollLeft
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < children.length; i++) {
      const dist = Math.abs(children[i].offsetLeft - el.offsetLeft - el.scrollLeft);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    }
    setActiveIndex(Math.max(0, Math.min(closestIdx, sections.length - 1)));
  }, [sections.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollTo = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const clamped = Math.max(0, Math.min(index, sections.length - 1));
    haptic.tap();
    const children = scrollRef.current.children;
    if (children[clamped]) {
      (children[clamped] as HTMLElement).scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
    setActiveIndex(clamped);
  }, [sections.length, haptic]);

  if (!isMobile || sections.length === 0) {
    return <>{sections.map(s => <div key={s.id}>{s.content}</div>)}</>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Section tabs */}
      <div className="flex items-center gap-1 overflow-x-auto px-1 scrollbar-hide">
        <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />
        {sections.map((section, idx) => (
          <button
            key={section.id}
            onClick={() => scrollTo(idx)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95",
              idx === activeIndex
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground",
            )}
          >
            {section.title}
          </button>
        ))}
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 gap-4"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {sections.map((section) => (
          <div
            key={section.id}
            className="snap-center shrink-0 w-[calc(100vw-2rem)] min-w-[calc(100vw-2rem)]"
          >
            {section.content}
          </div>
        ))}
      </div>

      {/* Navigation arrows + dots */}
      {sections.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => scrollTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="p-1 rounded-full text-muted-foreground disabled:opacity-30"
            aria-label="Vorherige Sektion"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1">
            {sections.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-full transition-all duration-200",
                  idx === activeIndex ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <button
            onClick={() => scrollTo(activeIndex + 1)}
            disabled={activeIndex >= sections.length - 1}
            className="p-1 rounded-full text-muted-foreground disabled:opacity-30"
            aria-label="Nächste Sektion"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
});
