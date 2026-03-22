/**
 * MOB3-9: Mobile Collapsible Card Sections
 * Collapsible cards for PropertyDetail and Dashboard.
 * Default: only header + key metric visible. Tap expands details.
 * Safari-safe: CSS transitions with will-change for smooth animation.
 */
import { memo, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface MobileCollapsibleCardProps {
  /** Card title */
  title: string;
  /** Icon element */
  icon?: ReactNode;
  /** Key metric shown even when collapsed */
  summary?: ReactNode;
  /** Expanded content */
  children: ReactNode;
  /** Start expanded (default: false on mobile, true on desktop) */
  defaultExpanded?: boolean;
  className?: string;
}

export const MobileCollapsibleCard = memo(function MobileCollapsibleCard({
  title, icon, summary, children, defaultExpanded, className,
}: MobileCollapsibleCardProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(defaultExpanded ?? !isMobile);
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");

  // Measure content height for smooth animation
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) requestAnimationFrame(() => setContentHeight(last.contentRect.height));
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  // On desktop, always expanded
  useEffect(() => {
    if (!isMobile) setExpanded(true);
  }, [isMobile]);

  const toggle = useCallback(() => {
    if (!isMobile) return;
    haptic.tap();
    setExpanded(prev => !prev);
  }, [isMobile, haptic]);

  return (
    <div className={cn("gradient-card rounded-xl border border-border overflow-hidden", className)}>
      {/* Header — always visible */}
      <button
        onClick={toggle}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 text-left",
          isMobile && "active:bg-secondary/50 transition-colors",
        )}
        aria-expanded={expanded}
        aria-controls={`collapsible-${title}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="h-4 w-4 shrink-0 text-primary flex items-center justify-center">{icon}</span>}
          <span className="text-sm font-semibold truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!expanded && summary && (
            <span className="text-xs text-muted-foreground">{summary}</span>
          )}
          {isMobile && (
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-300",
                expanded && "rotate-180",
              )}
            />
          )}
        </div>
      </button>

      {/* Collapsible content */}
      <div
        id={`collapsible-${title}`}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: expanded ? (typeof contentHeight === "number" ? `${contentHeight + 32}px` : "2000px") : "0px",
          opacity: expanded ? 1 : 0,
          /* Safari: GPU compositing for smooth transitions */
          willChange: "max-height, opacity",
        }}
      >
        <div ref={contentRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
});
