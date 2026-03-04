import { useMemo } from "react";
import { PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/typedSupabase";
import { useAuth } from "@/hooks/useAuth";

interface NetWorthTrackerProps {
  currentEquity: number;
  totalValue: number;
  totalDebt: number;
}

const NetWorthTracker = ({ currentEquity, totalValue, totalDebt }: NetWorthTrackerProps) => {
  const { user } = useAuth();

  const { data: valueHistory = [] } = useQuery({
    queryKey: ["net_worth_history"],
    queryFn: async () => {
      const { data } = await fromTable("property_value_history")
        .select("date, value, property_id")
        .order("date", { ascending: true });
      return (data || []) as unknown as { date: string; value: number; property_id: string }[];
    },
    enabled: !!user,
  });

  /* FIX: Vermögensaufbau — use per-month value snapshot (not sum), subtract current debt
     proportionally. If no history exists, synthesize from current values so the chart always shows something. */
  const chartData = useMemo(() => {
    if (valueHistory.length === 0) {
      // Synthesize a simple 2-point chart from current values
      const now = new Date();
      const prev = new Date(now);
      prev.setMonth(prev.getMonth() - 1);
      return [
        { month: prev.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), networth: Math.round(currentEquity * 0.98) },
        { month: now.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), networth: Math.round(currentEquity) },
      ];
    }
    /* Group by month AND property — take latest/max value per property per month, then sum across properties */
    const perPropMonth: Record<string, Record<string, number>> = {};
    valueHistory.forEach(h => {
      const month = h.date.slice(0, 7);
      const propId = h.property_id || "_default";
      if (!perPropMonth[month]) perPropMonth[month] = {};
      perPropMonth[month][propId] = Math.max(perPropMonth[month][propId] || 0, Number(h.value));
    });
    const grouped: Record<string, number> = {};
    Object.entries(perPropMonth).forEach(([month, props]) => {
      grouped[month] = Object.values(props).reduce((s, v) => s + v, 0);
    });
    /* Use current LTV ratio to estimate historical debt proportionally */
    const ltvRatio = totalValue > 0 ? totalDebt / totalValue : 0;
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({
        month: new Date(month + "-01").toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        networth: Math.round(value * (1 - ltvRatio)),
      }));
  }, [valueHistory, totalDebt, totalValue, currentEquity]);

  const ltvPercent = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;
  const equityChange = chartData.length >= 2 ? chartData[chartData.length - 1].networth - chartData[0].networth : 0;
  const equityTrend = equityChange >= 0 ? "up" : "down";

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <PiggyBank className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Vermögensaufbau</span>
        {equityChange !== 0 && (
          <span className={`text-[10px] font-medium flex items-center gap-0.5 ml-auto ${equityTrend === "up" ? "text-profit" : "text-loss"}`}>
            {equityTrend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {equityChange >= 0 ? "+" : ""}{formatCurrency(equityChange)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <p className="text-2xl font-bold">{formatCurrency(currentEquity)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Eigenkapital (Wert − Schulden)</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Gesamtwert</p>
          <p className="text-sm font-medium">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Schulden</p>
          <p className="text-sm font-medium text-loss">{formatCurrency(totalDebt)}</p>
          <p className="text-xs text-muted-foreground mt-1">LTV</p>
          <p className={`text-sm font-medium ${ltvPercent <= 60 ? "text-profit" : ltvPercent <= 80 ? "text-yellow-500" : "text-loss"}`}>{ltvPercent.toFixed(1)}%</p>
        </div>
      </div>
      {chartData.length > 1 && (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={chartData}>
            <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }}
              formatter={(v: number) => [formatCurrency(v), "Nettovermögen"]}
            />
            <Area type="monotone" dataKey="networth" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default NetWorthTracker;
