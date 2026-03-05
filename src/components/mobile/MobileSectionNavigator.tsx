/**
 * MOB3-2: Mobile Section Navigator
 * Horizontal pill navigation for long pages (PropertyDetail, Settings).
 * Replaces desktop sidebar on mobile. Sticky below header.
 * Safari-safe: uses -webkit-overflow-scrolling for smooth scroll.
 */
import { memo, useRef, useEffect, useCallback, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface SectionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Badge count (e.g. overdue items) */
  badge?: number;
}

interface MobileSectionNavigatorProps {
  sections: SectionItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  className?: string;
}

export const MobileSectionNavigator = memo(function MobileSectionNavigator({
  sections, activeSection, onSectionChange, className,
}: MobileSectionNavigatorProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 8);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    return () => el.removeEventListener("scroll", updateFades);
  }, [updateFades]);

  // Scroll active pill into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector(`[data-section="${activeSection}"]`) as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeSection]);

  if (!isMobile || sections.length === 0) return null;

  return (
    <div className={cn("sticky top-0 z-[100] bg-background/95 backdrop-blur-md border-b border-border", className)}>
      <div className="relative">
        {/* Left fade */}
        {showLeftFade && (
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        )}
        {/* Right fade */}
        {showRightFade && (
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        )}
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
          role="tablist"
          aria-label="Abschnitte"
        >
          {sections.map((section) => (
            <button
              key={section.id}
              data-section={section.id}
              role="tab"
              aria-selected={activeSection === section.id}
              onClick={() => {
                haptic.tap();
                onSectionChange(section.id);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
                "active:scale-95",
                activeSection === section.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/80 text-muted-foreground hover:text-foreground",
              )}
            >
              {section.icon && <span className="h-3.5 w-3.5 flex items-center justify-center">{section.icon}</span>}
              {section.label}
              {section.badge !== undefined && section.badge > 0 && (
                <span className="ml-0.5 px-1.5 py-0 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[16px] text-center">
                  {section.badge > 99 ? "99+" : section.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
