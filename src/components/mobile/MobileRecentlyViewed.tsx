/**
 * MOB5-2: Mobile Recently Viewed
 * Horizontal strip showing last 5 recently viewed items (properties, contacts, documents).
 * Persisted in localStorage for cross-session access.
 */
import { useState, useEffect, useCallback, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Clock, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecentItem {
  /** Unique ID */
  id: string;
  /** Display title */
  title: string;
  /** Subtitle (e.g., address, type) */
  subtitle?: string;
  /** Item type for icon/color */
  type: "property" | "contact" | "document" | "deal" | "other";
  /** Route to navigate to */
  href?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Timestamp when viewed */
  viewedAt: number;
}

const STORAGE_KEY = "immo-recently-viewed";
const MAX_ITEMS = 8;

function loadRecent(): RecentItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveRecent(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

const typeColors: Record<RecentItem["type"], string> = {
  property: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  contact: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  document: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  deal: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  other: "bg-muted text-muted-foreground",
};

const typeLabels: Record<RecentItem["type"], string> = {
  property: "Immobilie",
  contact: "Kontakt",
  document: "Dokument",
  deal: "Deal",
  other: "Sonstiges",
};

/**
 * Hook for managing recently viewed items.
 */
export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(loadRecent);

  const addItem = useCallback((item: Omit<RecentItem, "viewedAt">) => {
    setItems(prev => {
      const filtered = prev.filter(i => i.id !== item.id);
      const updated = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      saveRecent(updated);
      return updated;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const updated = prev.filter(i => i.id !== id);
      saveRecent(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    saveRecent([]);
  }, []);

  return { items, addItem, removeItem, clearAll };
}

interface MobileRecentlyViewedProps {
  /** Recently viewed items */
  items: RecentItem[];
  /** Remove handler */
  onRemove?: (id: string) => void;
  /** Item tap handler */
  onItemTap?: (item: RecentItem) => void;
  /** Clear all handler */
  onClearAll?: () => void;
  /** Additional class */
  className?: string;
}

export const MobileRecentlyViewed = memo(function MobileRecentlyViewed({
  items,
  onRemove,
  onItemTap,
  onClearAll,
  className,
}: MobileRecentlyViewedProps) {
  const isMobile = useIsMobile();

  if (items.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Zuletzt angesehen</span>
        </div>
        {onClearAll && items.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Alle löschen
          </button>
        )}
      </div>

      {/* Horizontal scrollable strip */}
      <div
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onItemTap?.(item)}
            className={cn(
              "flex-shrink-0 rounded-lg border bg-card p-2.5 transition-colors",
              "hover:bg-muted/50 active:bg-muted",
              isMobile ? "w-[140px]" : "w-[160px]",
              "min-h-[44px] relative group"
            )}
          >
            {/* Remove button */}
            {onRemove && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onRemove(item.id);
                  }
                }}
                className={cn(
                  "absolute top-1 right-1 p-0.5 rounded-full bg-background/80 border",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  isMobile && "opacity-100"
                )}
                aria-label={`${item.title} entfernen`}
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </span>
            )}

            {/* Type badge */}
            <span className={cn(
              "inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-1.5",
              typeColors[item.type]
            )}>
              {typeLabels[item.type]}
            </span>

            {/* Title */}
            <p className="text-xs font-medium truncate text-left">{item.title}</p>
            {item.subtitle && (
              <p className="text-[10px] text-muted-foreground truncate text-left mt-0.5">
                {item.subtitle}
              </p>
            )}
          </button>
        ))}

        {/* "See all" indicator */}
        {items.length >= MAX_ITEMS && (
          <div className="flex-shrink-0 flex items-center px-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
});
