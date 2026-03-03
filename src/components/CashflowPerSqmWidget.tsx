import { useMemo } from "react";
import { Ruler } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Property {
  id: string;
  name: string;
  sqm: number;
  monthlyCashflow: number;
  monthlyRent: number;
}

interface CashflowPerSqmWidgetProps {
  properties: Property[];
}

const CashflowPerSqmWidget = ({ properties }: CashflowPerSqmWidgetProps) => {
  const data = useMemo(() =>
    properties
      .filter(p => p.sqm > 0)
      .map(p => ({
        name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
        cashflowSqm: Math.round((p.monthlyCashflow / p.sqm) * 100) / 100,
        rentSqm: Math.round((p.monthlyRent / p.sqm) * 100) / 100,
      }))
      .sort((a, b) => b.cashflowSqm - a.cashflowSqm),
    [properties]
  );

  if (data.length === 0) return null;

  /* IMP-34-7: Guard against division by zero — early return above ensures length > 0, but guard defensively */
  const avgCfSqm = data.length > 0
    ? data.reduce((s, d) => s + d.cashflowSqm, 0) / data.length
    : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Ruler className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Cashflow / m²</span>
        <span className="ml-auto text-xs text-muted-foreground">Ø {formatCurrency(avgCfSqm)}/m²</span>
      </div>
      {/* IMP-34-16: ARIA label for screen readers on cashflow/sqm chart */}
      <div role="img" aria-label={`Cashflow pro m²: ${data.length} Objekte, Ø ${avgCfSqm.toFixed(2)} €/m²`}>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={data} barSize={20}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, name: string) => [`${v.toFixed(2)} €`, name === "cashflowSqm" ? "CF/m²" : "Miete/m²"]}
            />
            <Bar dataKey="cashflowSqm" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.cashflowSqm >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CashflowPerSqmWidget;
