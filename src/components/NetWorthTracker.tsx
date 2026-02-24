import { useMemo } from "react";
import { PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      const { data } = await supabase
        .from("property_value_history" as any)
        .select("date, value")
        .order("date", { ascending: true });
      return (data || []) as unknown as { date: string; value: number }[];
    },
    enabled: !!user,
  });

  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    valueHistory.forEach(h => {
      const month = h.date.slice(0, 7);
      grouped[month] = (grouped[month] || 0) + Number(h.value);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({
        month: new Date(month + "-01").toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        networth: Math.round(value - totalDebt),
      }));
  }, [valueHistory, totalDebt]);

  const ltvPercent = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <PiggyBank className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Nettovermögen</span>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <p className="text-2xl font-bold">{formatCurrency(currentEquity)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Immobilien-Eigenkapital</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Gesamtwert</p>
          <p className="text-sm font-medium">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Schulden</p>
          <p className="text-sm font-medium text-loss">{formatCurrency(totalDebt)}</p>
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
