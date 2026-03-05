/**
 * INHALT-12: Portfolio-Benchmark — Vergleich mit Marktdurchschnitt
 * Eigene Rendite, Cashflow-Rendite, Mietausfallquote vergleichen mit Durchschnittswerten.
 */
import { memo, useMemo, useState } from "react";
import { Target, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { formatPercentDE } from "@/lib/formatters";

interface BenchmarkMetric {
  name: string;
  own: number;
  market: number;
  diff: number;
  unit: string;
  betterWhenHigher: boolean;
}

// Average market data for German real estate (simplified)
const MARKET_AVERAGES = {
  bruttoRendite: 4.5,
  nettoRendite: 3.2,
  cashflowRendite: 1.8,
  leerstandsquote: 3.5,
  nkQuote: 35,
  ekQuote: 35,
  wertsteigerung: 3.0,
  mietausfallquote: 2.0,
};

const PortfolioBenchmark = memo(() => {
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);

  const metrics = useMemo((): BenchmarkMetric[] => {
    if (properties.length === 0) return [];

    const annualRent = stats.totalRent * 12;
    const annualExpenses = stats.totalExpenses * 12;
    const annualCashflow = stats.totalCashflow * 12;

    const bruttoRendite = stats.totalPurchase > 0 ? (annualRent / stats.totalPurchase) * 100 : 0;
    const nettoRendite = stats.totalPurchase > 0 ? ((annualRent - annualExpenses) / stats.totalPurchase) * 100 : 0;
    const cashflowRendite = stats.totalValue > 0 ? (annualCashflow / stats.totalValue) * 100 : 0;
    const nkQuote = annualRent > 0 ? (annualExpenses / annualRent) * 100 : 0;
    const ekQuote = stats.totalValue > 0 ? (stats.equity / stats.totalValue) * 100 : 0;

    return [
      { name: "Brutto-Rendite", own: bruttoRendite, market: MARKET_AVERAGES.bruttoRendite, diff: bruttoRendite - MARKET_AVERAGES.bruttoRendite, unit: "%", betterWhenHigher: true },
      { name: "Netto-Rendite", own: nettoRendite, market: MARKET_AVERAGES.nettoRendite, diff: nettoRendite - MARKET_AVERAGES.nettoRendite, unit: "%", betterWhenHigher: true },
      { name: "Cashflow-Rendite", own: cashflowRendite, market: MARKET_AVERAGES.cashflowRendite, diff: cashflowRendite - MARKET_AVERAGES.cashflowRendite, unit: "%", betterWhenHigher: true },
      { name: "NK-Quote", own: nkQuote, market: MARKET_AVERAGES.nkQuote, diff: nkQuote - MARKET_AVERAGES.nkQuote, unit: "%", betterWhenHigher: false },
      { name: "EK-Quote", own: ekQuote, market: MARKET_AVERAGES.ekQuote, diff: ekQuote - MARKET_AVERAGES.ekQuote, unit: "%", betterWhenHigher: true },
      { name: "Wertsteigerung", own: stats.appreciation, market: MARKET_AVERAGES.wertsteigerung, diff: stats.appreciation - MARKET_AVERAGES.wertsteigerung, unit: "%", betterWhenHigher: true },
    ];
  }, [properties, stats]);

  if (properties.length === 0) return null;

  const betterCount = metrics.filter((m) => {
    const isBetter = m.betterWhenHigher ? m.diff > 0 : m.diff < 0;
    return isBetter;
  }).length;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Portfolio-Benchmark</h3>
          <Badge variant="outline" className="text-[10px] h-5">
            {betterCount}/{metrics.length} besser
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      <div className="space-y-1.5">
        {metrics.slice(0, expanded ? undefined : 4).map((m) => {
          const isBetter = m.betterWhenHigher ? m.diff > 0 : m.diff < 0;
          const isNeutral = Math.abs(m.diff) < 0.5;
          return (
            <div key={m.name} className="flex items-center gap-2 text-[10px]">
              <span className="w-28 text-muted-foreground shrink-0">{m.name}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium">{formatPercentDE(m.own)}</span>
                  <span className="text-muted-foreground">Ø {formatPercentDE(m.market)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted relative">
                  <div
                    className={`absolute h-full rounded-full ${isBetter ? "bg-profit" : isNeutral ? "bg-primary" : "bg-loss"}`}
                    style={{
                      width: `${Math.min(100, Math.max(5, (m.own / Math.max(m.market * 2, 1)) * 100))}%`,
                    }}
                  />
                  <div
                    className="absolute h-full w-0.5 bg-foreground/30 rounded"
                    style={{ left: `${Math.min(100, (m.market / Math.max(m.market * 2, 1)) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="w-12 text-right shrink-0">
                {isNeutral ? (
                  <span className="text-muted-foreground flex items-center justify-end gap-0.5"><Minus className="h-3 w-3" />~</span>
                ) : isBetter ? (
                  <span className="text-profit flex items-center justify-end gap-0.5"><TrendingUp className="h-3 w-3" />+{Math.abs(m.diff).toFixed(1)}</span>
                ) : (
                  <span className="text-loss flex items-center justify-end gap-0.5"><TrendingDown className="h-3 w-3" />-{Math.abs(m.diff).toFixed(1)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {expanded && (
        <p className="text-[9px] text-muted-foreground mt-2 italic">
          Vergleichswerte basieren auf Durchschnittsdaten des deutschen Immobilienmarktes 2024/2025.
        </p>
      )}
    </div>
  );
});
PortfolioBenchmark.displayName = "PortfolioBenchmark";

export { PortfolioBenchmark };
