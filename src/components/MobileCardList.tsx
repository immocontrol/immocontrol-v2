/**
 * UX-2: Tables → Card Layout on Mobile
 * Renders data as responsive cards on mobile, table rows on desktop.
 * OPT: Single stable click handler to avoid per-item function creation.
 */
import { useCallback } from "react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => React.ReactNode;
  /** If true, only show on desktop table view */
  desktopOnly?: boolean;
  /** If true, use as card title */
  isTitle?: boolean;
  /** If true, use as card subtitle */
  isSubtitle?: boolean;
}

interface MobileCardListProps<T> {
  items: T[];
  columns: Column<T>[];
  keyFn: (item: T) => string;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  className?: string;
}

export function MobileCardList<T>({
  items, columns, keyFn, onRowClick, actions, className,
}: MobileCardListProps<T>) {
  const isMobile = useIsMobile();

  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!onRowClick) return;
      const idx = e.currentTarget.getAttribute("data-item-idx");
      if (idx != null) {
        const i = Number(idx);
        if (i >= 0 && i < items.length) onRowClick(items[i]);
      }
    },
    [onRowClick, items]
  );

  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!onRowClick || e.key !== "Enter") return;
      e.preventDefault();
      const idx = e.currentTarget.getAttribute("data-item-idx");
      if (idx != null) {
        const i = Number(idx);
        if (i >= 0 && i < items.length) onRowClick(items[i]);
      }
    },
    [onRowClick, items]
  );

  if (isMobile) {
    return (
      <div className={cn("space-y-2", className)}>
        {items.map((item, idx) => {
          const titleCol = columns.find(c => c.isTitle);
          const subtitleCol = columns.find(c => c.isSubtitle);
          const detailCols = columns.filter(c => !c.isTitle && !c.isSubtitle && !c.desktopOnly);

          return (
            <div
              key={keyFn(item)}
              data-item-idx={idx}
              className="gradient-card rounded-xl border border-border p-3.5 space-y-2 hover-lift cursor-pointer"
              onClick={handleItemClick}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={handleItemKeyDown}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {titleCol && (
                    <p className="font-semibold text-sm truncate">{titleCol.render(item)}</p>
                  )}
                  {subtitleCol && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitleCol.render(item)}</p>
                  )}
                </div>
                {actions && <div className="flex items-center gap-1 shrink-0">{actions(item)}</div>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {detailCols.map((col) => (
                  <span key={col.key} className="flex items-center gap-1">
                    <span className="text-muted-foreground/60">{col.label}:</span>
                    <span className="font-medium text-foreground">{col.render(item)}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* Desktop: regular table */
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.filter(c => !c.isSubtitle).map(col => (
              <th key={col.key} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">
                {col.label}
              </th>
            ))}
            {actions && <th className="py-2 px-3 w-24" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={keyFn(item)}
              data-item-idx={idx}
              className="border-b border-border/50 table-row-hover cursor-pointer transition-colors"
              onClick={handleItemClick}
            >
              {columns.filter(c => !c.isSubtitle).map(col => (
                <td key={col.key} className="py-2.5 px-3">{col.render(item)}</td>
              ))}
              {actions && <td className="py-2.5 px-3">{actions(item)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
