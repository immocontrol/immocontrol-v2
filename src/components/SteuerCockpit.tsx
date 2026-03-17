/**
 * IMP20-6: Steuer-Cockpit
 * Combines AnlageVExport + TaxYearOverview + AfACalculator into a unified tax dashboard.
 * Shows projected tax liability and optimization tips.
 */
import { memo, useState, useMemo, lazy, Suspense } from "react";
import { Receipt, Calculator, FileText, TrendingDown, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { ManusSteuerOptimierung } from "@/components/manus/ManusSteuerOptimierung";

const AnlageVExport = lazy(() => import("@/components/AnlageVExport").then(m => ({ default: m.AnlageVExport })));
const TaxYearOverview = lazy(() => import("@/components/TaxYearOverview").then(m => ({ default: m.TaxYearOverview })));
const AfACalculator = lazy(() => import("@/components/AfACalculator").then(m => ({ default: m.AfACalculator })));

const SteuerCockpit = memo(() => {
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "anlageV" | "afa" | "manus">("overview");

  const taxProjection = useMemo(() => {
    if (properties.length === 0) return null;
    const annualRent = stats.totalRent * 12;
    const annualExpenses = stats.totalExpenses * 12;
    const annualInterest = stats.totalCreditRate * 12 * 0.6; // ~60% of credit rate is interest
    const totalAfA = properties.reduce((sum, p) => {
      // Standard 2% AfA for buildings (not land)
      const buildingValue = p.purchasePrice * 0.75; // ~75% building, 25% land
      return sum + (buildingValue * 0.02);
    }, 0);
    const taxableIncome = annualRent - annualExpenses - annualInterest - totalAfA;
    const estimatedTax = Math.max(0, taxableIncome * 0.42); // Top tax rate
    const effectiveTaxRate = annualRent > 0 ? (estimatedTax / annualRent) * 100 : 0;

    const tips: string[] = [];
    if (totalAfA > 0) tips.push(`AfA-Potenzial: ${formatCurrency(totalAfA)}/Jahr absetzbar`);
    if (annualInterest > 0) tips.push(`Schuldzinsen: ${formatCurrency(annualInterest)}/Jahr absetzbar`);
    if (properties.some(p => p.yearBuilt < 1925)) tips.push("Altbau-Bonus: 2,5% AfA für Gebäude vor 1925");
    if (properties.length >= 3) tips.push("Gewerblichkeit prüfen: Ab 3 Objekten ggf. §15 EStG relevant");

    return {
      annualRent,
      annualExpenses,
      annualInterest,
      totalAfA,
      taxableIncome,
      estimatedTax,
      effectiveTaxRate,
      tips,
    };
  }, [properties, stats]);

  const manusOwnership = useMemo(() => {
    const first = properties[0]?.ownership;
    if (!first) return "privat";
    return properties.every((p) => p.ownership === first) ? first : "gemischt";
  }, [properties]);

  const manusProperties = useMemo(() => properties.map((p) => ({
    name: p.name,
    kaufpreis: p.purchasePrice,
    baujahr: p.yearBuilt,
    kaufdatum: p.purchaseDate,
    jahresmiete: (p.monthlyRent || 0) * 12,
    wohnflaeche: p.sqm || 0,
  })), [properties]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in min-w-0">
      <div className="flex items-center justify-between mb-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Receipt className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-wrap-safe break-words">Steuer-Cockpit</h3>
          <Badge variant="outline" className="text-[10px] h-5 shrink-0">{new Date().getFullYear()}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 touch-target min-h-[44px]" aria-label={expanded ? "Bereich einklappen" : "Bereich aufklappen"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {taxProjection && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 min-w-0">
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-[10px] text-muted-foreground">Mieteinnahmen</p>
              <p className="text-xs font-bold text-profit">{formatCurrency(taxProjection.annualRent)}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-[10px] text-muted-foreground">Absetzbar</p>
              <p className="text-xs font-bold text-primary">{formatCurrency(taxProjection.annualExpenses + taxProjection.annualInterest + taxProjection.totalAfA)}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-[10px] text-muted-foreground">Zu versteuern</p>
              <p className="text-xs font-bold">{formatCurrency(Math.max(0, taxProjection.taxableIncome))}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-[10px] text-muted-foreground">~Steuerlast</p>
              <p className="text-xs font-bold text-loss">{formatCurrency(taxProjection.estimatedTax)}</p>
            </div>
          </div>

          {/* Optimization tips */}
          {taxProjection.tips.length > 0 && (
            <div className="space-y-1 mb-3 min-w-0">
              {taxProjection.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground min-w-0">
                  <TrendingDown className="h-3 w-3 text-profit shrink-0 mt-0.5" />
                  <span className="text-wrap-safe break-words">{tip}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Expanded: Tabs for AnlageV, TaxYear, AfA */}
      {expanded && (
        <div className="mt-3 border-t border-border pt-3 min-w-0">
          <div className="flex flex-wrap gap-1 mb-3 min-w-0" role="tablist" aria-label="Steuer-Bereiche">
            {(["overview", "anlageV", "afa", "manus"] as const).map(tab => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "ghost"}
                size="sm"
                className="text-[10px] h-8 px-2 touch-target min-h-[36px]"
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
              >
                {tab === "overview" ? "Übersicht" : tab === "anlageV" ? "Anlage V" : tab === "afa" ? "AfA-Rechner" : "Manus AI"}
              </Button>
            ))}
          </div>
          <Suspense fallback={<div className="h-20 bg-secondary/50 rounded animate-pulse min-w-0" role="status" aria-label="Bereich wird geladen" />}>
            {activeTab === "overview" && <TaxYearOverview />}
            {activeTab === "anlageV" && <AnlageVExport />}
            {activeTab === "afa" && <AfACalculator />}
            {activeTab === "manus" && (
              <ManusSteuerOptimierung properties={manusProperties} ownership={manusOwnership} />
            )}
          </Suspense>
        </div>
      )}
    </div>
  );
});
SteuerCockpit.displayName = "SteuerCockpit";

export { SteuerCockpit };
