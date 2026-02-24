import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Property {
  type: string;
  currentValue: number;
  monthlyRent: number;
}

interface PortfolioTypeChartProps {
  properties: Property[];
}

const COLORS = ["#2a9d6e", "#e9a825", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

const PortfolioTypeChart = ({ properties }: PortfolioTypeChartProps) => {
  const data = useMemo(() => {
    const map: Record<string, { value: number; rent: number; count: number }> = {};
    properties.forEach(p => {
      if (!map[p.type]) map[p.type] = { value: 0, rent: 0, count: 0 };
      map[p.type].value += p.currentValue;
      map[p.type].rent += p.monthlyRent;
      map[p.type].count += 1;
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value);
  }, [properties]);

  if (properties.length < 2) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <PieIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Portfolio nach Typ</span>
      </div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [formatCurrency(v), "Wert"]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
              <span className="font-medium">{d.count}x</span>
              <span className="text-muted-foreground">{formatCurrency(d.rent)}/M</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortfolioTypeChart;
