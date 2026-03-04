/**
 * IMP20-9: Rendite-Dashboard pro Objekt
 * PropertyDetail: Tab combining RenditeOptimizer + PropertyBenchmark + CashflowScenarios.
 * "How does this property perform vs scenarios?"
 */
import { memo, lazy, Suspense, useState } from "react";
import { TrendingUp, BarChart3, Target, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";

const RenditeOptimizer = lazy(() => import("@/components/RenditeOptimizer").then(m => ({ default: m.RenditeOptimizer })));
const PropertyBenchmark = lazy(() => import("@/components/PropertyBenchmark").then(m => ({ default: m.PropertyBenchmark })));
const CashflowScenarios = lazy(() => import("@/components/CashflowScenarios").then(m => ({ default: m.CashflowScenarios })));

interface PropertyMetrics {
  bruttoRendite: number;
  nettoRendite: number;
  appreciation: number;
  cashOnCash: number;
  mietmultiplikator: number;
  ltv: number;
  dscr: number;
  breakEvenOccupancy: number;
  pricePerUnit: number;
}

interface RenditeDashboardTabProps {
  propertyId: string;
  metrics: PropertyMetrics;
  propertyName: string;
}

const RenditeDashboardTab = memo(({ propertyId, metrics, propertyName }: RenditeDashboardTabProps) => {
  const [activeSection, setActiveSection] = useState<"overview" | "optimizer" | "benchmark" | "scenarios">("overview");

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap">
        {([
          { key: "overview", label: "Übersicht", icon: Layers },
          { key: "optimizer", label: "Optimierung", icon: TrendingUp },
          { key: "benchmark", label: "Benchmark", icon: BarChart3 },
          { key: "scenarios", label: "Szenarien", icon: Target },
        ] as const).map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeSection === key ? "default" : "outline"}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setActiveSection(key)}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {/* Overview: Key metrics */}
      {activeSection === "overview" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard label="Brutto-Rendite" value={formatPercentDE(metrics.bruttoRendite)} color={metrics.bruttoRendite >= 5 ? "profit" : metrics.bruttoRendite >= 3 ? "primary" : "loss"} />
            <MetricCard label="Netto-Rendite" value={formatPercentDE(metrics.nettoRendite)} color={metrics.nettoRendite >= 3 ? "profit" : metrics.nettoRendite >= 1 ? "primary" : "loss"} />
            <MetricCard label="Cash-on-Cash" value={formatPercentDE(metrics.cashOnCash)} color={metrics.cashOnCash >= 8 ? "profit" : metrics.cashOnCash >= 4 ? "primary" : "loss"} />
            <MetricCard label="Wertsteigerung" value={formatPercentDE(metrics.appreciation)} color={metrics.appreciation >= 0 ? "profit" : "loss"} />
            <MetricCard label="Mietmultiplikator" value={`${metrics.mietmultiplikator.toFixed(1)}x`} color={metrics.mietmultiplikator <= 20 ? "profit" : metrics.mietmultiplikator <= 25 ? "primary" : "loss"} />
            <MetricCard label="LTV" value={formatPercentDE(metrics.ltv)} color={metrics.ltv <= 60 ? "profit" : metrics.ltv <= 80 ? "primary" : "loss"} />
            <MetricCard label="DSCR" value={metrics.dscr.toFixed(2)} color={metrics.dscr >= 1.3 ? "profit" : metrics.dscr >= 1.0 ? "primary" : "loss"} />
            <MetricCard label="Break-Even" value={formatPercentDE(metrics.breakEvenOccupancy)} color={metrics.breakEvenOccupancy <= 70 ? "profit" : metrics.breakEvenOccupancy <= 90 ? "primary" : "loss"} />
            <MetricCard label="Preis/Einheit" value={formatCurrency(metrics.pricePerUnit)} color="primary" />
          </div>

          {/* Quick assessment */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs font-medium mb-1">Schnellbewertung: {propertyName}</p>
            <div className="space-y-1">
              {metrics.bruttoRendite >= 5 && <Assessment text="Starke Brutto-Rendite über 5%" positive />}
              {metrics.bruttoRendite < 3 && <Assessment text="Brutto-Rendite unter 3% — Optimierungsbedarf" positive={false} />}
              {metrics.dscr >= 1.3 && <Assessment text="DSCR über 1.3 — gute Schuldendeckung" positive />}
              {metrics.dscr < 1.0 && <Assessment text="DSCR unter 1.0 — Cashflow reicht nicht für Kreditrate" positive={false} />}
              {metrics.ltv > 80 && <Assessment text="LTV über 80% — hohes Fremdkapital" positive={false} />}
              {metrics.mietmultiplikator <= 20 && <Assessment text="Mietmultiplikator unter 20 — attraktiver Kaufpreis" positive />}
            </div>
          </div>
        </div>
      )}

      {/* Lazy-loaded sub-components */}
      {activeSection === "optimizer" && (
        <Suspense fallback={<div className="h-40 bg-secondary/50 rounded animate-pulse" />}>
          <RenditeOptimizer />
        </Suspense>
      )}
      {activeSection === "benchmark" && (
        <Suspense fallback={<div className="h-40 bg-secondary/50 rounded animate-pulse" />}>
          <PropertyBenchmark />
        </Suspense>
      )}
      {activeSection === "scenarios" && (
        <Suspense fallback={<div className="h-40 bg-secondary/50 rounded animate-pulse" />}>
          <CashflowScenarios />
        </Suspense>
      )}
    </div>
  );
});
RenditeDashboardTab.displayName = "RenditeDashboardTab";

const MetricCard = memo(({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2.5 rounded-lg bg-background/50 border border-border text-center">
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={`text-sm font-bold text-${color}`}>{value}</p>
  </div>
));
MetricCard.displayName = "MetricCard";

const Assessment = memo(({ text, positive }: { text: string; positive: boolean }) => (
  <p className={`text-[10px] flex items-center gap-1 ${positive ? "text-profit" : "text-loss"}`}>
    {positive ? "✓" : "⚠"} {text}
  </p>
));
Assessment.displayName = "Assessment";

export { RenditeDashboardTab };
