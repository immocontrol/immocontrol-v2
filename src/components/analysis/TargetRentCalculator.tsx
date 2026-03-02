import { useMemo, useState } from "react";
import { Target, ArrowRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { AnalysisInputState } from "@/hooks/useAnalysisCalculations";
import { BUNDESLAENDER_GRUNDERWERBSTEUER } from "@/hooks/useAnalysisCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

interface Props {
  inputs: AnalysisInputState;
}

const TargetRentCalculator = ({ inputs }: Props) => {
  const [targetRendite, setTargetRendite] = useState(6);

  const result = useMemo(() => {
    const requiredYearlyRent = (targetRendite / 100) * inputs.kaufpreis;
    const requiredMonthlyRent = requiredYearlyRent / 12;

    const grunderwerbsteuer = inputs.kaufpreis * ((BUNDESLAENDER_GRUNDERWERBSTEUER[inputs.bundesland] || 5) / 100);
    const gesamtkosten = inputs.kaufpreis + grunderwerbsteuer + inputs.kaufpreis * (inputs.maklerProvision / 100) + inputs.kaufpreis * (inputs.notarKosten / 100);
    const darlehen = gesamtkosten - inputs.eigenkapital;
    const monatlicheRate = (darlehen * (inputs.zinssatz + inputs.tilgung)) / 100 / 12;
    const breakEvenRent = inputs.bewirtschaftungskosten + monatlicheRate;

    // Difference to current
    const diffToTarget = inputs.monatlicheMiete - requiredMonthlyRent;
    const diffToBreakEven = inputs.monatlicheMiete - breakEvenRent;

    return { requiredMonthlyRent, breakEvenRent, diffToTarget, diffToBreakEven };
  }, [inputs, targetRendite]);

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:500ms]" role="region" aria-label="Zielmiete berechnen">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <Target className="h-4 w-4 text-muted-foreground" /> Zielmiete berechnen
      </h2>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Ziel-Brutto-Rendite: {targetRendite.toFixed(1)}%</label>
          <Slider
            min={2}
            max={12}
            step={0.5}
            value={[targetRendite]}
            onValueChange={([v]) => setTargetRendite(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Miete für {targetRendite}% Rendite</div>
            <div className="text-lg font-bold text-primary">{formatCurrency(result.requiredMonthlyRent)}</div>
            {inputs.quadratmeter > 0 && (
              <div className="text-xs text-muted-foreground">{(result.requiredMonthlyRent / inputs.quadratmeter).toFixed(2)} €/m²</div>
            )}
            {/* Comparison to current */}
            <div className={`text-[10px] mt-1 flex items-center gap-0.5 font-medium ${result.diffToTarget >= 0 ? "text-profit" : "text-loss"}`}>
              <ArrowRight className="h-2.5 w-2.5" />
              {result.diffToTarget >= 0 ? "Aktuell " : "Fehlen "}
              {formatCurrency(Math.abs(result.diffToTarget))}
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Break-Even Miete</div>
            <div className="text-lg font-bold text-gold">{formatCurrency(result.breakEvenRent)}</div>
            {inputs.quadratmeter > 0 && (
              <div className="text-xs text-muted-foreground">{(result.breakEvenRent / inputs.quadratmeter).toFixed(2)} €/m²</div>
            )}
            <div className={`text-[10px] mt-1 flex items-center gap-0.5 font-medium ${result.diffToBreakEven >= 0 ? "text-profit" : "text-loss"}`}>
              <ArrowRight className="h-2.5 w-2.5" />
              {result.diffToBreakEven >= 0 ? "Puffer " : "Fehlen "}
              {formatCurrency(Math.abs(result.diffToBreakEven))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetRentCalculator;
