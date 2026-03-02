import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const COLORS = [
  "hsl(152, 60%, 48%)",
  "hsl(42, 70%, 55%)",
  "hsl(200, 60%, 50%)",
  "hsl(280, 50%, 55%)",
  "hsl(340, 55%, 55%)",
];

const PortfolioChart = () => {
  const { properties } = useProperties();
  const totalValue = properties.reduce((s, p) => s + p.currentValue, 0);
  const data = properties.map((p) => ({
    name: p.name,
    value: p.currentValue,
    percent: totalValue > 0 ? ((p.currentValue / totalValue) * 100).toFixed(1) : "0",
  }));

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:250ms]" role="region" aria-label="Portfolioverteilung">
      <h2 className="text-sm font-semibold mb-4">Portfolioverteilung nach Wert</h2>
      <div className="flex items-center gap-6">
        <div className="w-40 h-40 flex-shrink-0">
          /* IMP-108: min-height prevents layout shift */ <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 12%)",
                  border: "1px solid hsl(220, 14%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground truncate flex-1">{entry.name}</span>
              <span className="text-muted-foreground">{entry.percent}%</span>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortfolioChart;
