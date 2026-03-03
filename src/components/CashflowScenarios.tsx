/**
 * #6: Cashflow-Szenario-Vergleich — 3 Szenarien (Best/Normal/Worst) mit verschiedenen Zins-Annahmen
 */
import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, safeDivide } from "@/lib/formatters";

interface Scenario {
  label: string;
  icon: React.ReactNode;
  color: string;
  vacancyRate: number; // % of rent lost
  interestDelta: number; // +/- percentage points
  expenseDelta: number; // % increase in expenses
  rentDelta: number; // % change in rent
}

const SCENARIOS: Scenario[] = [
  {
    label: "Best Case",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-profit",
    vacancyRate: 0,
    interestDelta: -0.5,
    expenseDelta: -5,
    rentDelta: 5,
  },
  {
    label: "Normal",
    icon: <Minus className="h-4 w-4" />,
    color: "text-foreground",
    vacancyRate: 3,
    interestDelta: 0,
    expenseDelta: 0,
    rentDelta: 0,
  },
  {
    label: "Worst Case",
    icon: <TrendingDown className="h-4 w-4" />,
    color: "text-loss",
    vacancyRate: 10,
    interestDelta: 2,
    expenseDelta: 15,
    rentDelta: -5,
  },
];

export function CashflowScenarios() {
  const { properties, stats } = useProperties();
  const [years, setYears] = useState(5);

  const scenarios = useMemo(() => {
    if (properties.length === 0) return [];

    return SCENARIOS.map(s => {
      const monthlyRent = stats.totalRent * (1 + s.rentDelta / 100) * (1 - s.vacancyRate / 100);
      const monthlyExpenses = stats.totalExpenses * (1 + s.expenseDelta / 100);
      // Simplified: apply interest delta to credit rate proportionally
      const avgRate = properties.reduce((sum, p) => sum + p.interestRate, 0) / properties.length;
      const newRate = Math.max(0, avgRate + s.interestDelta);
      const rateMultiplier = avgRate > 0 ? newRate / avgRate : 1;
      const monthlyCreditRate = stats.totalCreditRate * rateMultiplier;
      const monthlyCashflow = monthlyRent - monthlyExpenses - monthlyCreditRate;
      const annualCashflow = monthlyCashflow * 12;

      return {
        ...s,
        monthlyRent,
        monthlyExpenses,
        monthlyCreditRate,
        monthlyCashflow,
        annualCashflow,
        totalCashflow: annualCashflow * years,
        rendite: safeDivide(annualCashflow, stats.totalValue, 0) * 100,
      };
    });
  }, [properties, stats, years]);

  if (properties.length === 0) return null;

  const maxCashflow = Math.max(...scenarios.map(s => Math.abs(s.annualCashflow)), 1);

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Cashflow-Szenarien
        </h3>
        <select
          value={years}
          onChange={e => setYears(Number(e.target.value))}
          className="text-xs bg-secondary border border-border rounded px-2 py-1"
        >
          {[1, 3, 5, 10].map(y => (
            <option key={y} value={y}>{y} Jahr{y > 1 ? "e" : ""}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {scenarios.map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${s.color}`}>
                {s.icon} {s.label}
              </span>
              <span className={`text-sm font-bold tabular-nums ${s.monthlyCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(s.monthlyCashflow)}/M
              </span>
            </div>

            {/* Bar visualization */}
            <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${s.annualCashflow >= 0 ? "bg-profit" : "bg-loss"}`}
                style={{ width: `${Math.min(100, (Math.abs(s.annualCashflow) / maxCashflow) * 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <span className="text-muted-foreground block">Miete</span>
                <span className="font-medium">{formatCurrency(s.monthlyRent)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Kosten</span>
                <span className="font-medium">{formatCurrency(s.monthlyExpenses)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">{years}J Gesamt</span>
                <span className={`font-bold ${s.totalCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(s.totalCashflow)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
              <span>Leerstand: {s.vacancyRate}%</span>
              <span>Zins: {s.interestDelta >= 0 ? "+" : ""}{s.interestDelta}%</span>
              <span>Rendite: {s.rendite.toFixed(2)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CashflowScenarios;
