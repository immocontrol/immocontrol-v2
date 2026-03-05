/**
 * MOB5-3: Mobile Breadcrumb Navigation
 * Compact breadcrumb with horizontal scroll for deep page hierarchies.
 * Auto-scrolls to show current location. Touch-optimized tap targets.
 */
import { useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Route path */
  href?: string;
  /** Optional icon */
  icon?: React.ReactNode;
}

interface MobileBreadcrumbNavProps {
  /** Breadcrumb items (first = root, last = current page) */
  items: BreadcrumbItem[];
  /** Navigation handler */
  onNavigate?: (item: BreadcrumbItem, index: number) => void;
  /** Show home icon for first item */
  showHomeIcon?: boolean;
  /** Additional class */
  className?: string;
}

export const MobileBreadcrumbNav = memo(function MobileBreadcrumbNav({
  items,
  onNavigate,
  showHomeIcon = true,
  className,
}: MobileBreadcrumbNavProps) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLElement>(null);

  // Auto-scroll to active item
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const active = activeRef.current;
      const scrollLeft = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
    }
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("w-full", className)}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 -mx-1 px-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <ol className="flex items-center gap-1 list-none m-0 p-0">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isFirst = index === 0;

            return (
              <li key={index} className="flex items-center gap-1 shrink-0">
                {index > 0 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                )}

                {isLast ? (
                  <span
                    ref={activeRef as React.RefObject<HTMLSpanElement>}
                    className={cn(
                      "text-xs font-semibold text-foreground px-2 py-1 rounded-md",
                      "bg-primary/10 dark:bg-primary/20",
                      isMobile && "min-h-[32px] flex items-center"
                    )}
                    aria-current="page"
                  >
                    {item.icon || (isFirst && showHomeIcon ? <Home className="w-3.5 h-3.5 mr-1 inline" /> : null)}
                    {item.label}
                  </span>
                ) : (
                  <button
                    onClick={() => onNavigate?.(item, index)}
                    className={cn(
                      "text-xs text-muted-foreground hover:text-foreground transition-colors",
                      "px-2 py-1 rounded-md hover:bg-muted active:bg-muted/80",
                      isMobile && "min-h-[32px] flex items-center"
                    )}
                  >
                    {isFirst && showHomeIcon ? (
                      <Home className="w-3.5 h-3.5" aria-label={item.label} />
                    ) : (
                      <>
                        {item.icon}
                        <span className={cn(item.icon && "ml-1")}>{item.label}</span>
                      </>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
});
