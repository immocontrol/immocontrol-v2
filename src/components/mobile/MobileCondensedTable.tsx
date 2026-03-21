/**
 * MOB3-11: Mobile Condensed Table View
 * Compact card view instead of tables on mobile for Dokumente, Mieten, Nebenkosten.
 * Shows only 2-3 key fields with expand option.
 * Safari-safe: uses CSS grid with proper touch targets.
 */
import { memo, useState, useCallback, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface TableField {
  key: string;
  label: string;
  /** Priority: 1 = always shown, 2 = shown when expanded */
  priority: 1 | 2;
}

export interface TableRow {
  id: string;
  fields: Record<string, ReactNode>;
  /** Optional status badge */
  status?: { label: string; color: string };
  /** Optional action buttons */
  actions?: ReactNode;
}

interface MobileCondensedTableProps {
  fields: TableField[];
  rows: TableRow[];
  /** Empty state message */
  emptyMessage?: string;
  className?: string;
}

const CondensedRow = memo(function CondensedRow({
  row, fields, priorityFields, expandFields,
}: {
  row: TableRow;
  fields: TableField[];
  priorityFields: TableField[];
  expandFields: TableField[];
}) {
  const haptic = useHaptic();
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    haptic.tap();
    setExpanded(prev => !prev);
  }, [haptic]);

  return (
    <div className="gradient-card overflow-hidden">
      <button
        onClick={toggle}
        className="flex items-start justify-between w-full p-3 text-left active:bg-secondary/50 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1">
          {priorityFields.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground shrink-0 w-16">{field.label}</span>
              <span className="text-xs font-medium truncate">{row.fields[field.key]}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {row.status && (
            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", row.status.color)}>
              {row.status.label}
            </span>
          )}
          {expandFields.length > 0 && (
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )} />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && expandFields.length > 0 && (
        <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-1 animate-fade-in">
          {expandFields.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground shrink-0 w-16">{field.label}</span>
              <span className="text-xs">{row.fields[field.key]}</span>
            </div>
          ))}
          {row.actions && (
            <div className="flex items-center gap-2 pt-1.5">
              {row.actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const MobileCondensedTable = memo(function MobileCondensedTable({
  fields, rows, emptyMessage = "Keine Einträge", className,
}: MobileCondensedTableProps) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const priorityFields = fields.filter(f => f.priority === 1);
  const expandFields = fields.filter(f => f.priority === 2);

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)} role="list" aria-label="Tabelle">
      {rows.map((row) => (
        <CondensedRow
          key={row.id}
          row={row}
          fields={fields}
          priorityFields={priorityFields}
          expandFields={expandFields}
        />
      ))}
    </div>
  );
});
