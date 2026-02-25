import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { Droplets } from "lucide-react";

const WasserfallChart = () => {
  const { properties, stats } = useProperties();

  const data = useMemo(() => {
    if (properties.length === 0) return [];
    const totalExpenses = properties.reduce((s, p) => s + p.monthlyExpenses, 0);
    const totalCreditRate = properties.reduce((s, p) => s + p.monthlyCreditRate, 0);

    return [
      { name: "Mieteinnahmen", value: stats.totalRent, total: stats.totalRent, type: "income" },
      { name: "Bewirtschaftung", value: -totalExpenses, total: stats.totalRent - totalExpenses, type: "expense" },
      { name: "Kreditraten", value: -totalCreditRate, total: stats.totalRent - totalExpenses - totalCreditRate, type: "expense" },
      { name: "Cashflow", value: stats.totalCashflow, total: stats.totalCashflow, type: "result" },
    ];
  }, [properties, stats]);

  if (data.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Droplets className="h-4 w-4 text-muted-foreground" /> Cashflow-Wasserfall
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
              formatter={(v: number) => [formatCurrency(Math.abs(v)), v >= 0 ? "Zufluss" : "Abfluss"]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.type === "income" ? "hsl(var(--profit))" : entry.type === "expense" ? "hsl(var(--loss))" : entry.value >= 0 ? "hsl(var(--primary))" : "hsl(var(--loss))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WasserfallChart;
