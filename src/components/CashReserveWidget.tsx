import { useMemo } from "react";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const CashReserveWidget = () => {
  const { properties, stats } = useProperties();

  const recommendation = useMemo(() => {
    if (properties.length === 0) return null;
    const totalUnits = properties.reduce((s, p) => s + p.units, 0);
    const monthlyExpenses = properties.reduce((s, p) => s + p.monthlyExpenses + p.monthlyCreditRate, 0);
    // Rule: 3-6 months expenses + €2000/unit for repairs
    const minReserve = monthlyExpenses * 3 + totalUnits * 2000;
    const idealReserve = monthlyExpenses * 6 + totalUnits * 3000;
    // Instandhaltungsrücklage nach Peters'scher Formel: 0.8-1% of current value
    const petersReserve = stats.totalValue * 0.01;
    return { minReserve, idealReserve, petersReserve, monthlyExpenses, totalUnits };
  }, [properties, stats]);

  if (!recommendation) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-muted-foreground" /> Empfohlene Rücklagen
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Monatliche Fixkosten</span>
          <span className="font-medium">{formatCurrency(recommendation.monthlyExpenses)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Einheiten gesamt</span>
          <span className="font-medium">{recommendation.totalUnits}</span>
        </div>
        <div className="border-t border-border pt-2 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-gold" /> Minimum (3 Monate)
            </span>
            <span className="font-semibold text-gold">{formatCurrency(recommendation.minReserve)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3 text-profit" /> Ideal (6 Monate)
            </span>
            <span className="font-semibold text-profit">{formatCurrency(recommendation.idealReserve)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Peters'sche Formel (1%/Jahr)</span>
            <span className="font-medium">{formatCurrency(recommendation.petersReserve)}/Jahr</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashReserveWidget;