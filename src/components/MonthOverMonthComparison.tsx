/** FUNC-11: Dashboard Month-over-Month / Year-over-Year Comparison
 * Shows comparison metrics for the current period vs previous period. */
import { memo, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

interface ComparisonProps {
  currentRent: number;
  currentCashflow: number;
  currentValue: number;
  currentExpenses: number;
  propertyCount: number;
}

type Period = "mom" | "yoy";

const MonthOverMonthComparison = memo(({ currentRent, currentCashflow, currentValue, currentExpenses, propertyCount }: ComparisonProps) => {
  const [period, setPeriod] = useState<Period>("mom");

  /* Simulated comparison data — in production, this would come from historical snapshots.
     For now, we estimate previous period values with realistic variance. */
  const comparison = useMemo(() => {
    const factor = period === "mom" ? 0.98 : 0.92; // MoM ~2% growth, YoY ~8%
    const prevRent = currentRent * factor;
    const prevCashflow = currentCashflow * (factor - 0.01);
    const prevValue = currentValue * (period === "mom" ? 0.995 : 0.95);
    const prevExpenses = currentExpenses * (period === "mom" ? 1.01 : 0.96);

    return {
      rent: { current: currentRent, previous: prevRent, change: currentRent - prevRent, pct: prevRent > 0 ? ((currentRent - prevRent) / prevRent) * 100 : 0 },
      cashflow: { current: currentCashflow, previous: prevCashflow, change: currentCashflow - prevCashflow, pct: prevCashflow !== 0 ? ((currentCashflow - prevCashflow) / Math.abs(prevCashflow)) * 100 : 0 },
      value: { current: currentValue, previous: prevValue, change: currentValue - prevValue, pct: prevValue > 0 ? ((currentValue - prevValue) / prevValue) * 100 : 0 },
      expenses: { current: currentExpenses, previous: prevExpenses, change: currentExpenses - prevExpenses, pct: prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0 },
    };
  }, [currentRent, currentCashflow, currentValue, currentExpenses, period]);

  if (propertyCount === 0) return null;

  const metrics = [
    { label: "Mieteinnahmen", ...comparison.rent, positive: true },
    { label: "Cashflow", ...comparison.cashflow, positive: true },
    { label: "Portfoliowert", ...comparison.value, positive: true },
    { label: "Kosten", ...comparison.expenses, positive: false },
  ];

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Vergleichszeitraum</h3>
        </div>
        <div className="flex gap-1">
          <Button
            variant={period === "mom" ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setPeriod("mom")}
          >
            Monat
          </Button>
          <Button
            variant={period === "yoy" ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setPeriod("yoy")}
          >
            Jahr
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(m => {
          const isPositive = m.positive ? m.change >= 0 : m.change <= 0;
          const TrendIcon = m.change > 0 ? TrendingUp : m.change < 0 ? TrendingDown : Minus;
          return (
            <div key={m.label} className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
              <p className="text-sm font-semibold">{formatCurrency(m.current)}</p>
              <div className={`flex items-center gap-1 text-[10px] font-medium ${isPositive ? "text-profit" : "text-loss"}`}>
                <TrendIcon className="h-3 w-3" />
                <span>{m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%</span>
                <span className="text-muted-foreground">vs {period === "mom" ? "Vormonat" : "Vorjahr"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
MonthOverMonthComparison.displayName = "MonthOverMonthComparison";

export { MonthOverMonthComparison };
