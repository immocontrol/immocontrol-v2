/**
 * #16: Steuerliche Jahresübersicht — Alle steuerrelevanten Daten pro Jahr auf einen Blick
 */
import { useMemo, useState, useCallback } from "react";
import { Receipt, Download, TrendingDown, TrendingUp } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, downloadBlob, safeDivide } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

export function TaxYearOverview() {
  const { properties, stats } = useProperties();
  const [year, setYear] = useState(new Date().getFullYear());

  const taxData = useMemo(() => {
    if (properties.length === 0) return null;

    const totalRentAnnual = stats.totalRent * 12;
    // AfA: 2% of purchase price for buildings built after 1924, 2.5% before
    const totalAfA = properties.reduce((s, p) => {
      const rate = p.yearBuilt && p.yearBuilt < 1925 ? 0.025 : 0.02;
      // AfA only on building value (approx 80% of purchase price, land excluded)
      return s + p.purchasePrice * 0.8 * rate;
    }, 0);
    const totalInterest = properties.reduce((s, p) => {
      // Approximate annual interest from credit rate and remaining debt
      return s + p.remainingDebt * (p.interestRate / 100);
    }, 0);
    const totalExpensesAnnual = stats.totalExpenses * 12;
    const totalWerbungskosten = totalAfA + totalInterest + totalExpensesAnnual;
    const taxableIncome = totalRentAnnual - totalWerbungskosten;
    // Approximate tax savings at 42% marginal rate
    const taxSavings = totalWerbungskosten * 0.42;

    return {
      totalRentAnnual,
      totalAfA,
      totalInterest,
      totalExpensesAnnual,
      totalWerbungskosten,
      taxableIncome,
      taxSavings,
      effectiveTaxRate: safeDivide(Math.max(0, taxableIncome) * 0.42, totalRentAnnual, 0) * 100,
    };
  }, [properties, stats]);

  const exportTaxOverview = useCallback(() => {
    if (!taxData) return;
    const csv = [
      "Position;Betrag EUR",
      `Mieteinnahmen (Jahr);${taxData.totalRentAnnual.toFixed(2)}`,
      `AfA (Abschreibung);-${taxData.totalAfA.toFixed(2)}`,
      `Schuldzinsen;-${taxData.totalInterest.toFixed(2)}`,
      `Betriebskosten/Verwaltung;-${taxData.totalExpensesAnnual.toFixed(2)}`,
      `Werbungskosten gesamt;-${taxData.totalWerbungskosten.toFixed(2)}`,
      `Steuerpflichtiger Überschuss;${taxData.taxableIncome.toFixed(2)}`,
      `Geschätzte Steuerersparnis (42%);${taxData.taxSavings.toFixed(2)}`,
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `Steueruebersicht_${year}.csv`);
  }, [taxData, year]);

  if (!taxData || properties.length === 0) return null;

  const rows = [
    { label: "Mieteinnahmen", value: taxData.totalRentAnnual, isIncome: true },
    { label: "AfA (Abschreibung)", value: -taxData.totalAfA, isIncome: false },
    { label: "Schuldzinsen", value: -taxData.totalInterest, isIncome: false },
    { label: "Betriebskosten", value: -taxData.totalExpensesAnnual, isIncome: false },
  ];

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          Steuerliche Jahresübersicht
        </h3>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="text-xs bg-secondary border border-border rounded px-2 py-1"
        >
          {[0, 1, 2].map(i => {
            const y = new Date().getFullYear() - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      <div className="space-y-1.5 mb-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20">
            <span className="text-xs flex items-center gap-1.5">
              {r.isIncome ? (
                <TrendingUp className="h-3 w-3 text-profit" />
              ) : (
                <TrendingDown className="h-3 w-3 text-loss" />
              )}
              {r.label}
            </span>
            <span className={`text-xs font-medium tabular-nums ${r.value >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(r.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="font-medium">Werbungskosten gesamt</span>
          <span className="font-bold text-loss">{formatCurrency(-taxData.totalWerbungskosten)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="font-medium">Steuerpflichtiger Überschuss</span>
          <span className={`font-bold ${taxData.taxableIncome >= 0 ? "text-foreground" : "text-profit"}`}>
            {formatCurrency(taxData.taxableIncome)}
          </span>
        </div>
        <div className="flex justify-between text-xs border-t border-border/50 pt-1.5">
          <span className="text-muted-foreground">Geschätzte Steuerersparnis (42%)</span>
          <span className="font-bold text-profit">{formatCurrency(taxData.taxSavings)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Effektive Steuerquote</span>
          <span>{taxData.effectiveTaxRate.toFixed(1)}%</span>
        </div>
      </div>

      <Button size="sm" variant="outline" className="w-full text-xs mt-3" onClick={exportTaxOverview}>
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Als CSV exportieren
      </Button>

      <p className="text-[10px] text-muted-foreground text-center mt-2">
        Geschätzte Werte basierend auf Portfolio-Daten. Keine Steuerberatung.
      </p>
    </div>
  );
}

export default TaxYearOverview;
