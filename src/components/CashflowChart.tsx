import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const CashflowChart = () => {
  const { properties } = useProperties();
  const data = properties.map((p) => ({
    name: p.name.split(" ")[1] || p.name.substring(0, 10),
    miete: p.monthlyRent,
    kosten: -(p.monthlyExpenses + p.monthlyCreditRate),
    cashflow: p.monthlyCashflow,
  }));

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <h2 className="text-sm font-semibold mb-4">Cashflow je Objekt (monatlich)</h2>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} barGap={2}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 12%, 52%)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 12%, 52%)", fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(Math.abs(value)),
                name === "miete" ? "Miete" : name === "kosten" ? "Kosten" : "Cashflow",
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
              formatter={(value) => (value === "miete" ? "Miete" : value === "kosten" ? "Kosten" : "Cashflow")}
              wrapperStyle={{ fontSize: "11px" }}
            />
            <ReferenceLine y={0} stroke="hsl(220, 14%, 22%)" />
            <Bar dataKey="miete" fill="hsl(152, 60%, 48%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="kosten" fill="hsl(0, 72%, 55%)" radius={[0, 0, 4, 4]} />
            <Line type="monotone" dataKey="cashflow" stroke="hsl(42, 70%, 55%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(42, 70%, 55%)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CashflowChart;
