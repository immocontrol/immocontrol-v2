import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MietTrendChart = () => {
  const { user } = useAuth();

  const { data: payments = [] } = useQuery({
    queryKey: ["miet_trend_payments"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_payments").select("amount, due_date, status").order("due_date");
      return data || [];
    },
    enabled: !!user,
  });

  const trendData = useMemo(() => {
    const months: Record<string, { soll: number; ist: number }> = {};
    payments.forEach(p => {
      const key = p.due_date.slice(0, 7); // YYYY-MM
      if (!months[key]) months[key] = { soll: 0, ist: 0 };
      months[key].soll += Number(p.amount);
      if (p.status === "confirmed") months[key].ist += Number(p.amount);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, val]) => ({
        monat: new Date(key + "-01").toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        soll: val.soll,
        ist: val.ist,
        quote: val.soll > 0 ? (val.ist / val.soll * 100) : 0,
      }));
  }, [payments]);

  if (trendData.length < 2) return null;

  /* IMP-34-6: Guard against division by zero — early return above ensures length >= 2, but guard defensively */
  const avgQuote = trendData.length > 0
    ? trendData.reduce((s, d) => s + d.quote, 0) / trendData.length
    : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" /> Mieteinnahmen-Trend
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${avgQuote >= 95 ? "bg-profit/15 text-profit" : avgQuote >= 80 ? "bg-gold/15 text-gold" : "bg-loss/15 text-loss"}`}>
          Ø {avgQuote.toFixed(0)}% Eingangsquote
        </span>
      </div>
      {/* IMP-34-15: ARIA label for screen readers on trend chart */}
      <div className="h-44" role="img" aria-label={`Mieteinnahmen-Trend: ${trendData.length} Monate, Ø ${avgQuote.toFixed(0)}% Eingangsquote`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="sollGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="istGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--profit))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="monat" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
              formatter={(v: number, name: string) => [formatCurrency(v), name === "soll" ? "Soll" : "Ist"]}
            />
            <Area type="monotone" dataKey="soll" stroke="hsl(var(--muted-foreground))" fill="url(#sollGrad)" strokeWidth={1.5} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="ist" stroke="hsl(var(--profit))" fill="url(#istGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MietTrendChart;
