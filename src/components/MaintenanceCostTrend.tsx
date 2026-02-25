import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/formatters";

const MaintenanceCostTrend = () => {
  const { user } = useAuth();

  const { data: tickets = [] } = useQuery({
    queryKey: ["maintenance_cost_trend"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("actual_cost, estimated_cost, created_at, status")
        .in("status", ["resolved", "closed"])
        .order("created_at");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: maintenance = [] } = useQuery({
    queryKey: ["maintenance_items_trend"],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_items")
        .select("estimated_cost, created_at, completed")
        .eq("completed", true);
      return data || [];
    },
    enabled: !!user,
  });

  const trendData = useMemo(() => {
    const months: Record<string, number> = {};
    
    tickets.forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = (months[key] || 0) + Number(t.actual_cost || t.estimated_cost || 0);
    });

    maintenance.forEach(m => {
      const d = new Date(m.created_at || "");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = (months[key] || 0) + Number(m.estimated_cost || 0);
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, value]) => {
        const [y, m] = key.split("-");
        return {
          month: new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
          kosten: value,
        };
      });
  }, [tickets, maintenance]);

  if (trendData.length < 2) return null;

  const total = trendData.reduce((s, d) => s + d.kosten, 0);
  const avg = total / trendData.length;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-1">Wartungskosten-Trend</h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        Ø {formatCurrency(avg)}/Monat · Gesamt: {formatCurrency(total)}
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={trendData}>
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
          />
          <Line type="monotone" dataKey="kosten" stroke="hsl(var(--gold))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MaintenanceCostTrend;
