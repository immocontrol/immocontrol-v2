/**
 * IMP20-18: Wartungskosten-12-Monats-Prognose
 * MaintenancePlanner + MaintenanceCostTrend integration.
 * Widget showing forecasted maintenance costs for next 12 months.
 */
import { memo, useMemo } from "react";
import { Wrench, TrendingUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface MonthForecast {
  month: string;
  label: string;
  cost: number;
  items: string[];
}

const WartungskostenPrognose = memo(() => {
  const { user } = useAuth();

  const { data: maintenanceItems = [] } = useQuery({
    queryKey: ["wartung_prognose"],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_items")
        .select("*")
        .order("next_due_date", { ascending: true });
      return (data || []) as Array<{
        id: string;
        title: string;
        estimated_cost: number;
        next_due_date: string;
        interval_months: number;
        status: string;
      }>;
    },
    enabled: !!user,
  });

  const { data: historicalCosts = [] } = useQuery({
    queryKey: ["wartung_history"],
    queryFn: async () => {
      const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("maintenance_items")
        .select("estimated_cost, completed_date")
        .eq("status", "completed")
        .gte("completed_date", oneYearAgo);
      return (data || []) as Array<{ estimated_cost: number; completed_date: string }>;
    },
    enabled: !!user,
  });

  const forecast = useMemo((): MonthForecast[] => {
    const months: MonthForecast[] = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });

      // Find items due in this month
      const dueItems = maintenanceItems.filter(item => {
        if (!item.next_due_date) return false;
        const dueDate = new Date(item.next_due_date);
        return dueDate.getFullYear() === date.getFullYear() && dueDate.getMonth() === date.getMonth();
      });

      // Calculate recurring items that fall in this month (exclude items already in dueItems to avoid double-counting)
      const dueItemIds = new Set(dueItems.map(item => item.id));
      const recurringCost = maintenanceItems
        .filter(item => item.interval_months > 0 && item.next_due_date && !dueItemIds.has(item.id))
        .reduce((sum, item) => {
          const dueDate = new Date(item.next_due_date);
          const monthsDiff = (date.getFullYear() - dueDate.getFullYear()) * 12 + (date.getMonth() - dueDate.getMonth());
          if (monthsDiff >= 0 && monthsDiff % item.interval_months === 0) {
            return sum + (item.estimated_cost || 0);
          }
          return sum;
        }, 0);

      const directCost = dueItems.reduce((s, item) => s + (item.estimated_cost || 0), 0);
      const totalCost = directCost + recurringCost;

      months.push({
        month: monthKey,
        label,
        cost: totalCost,
        items: dueItems.map(item => item.title),
      });
    }

    return months;
  }, [maintenanceItems]);

  const totalForecast = forecast.reduce((s, m) => s + m.cost, 0);
  const avgMonthly = totalForecast / 12;
  const historicalTotal = historicalCosts.reduce((s, c) => s + (c.estimated_cost || 0), 0);
  const maxMonth = Math.max(...forecast.map(m => m.cost), 1);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Wartungskosten-Prognose</h3>
          <Badge variant="outline" className="text-[10px] h-5">12 Monate</Badge>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">
          ~{formatCurrency(avgMonthly)}/Monat
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-1.5 rounded-lg bg-background/50">
          <p className="text-[9px] text-muted-foreground">Prognose 12M</p>
          <p className="text-[10px] font-bold">{formatCurrency(totalForecast)}</p>
        </div>
        <div className="text-center p-1.5 rounded-lg bg-background/50">
          <p className="text-[9px] text-muted-foreground">Historisch 12M</p>
          <p className="text-[10px] font-bold">{formatCurrency(historicalTotal)}</p>
        </div>
        <div className="text-center p-1.5 rounded-lg bg-background/50">
          <p className="text-[9px] text-muted-foreground">Trend</p>
          <p className={`text-[10px] font-bold ${totalForecast > historicalTotal ? "text-loss" : "text-profit"}`}>
            {totalForecast > historicalTotal ? "+" : ""}{historicalTotal > 0 ? Math.round(((totalForecast - historicalTotal) / historicalTotal) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-16">
        {forecast.map((m, i) => (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={`w-full rounded-t transition-all duration-300 ${
                m.cost > avgMonthly * 1.5 ? "bg-loss/60" :
                m.cost > avgMonthly ? "bg-gold/60" :
                "bg-primary/40"
              }`}
              style={{ height: `${maxMonth > 0 ? (m.cost / maxMonth) * 100 : 0}%`, minHeight: m.cost > 0 ? "2px" : "0px" }}
              title={`${m.label}: ${formatCurrency(m.cost)}`}
            />
            <span className="text-[7px] text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Upcoming items */}
      {forecast.filter(m => m.items.length > 0).slice(0, 3).map(m => (
        <div key={m.month} className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Calendar className="h-2.5 w-2.5 shrink-0" />
          <span className="font-medium">{m.label}:</span>
          <span className="truncate">{m.items.join(", ")}</span>
          <span className="ml-auto font-medium shrink-0">{formatCurrency(m.cost)}</span>
        </div>
      ))}
    </div>
  );
});
WartungskostenPrognose.displayName = "WartungskostenPrognose";

export { WartungskostenPrognose };
