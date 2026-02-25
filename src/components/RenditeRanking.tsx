import { useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const RenditeRanking = () => {
  const { properties } = useProperties();

  const ranking = useMemo(() => {
    return properties
      .map(p => ({
        id: p.id,
        name: p.name.length > 15 ? p.name.slice(0, 15) + "…" : p.name,
        fullName: p.name,
        brutto: p.purchasePrice > 0 ? (p.monthlyRent * 12) / p.purchasePrice * 100 : 0,
        netto: p.purchasePrice > 0 ? ((p.monthlyRent - p.monthlyExpenses) * 12) / p.purchasePrice * 100 : 0,
        cashflow: p.monthlyCashflow,
        cashOnCash: (p.purchasePrice - p.remainingDebt) > 0 ? (p.monthlyCashflow * 12) / (p.purchasePrice - p.remainingDebt) * 100 : 0,
      }))
      .sort((a, b) => b.brutto - a.brutto);
  }, [properties]);

  if (properties.length < 2) return null;

  const avgBrutto = ranking.reduce((s, r) => s + r.brutto, 0) / ranking.length;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" /> Rendite-Ranking
        </h3>
        <span className="text-xs text-muted-foreground">Ø {formatPercent(avgBrutto)} Brutto</span>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ranking} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}%`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
              formatter={(v: number) => [`${v.toFixed(2)}%`, "Brutto-Rendite"]}
              labelFormatter={(label) => ranking.find(r => r.name === label)?.fullName || label}
            />
            <Bar dataKey="brutto" radius={[0, 4, 4, 0]}>
              {ranking.map((entry, i) => (
                <Cell key={i} fill={entry.brutto >= avgBrutto ? "hsl(var(--profit))" : "hsl(var(--loss))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5">
        {ranking.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2 text-xs">
            <span className="font-bold w-5 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
            <span className="flex-1 truncate">{r.fullName}</span>
            <span className={`font-semibold tabular-nums ${r.brutto >= avgBrutto ? "text-profit" : "text-loss"}`}>{formatPercent(r.brutto)}</span>
            <span className="text-muted-foreground w-20 text-right">{formatCurrency(r.cashflow)}/M</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RenditeRanking;
