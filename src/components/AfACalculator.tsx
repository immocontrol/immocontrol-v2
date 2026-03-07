import { useMemo } from "react";
import { Calculator, TrendingDown } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { getGebaeudeAnteil, getAnnualAfa, getAfaRatePercent } from "@/lib/afaSanierung";

const AfACalculator = () => {
  const { properties } = useProperties();

  const afaData = useMemo(() => {
    return properties.map(p => {
      const yearBuilt = p.yearBuilt ?? 1970;
      const input = { purchasePrice: p.purchasePrice, yearBuilt, buildingSharePercent: p.buildingSharePercent, restnutzungsdauer: p.restnutzungsdauer };
      const gebaeudeAnteil = getGebaeudeAnteil(input);
      const afaRate = getAfaRatePercent(input);
      const annualAfa = getAnnualAfa(input);
      const monthlyAfa = annualAfa / 12;
      const purchaseDate = new Date(p.purchaseDate);
      const yearsHeld = Math.max(0, (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const totalAfaClaimed = Math.min(annualAfa * yearsHeld, gebaeudeAnteil);
      const remainingAfa = gebaeudeAnteil - totalAfaClaimed;
      const remainingYears = annualAfa > 0 ? remainingAfa / annualAfa : 0;

      return {
        id: p.id,
        name: p.name,
        purchasePrice: p.purchasePrice,
        yearBuilt,
        afaRate,
        gebaeudeAnteil,
        annualAfa,
        monthlyAfa,
        yearsHeld: Math.floor(yearsHeld),
        totalAfaClaimed,
        remainingAfa,
        remainingYears: Math.ceil(remainingYears),
        progress: gebaeudeAnteil > 0 ? (totalAfaClaimed / gebaeudeAnteil) * 100 : 0,
      };
    });
  }, [properties]);

  const totalAnnualAfa = afaData.reduce((s, d) => s + d.annualAfa, 0);
  const totalMonthlyAfa = afaData.reduce((s, d) => s + d.monthlyAfa, 0);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" /> AfA-Übersicht (Abschreibung)
        </h3>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Gesamt-AfA/Jahr</div>
          <div className="text-sm font-bold text-profit">{formatCurrency(totalAnnualAfa)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase">AfA / Monat</div>
          <div className="text-lg font-bold">{formatCurrency(totalMonthlyAfa)}</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Steuerersparnis*</div>
          <div className="text-lg font-bold text-profit">{formatCurrency(totalAnnualAfa * 0.42)}</div>
          <div className="text-[9px] text-muted-foreground">*bei 42% Grenzsteuersatz</div>
        </div>
      </div>

      <div className="space-y-3">
        {afaData.map(d => (
          <div key={d.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{d.name}</span>
                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded shrink-0">
                  {d.afaRate.toFixed(1)}% · Bj. {d.yearBuilt}
                </span>
              </div>
              <span className="font-semibold tabular-nums shrink-0">{formatCurrency(d.annualAfa)}/J</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(d.progress, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatCurrency(d.totalAfaClaimed)} abgeschrieben ({d.progress.toFixed(0)}%)</span>
              <span>noch {d.remainingYears} Jahre</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AfACalculator;
