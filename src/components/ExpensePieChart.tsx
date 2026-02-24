import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ExpensePieChartProps {
  monthlyRent: number;
  monthlyCreditRate: number;
  monthlyExpenses: number;
  monthlyCashflow: number;
}

const COLORS = ["#2a9d6e", "#e9a825", "#ef4444", "#3b82f6"];

const ExpensePieChart = ({ monthlyRent, monthlyCreditRate, monthlyExpenses, monthlyCashflow }: ExpensePieChartProps) => {
  const cashflowPositive = Math.max(monthlyCashflow, 0);

  const data = [
    { name: "Cashflow", value: cashflowPositive },
    { name: "Kreditrate", value: monthlyCreditRate },
    { name: "Bewirtschaftung", value: monthlyExpenses },
  ].filter(d => d.value > 0);

  if (data.length === 0 || monthlyRent <= 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Mieteinnahmen aufgeteilt</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{formatCurrency(monthlyRent)}/Monat</span>
      </div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={28} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [formatCurrency(v), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="flex-1 text-muted-foreground">{d.name}</span>
              <span className="font-medium">{formatCurrency(d.value)}</span>
              <span className="text-muted-foreground text-[10px]">{((d.value / monthlyRent) * 100).toFixed(0)}%</span>
            </div>
          ))}
          {monthlyCashflow < 0 && (
            <p className="text-[10px] text-loss mt-1">Negativer Cashflow: {formatCurrency(monthlyCashflow)}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpensePieChart;
