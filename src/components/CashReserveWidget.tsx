import { useMemo, useState, useEffect } from "react";
import { Shield, AlertTriangle, CheckCircle, PiggyBank } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LIQUID_RESERVE_KEY = "immocontrol_liquidReserve";

const CashReserveWidget = () => {
  const { properties, stats } = useProperties();
  const [liquidReserve, setLiquidReserveState] = useState<string>(() => {
    try {
      return localStorage.getItem(LIQUID_RESERVE_KEY) ?? "";
    } catch { return ""; }
  });

  useEffect(() => {
    try {
      if (liquidReserve !== "") localStorage.setItem(LIQUID_RESERVE_KEY, liquidReserve);
    } catch { /* ignore */ }
  }, [liquidReserve]);

  const recommendation = useMemo(() => {
    if (properties.length === 0) return null;
    const totalUnits = properties.reduce((s, p) => s + p.units, 0);
    const monthlyExpenses = properties.reduce((s, p) => s + p.monthlyExpenses + p.monthlyCreditRate, 0);
    const minReserve = monthlyExpenses * 3 + totalUnits * 2000;
    const idealReserve = monthlyExpenses * 6 + totalUnits * 3000;
    const petersReserve = stats.totalValue * 0.01;
    const reserveNum = Number(liquidReserve.replace(/\s/g, "").replace(",", ".")) || 0;
    const monthsReserve = monthlyExpenses > 0 && reserveNum > 0 ? reserveNum / monthlyExpenses : null;
    return { minReserve, idealReserve, petersReserve, monthlyExpenses, totalUnits, monthsReserve, reserveNum };
  }, [properties, stats, liquidReserve]);

  if (!recommendation) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-muted-foreground" /> Empfohlene Rücklagen
      </h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="liquid-reserve" className="text-xs text-muted-foreground flex items-center gap-1.5">
            <PiggyBank className="h-3 w-3" /> Liquidität / Rücklage (EUR)
          </Label>
          <Input
            id="liquid-reserve"
            type="text"
            inputMode="decimal"
            placeholder="z.B. 25000"
            className="h-8 text-sm"
            value={liquidReserve}
            onChange={(e) => setLiquidReserveState(e.target.value)}
          />
        </div>
        {recommendation.monthsReserve != null && (
          <div className="flex justify-between text-xs py-1 px-2 rounded bg-muted/50">
            <span className="text-muted-foreground">Monate Reserve</span>
            <span className="font-semibold">{recommendation.monthsReserve >= 3 ? "✓ " : ""}{recommendation.monthsReserve.toFixed(1)} Monate</span>
          </div>
        )}
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