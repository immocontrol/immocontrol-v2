/**
 * MOB4-6: Mobile Responsive Tables → Card Layout
 * Automatically converts table data to card layout on mobile.
 * No more horizontal scrolling on small screens.
 */
import { useState, useCallback, useMemo, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown, ChevronUp, LayoutList, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CardTableColumn<T> {
  key: string;
  label: string;
  /** Render function for the cell value */
  render?: (row: T) => ReactNode;
  /** Whether this column is shown as card header */
  isTitle?: boolean;
  /** Whether this column is shown as card subtitle */
  isSubtitle?: boolean;
  /** Whether to show as badge in card mode */
  isBadge?: boolean;
  /** CSS class for the cell */
  className?: string;
  /** Sortable */
  sortable?: boolean;
  /** Sort comparison function */
  sortFn?: (a: T, b: T) => number;
}

interface MobileCardTableProps<T> {
  columns: CardTableColumn<T>[];
  data: T[];
  /** Unique key extractor */
  keyExtractor: (row: T) => string;
  /** Called when a row/card is clicked */
  onRowClick?: (row: T) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class */
  className?: string;
  /** Force card mode even on desktop */
  forceCards?: boolean;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export const MobileCardTable = memo(function MobileCardTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "Keine Einträge vorhanden",
  className,
  forceCards = false,
}: MobileCardTableProps<T>) {
  const isMobile = useIsMobile();
  const useCards = isMobile || forceCards;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return data;

    return [...data].sort((a, b) => {
      if (col.sortFn) {
        return sortDir === "asc" ? col.sortFn(a, b) : col.sortFn(b, a);
      }
      const aVal = getNestedValue(a, col.key);
      const bVal = getNestedValue(b, col.key);
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDir, columns]);

  const titleCol = columns.find(c => c.isTitle);
  const subtitleCol = columns.find(c => c.isSubtitle);
  const badgeCols = columns.filter(c => c.isBadge);
  const detailCols = columns.filter(c => !c.isTitle && !c.isSubtitle && !c.isBadge);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  // Card layout for mobile
  if (useCards) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Sort controls */}
        {columns.some(c => c.sortable) && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {columns.filter(c => c.sortable).map(col => (
              <button
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0",
                  sortKey === col.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {col.label}
                {sortKey === col.key && (
                  sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Cards */}
        {sortedData.map((row) => (
          <div
            key={keyExtractor(row)}
            className={cn(
              "rounded-lg border bg-card p-3 space-y-2 transition-colors",
              onRowClick && "active:bg-muted/50 cursor-pointer"
            )}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {titleCol && (
                  <div className="font-semibold text-sm truncate">
                    {titleCol.render ? titleCol.render(row) : String(getNestedValue(row, titleCol.key) ?? "")}
                  </div>
                )}
                {subtitleCol && (
                  <div className="text-xs text-muted-foreground truncate">
                    {subtitleCol.render ? subtitleCol.render(row) : String(getNestedValue(row, subtitleCol.key) ?? "")}
                  </div>
                )}
              </div>
              {badgeCols.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {badgeCols.map(col => (
                    <span key={col.key} className={cn("text-xs", col.className)}>
                      {col.render ? col.render(row) : String(getNestedValue(row, col.key) ?? "")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Detail rows */}
            {detailCols.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {detailCols.map(col => {
                  const val = col.render ? col.render(row) : getNestedValue(row, col.key);
                  if (val === null || val === undefined || val === "") return null;
                  return (
                    <div key={col.key} className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {col.label}
                      </span>
                      <span className={cn("text-xs font-medium", col.className)}>
                        {typeof val === "object" ? val : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Desktop: Regular table
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  "text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                  col.sortable && "cursor-pointer hover:text-foreground",
                  col.className
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                "border-b last:border-b-0 hover:bg-muted/50 transition-colors",
                onRowClick && "cursor-pointer"
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(col => (
                <td key={col.key} className={cn("py-2 px-3", col.className)}>
                  {col.render ? col.render(row) : String(getNestedValue(row, col.key) ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}) as <T extends Record<string, unknown>>(props: MobileCardTableProps<T>) => JSX.Element;
