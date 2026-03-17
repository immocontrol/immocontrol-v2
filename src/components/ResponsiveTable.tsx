/**
 * FUND-18: Responsive tables to mobile cards — renders a table on desktop
 * and a stacked card layout on mobile. No external dependencies.
 * OPT: Single stable click handler per list to avoid per-row function creation and re-renders.
 */
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface TableColumn<T> {
  key: string;
  header: string;
  /** Render function for custom cell content */
  render?: (row: T, index: number) => React.ReactNode;
  /** If true, this column is the primary label shown as card title on mobile */
  primary?: boolean;
  /** CSS class for the column */
  className?: string;
  /** Hide on mobile cards (still shown in table) */
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  /** Unique key extractor */
  getRowKey: (row: T, index: number) => string | number;
  /** Click handler for a row/card */
  onRowClick?: (row: T) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class for the container */
  className?: string;
  /** Breakpoint for switching to cards (default: 768px) */
  breakpoint?: number;
}

/**
 * FUND-18: Responsive table component.
 */
export function ResponsiveTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  onRowClick,
  emptyMessage = "Keine Einträge vorhanden",
  className,
  breakpoint,
}: ResponsiveTableProps<T>) {
  const isMobile = useMediaQuery(`(max-width: ${breakpoint ?? 768}px)`);

  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!onRowClick) return;
      const idx = e.currentTarget.getAttribute("data-row-idx");
      if (idx != null) {
        const i = Number(idx);
        if (i >= 0 && i < data.length) onRowClick(data[i]);
      }
    },
    [onRowClick, data]
  );

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!onRowClick || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      const idx = e.currentTarget.getAttribute("data-row-idx");
      if (idx != null) {
        const i = Number(idx);
        if (i >= 0 && i < data.length) onRowClick(data[i]);
      }
    },
    [onRowClick, data]
  );

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  /* ── Mobile: Card layout ── */
  if (isMobile) {
    const primaryCol = columns.find((c) => c.primary) ?? columns[0];
    const otherCols = columns.filter((c) => c !== primaryCol && !c.hideOnMobile);

    return (
      <div className={cn("space-y-3", className)}>
        {data.map((row, idx) => {
          const key = getRowKey(row, idx);
          const primaryValue = primaryCol.render
            ? primaryCol.render(row, idx)
            : String(row[primaryCol.key] ?? "");

          return (
            <div
              key={key}
              data-row-idx={idx}
              className={cn(
                "rounded-lg border bg-card p-4 space-y-2",
                onRowClick && "cursor-pointer hover:bg-accent/50 active:scale-[0.99] transition-all",
              )}
              onClick={handleRowClick}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={handleRowKeyDown}
            >
              {/* Primary field as card title */}
              <div className="font-medium text-sm">{primaryValue}</div>

              {/* Other fields as label: value pairs */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {otherCols.map((col) => {
                  const value = col.render
                    ? col.render(row, idx)
                    : String(row[col.key] ?? "—");
                  return (
                    <div key={col.key} className="contents">
                      <span className="text-xs text-muted-foreground truncate">{col.header}</span>
                      <span className="text-xs text-right">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ── Desktop: Standard table ── */
  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn("px-4 py-3 text-left font-medium text-muted-foreground", col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={getRowKey(row, idx)}
              data-row-idx={idx}
              className={cn(
                "border-b last:border-0 transition-colors",
                onRowClick && "cursor-pointer hover:bg-accent/50",
              )}
              onClick={handleRowClick}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={handleRowKeyDown}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3", col.className)}>
                  {col.render ? col.render(row, idx) : String(row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
