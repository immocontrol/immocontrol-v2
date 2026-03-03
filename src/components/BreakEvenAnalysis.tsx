/**
 * #7: Break-Even-Analyse — Ab wann rechnet sich ein Objekt?
 */
import { useMemo } from "react";
import { Target, TrendingUp } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, safeDivide } from "@/lib/formatters";

export function BreakEvenAnalysis() {
  const { properties } = useProperties();

  const analysis = useMemo(() => {
    return properties.map(p => {
      const annualCashflow = p.monthlyCashflow * 12;
      // Total initial investment = purchase price (simplified)
      const totalInvestment = p.purchasePrice;
      // Break-even = when cumulative cashflow covers initial equity (purchase - debt)
      const equity = p.purchasePrice - p.remainingDebt;
      const breakEvenMonths = annualCashflow > 0
        ? Math.ceil((equity > 0 ? equity : totalInvestment) / (annualCashflow / 12))
        : null;
      const breakEvenYears = breakEvenMonths !== null ? (breakEvenMonths / 12).toFixed(1) : null;
      // Value appreciation contribution
      const appreciation = p.currentValue - p.purchasePrice;
      const totalReturn = appreciation + (annualCashflow > 0 ? annualCashflow : 0);
      const roi = safeDivide(totalReturn, totalInvestment, 0) * 100;

      return {
        id: p.id,
        name: p.name,
        purchasePrice: p.purchasePrice,
        currentValue: p.currentValue,
        monthlyCashflow: p.monthlyCashflow,
        annualCashflow,
        breakEvenMonths,
        breakEvenYears,
        appreciation,
        roi,
        isPositive: annualCashflow > 0,
      };
    }).sort((a, b) => {
      // Sort: positive cashflow first, then by break-even time
      if (a.isPositive && !b.isPositive) return -1;
      if (!a.isPositive && b.isPositive) return 1;
      if (a.breakEvenMonths !== null && b.breakEvenMonths !== null) return a.breakEvenMonths - b.breakEvenMonths;
      return 0;
    });
  }, [properties]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Break-Even-Analyse
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {properties.length} Objekte
        </span>
      </div>

      <div className="space-y-2">
        {analysis.slice(0, 6).map(a => (
          <div key={a.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold truncate">{a.name}</p>
              {a.breakEvenYears !== null ? (
                <span className={`text-xs font-bold ${parseFloat(a.breakEvenYears) <= 15 ? "text-profit" : "text-gold"}`}>
                  {a.breakEvenYears} Jahre
                </span>
              ) : (
                <span className="text-xs font-bold text-loss">Negativ</span>
              )}
            </div>

            {/* Progress bar */}
            {a.breakEvenMonths !== null && a.breakEvenMonths > 0 && (
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, safeDivide(100, a.breakEvenMonths / 12, 0) * Math.min(a.breakEvenMonths / 12, 30))}%` }}
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <span className="text-muted-foreground block">Cashflow/J</span>
                <span className={`font-medium ${a.annualCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(a.annualCashflow)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Wertzuwachs</span>
                <span className={`font-medium ${a.appreciation >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(a.appreciation)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">ROI</span>
                <span className="font-bold">{a.roi.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {analysis.length > 6 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          +{analysis.length - 6} weitere Objekte
        </p>
      )}
    </div>
  );
}

export default BreakEvenAnalysis;
