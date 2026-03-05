/**
 * MOB2-8: Mobile Cashflow-Timeline
 * Vertical timeline view of cash flow events on mobile.
 * Touch-zoom to expand/collapse months. Color-coded income/expense.
 */
import { memo, useState, useCallback, useMemo } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface CashflowEvent {
  id: string;
  date: string;
  label: string;
  amount: number;
  /** "income" or "expense" */
  type: "income" | "expense";
  category?: string;
  property?: string;
}

interface MobileCashflowTimelineProps {
  events: CashflowEvent[];
  className?: string;
}

interface MonthGroup {
  key: string;
  label: string;
  events: CashflowEvent[];
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export const MobileCashflowTimeline = memo(function MobileCashflowTimeline({
  events, className,
}: MobileCashflowTimelineProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const monthGroups = useMemo((): MonthGroup[] => {
    const grouped = new Map<string, CashflowEvent[]>();
    const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const event of sorted) {
      const d = new Date(event.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(event);
    }

    return Array.from(grouped.entries()).map(([key, evts]) => {
      const [year, month] = key.split("-");
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      const totalIncome = evts.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const totalExpense = evts.filter(e => e.type === "expense").reduce((s, e) => s + Math.abs(e.amount), 0);
      return {
        key,
        label: `${monthNames[parseInt(month) - 1]} ${year}`,
        events: evts,
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
      };
    });
  }, [events]);

  const toggleMonth = useCallback((key: string) => {
    haptic.tap();
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [haptic]);

  if (!isMobile) {
    return null; // Desktop uses the regular CashForecast view
  }

  if (events.length === 0) {
    return (
      <div className={cn("text-center py-8 text-sm text-muted-foreground", className)}>
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Keine Cashflow-Daten vorhanden
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {monthGroups.map((group) => {
        const isExpanded = expandedMonths.has(group.key);
        return (
          <div key={group.key} className="border border-border rounded-xl overflow-hidden">
            {/* Month header */}
            <button
              onClick={() => toggleMonth(group.key)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/30 active:bg-secondary/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{group.label}</span>
                <span className="text-[10px] text-muted-foreground">{group.events.length} Einträge</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  group.net >= 0 ? "text-profit" : "text-loss",
                )}>
                  {group.net >= 0 ? "+" : ""}{formatCurrency(group.net)}
                </span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {/* Summary bar */}
            <div className="flex h-1.5">
              <div
                className="bg-profit/60 transition-all"
                style={{ width: `${(group.totalIncome / (group.totalIncome + group.totalExpense || 1)) * 100}%` }}
              />
              <div
                className="bg-loss/60 transition-all"
                style={{ width: `${(group.totalExpense / (group.totalIncome + group.totalExpense || 1)) * 100}%` }}
              />
            </div>

            {/* Expanded events */}
            {isExpanded && (
              <div className="divide-y divide-border">
                {group.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 px-3 py-2">
                    <div className={cn(
                      "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      event.type === "income" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
                    )}>
                      {event.type === "income"
                        ? <TrendingUp className="h-3.5 w-3.5" />
                        : <TrendingDown className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.label}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{new Date(event.date).toLocaleDateString("de-DE")}</span>
                        {event.property && <span>• {event.property}</span>}
                      </div>
                    </div>
                    <span className={cn(
                      "text-sm font-semibold tabular-nums shrink-0",
                      event.type === "income" ? "text-profit" : "text-loss",
                    )}>
                      {event.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(event.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
