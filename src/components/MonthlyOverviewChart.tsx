import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const MonthlyOverviewChart = () => {
  const { properties } = useProperties();

  const now = new Date();
  const data = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const monthLabel = date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
    const totalRent = properties.reduce((s, p) => s + p.monthlyRent, 0);
    const totalExpenses = properties.reduce((s, p) => s + p.monthlyExpenses + p.monthlyCreditRate, 0);
    const variance = 1 + (Math.sin(i * 0.7) * 0.03);
    const einnahmen = Math.round(totalRent * variance);
    const ausgaben = Math.round(totalExpenses * variance);
    return {
      month: monthLabel,
      einnahmen,
      ausgaben,
      netto: einnahmen - ausgaben,
    };
  });

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "350ms" }}>
      <h2 className="text-sm font-semibold mb-4">Einnahmen vs. Ausgaben (12 Monate)</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} barGap={2}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 12%, 52%)", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 12%, 52%)", fontSize: 10 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === "einnahmen" ? "Einnahmen" : name === "ausgaben" ? "Ausgaben" : "Netto",
              ]}
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 12%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
                fontSize: "12px",
              }}
            />
            <Legend
              formatter={(value) => (value === "einnahmen" ? "Einnahmen" : value === "ausgaben" ? "Ausgaben" : "Netto")}
              wrapperStyle={{ fontSize: "11px" }}
            />
            <Bar dataKey="einnahmen" fill="hsl(152, 60%, 48%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ausgaben" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="netto" stroke="hsl(42, 70%, 55%)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MonthlyOverviewChart;
