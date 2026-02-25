import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/formatters";

const RentCollectionChart = () => {
  const { user } = useAuth();

  const { data: payments = [] } = useQuery({
    queryKey: ["rent_collection_chart"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_payments").select("amount, status, due_date").order("due_date");
      return data || [];
    },
    enabled: !!user,
  });

  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; soll: number; ist: number }> = {};
    payments.forEach(p => {
      const d = new Date(p.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
      if (!months[key]) months[key] = { month: label, soll: 0, ist: 0 };
      months[key].soll += Number(p.amount);
      if (p.status === "confirmed") months[key].ist += Number(p.amount);
    });
    return Object.values(months).slice(-12);
  }, [payments]);

  if (monthlyData.length < 2) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-1">Mieteingangsquote</h3>
      <p className="text-[10px] text-muted-foreground mb-4">Soll vs. Ist pro Monat (letzte 12 Monate)</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={monthlyData} barGap={2}>
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
            formatter={(v: number) => formatCurrency(v)}
          />
          <Bar dataKey="soll" name="Soll" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} opacity={0.3} />
          <Bar dataKey="ist" name="Eingegangen" radius={[3, 3, 0, 0]}>
            {monthlyData.map((entry, i) => (
              <Cell key={i} fill={entry.ist >= entry.soll * 0.9 ? "hsl(var(--profit))" : entry.ist >= entry.soll * 0.7 ? "hsl(var(--gold))" : "hsl(var(--loss))"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RentCollectionChart;
