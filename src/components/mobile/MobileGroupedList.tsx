/**
 * MOB5-5: Mobile Grouped List
 * Grouped list with sticky section headers.
 * E.g., contacts by letter, properties by city, documents by type.
 */
import { useMemo, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface GroupedListItem<T = unknown> {
  /** Unique ID */
  id: string;
  /** Data for the item */
  data: T;
}

interface MobileGroupedListProps<T> {
  /** Items to group */
  items: GroupedListItem<T>[];
  /** Function to determine group key for an item */
  groupBy: (item: GroupedListItem<T>) => string;
  /** Optional function to sort groups */
  sortGroups?: (a: string, b: string) => number;
  /** Render function for each item */
  renderItem: (item: GroupedListItem<T>, index: number) => ReactNode;
  /** Render function for group header (defaults to group key) */
  renderGroupHeader?: (groupKey: string, itemCount: number) => ReactNode;
  /** Empty state content */
  emptyState?: ReactNode;
  /** Additional class */
  className?: string;
  /** Item click handler */
  onItemClick?: (item: GroupedListItem<T>) => void;
}

function MobileGroupedListInner<T>({
  items,
  groupBy,
  sortGroups,
  renderItem,
  renderGroupHeader,
  emptyState,
  className,
  onItemClick,
}: MobileGroupedListProps<T>) {
  const isMobile = useIsMobile();

  const groups = useMemo(() => {
    const groupMap = new Map<string, GroupedListItem<T>[]>();
    for (const item of items) {
      const key = groupBy(item);
      const existing = groupMap.get(key) || [];
      existing.push(item);
      groupMap.set(key, existing);
    }

    const entries = Array.from(groupMap.entries());
    if (sortGroups) {
      entries.sort(([a], [b]) => sortGroups(a, b));
    }
    return entries;
  }, [items, groupBy, sortGroups]);

  if (items.length === 0) {
    return (
      <div className={cn("w-full", className)}>
        {emptyState || (
          <p className="text-center text-sm text-muted-foreground py-8">
            Keine Einträge vorhanden
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {groups.map(([groupKey, groupItems]) => (
        <div key={groupKey} className="relative">
          {/* Sticky group header */}
          <div
            className={cn(
              "sticky top-0 z-10 px-3 py-1.5 bg-muted/80 backdrop-blur-sm border-b",
              "text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            )}
          >
            {renderGroupHeader ? (
              renderGroupHeader(groupKey, groupItems.length)
            ) : (
              <div className="flex items-center justify-between">
                <span>{groupKey}</span>
                <span className="text-[10px] font-normal normal-case">
                  {groupItems.length} {groupItems.length === 1 ? "Eintrag" : "Einträge"}
                </span>
              </div>
            )}
          </div>

          {/* Group items */}
          <div className="divide-y">
            {groupItems.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  onItemClick && "cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors",
                  isMobile && onItemClick && "min-h-[44px]"
                )}
                onClick={() => onItemClick?.(item)}
                onKeyDown={(e) => {
                  if (onItemClick && (e.key === "Enter" || e.key === " ")) {
                    onItemClick(item);
                  }
                }}
                role={onItemClick ? "button" : undefined}
                tabIndex={onItemClick ? 0 : undefined}
              >
                {renderItem(item, index)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const MobileGroupedList = memo(MobileGroupedListInner) as typeof MobileGroupedListInner;
