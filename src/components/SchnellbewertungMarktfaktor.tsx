/**
 * IMP20-19: Schnellbewertung mit Marktfaktor
 * ImmobilienBewertung: Use Newsticker sentiment + InterestRateMonitor data.
 * Apply market factor (discount/premium) based on market conditions.
 */
import { memo, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart3, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMarketRates } from "@/hooks/useMarketRates";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";

interface SchnellbewertungMarktfaktorProps {
  baseValue: number;
  location?: string;
}

const SchnellbewertungMarktfaktor = memo(({ baseValue, location }: SchnellbewertungMarktfaktorProps) => {
  const { data: marketData } = useMarketRates();

  const marketFactor = useMemo(() => {
    if (!marketData) return { factor: 1, label: "Neutral", trend: "neutral" as const };

    // Calculate market factor based on interest rates and sentiment
    const currentRate = marketData.latestMortgage ?? 3.5;
    const historicalAvg = 2.5; // Historical average mortgage rate
    
    // Higher rates = lower prices (inverse relationship)
    const rateImpact = ((historicalAvg - currentRate) / historicalAvg) * 0.15; // ±15% max from rates
    
    // Compute trend from mortgage rate history
    const rates = marketData.mortgageRate ?? [];
    const trend = rates.length >= 2
      ? (rates[rates.length - 1].rate < rates[rates.length - 2].rate ? "falling" : rates[rates.length - 1].rate > rates[rates.length - 2].rate ? "rising" : "stable")
      : "stable";
    const sentimentImpact = trend === "falling" ? 0.03 : trend === "rising" ? -0.03 : 0;
    
    const totalFactor = 1 + rateImpact + sentimentImpact;
    const clampedFactor = Math.max(0.7, Math.min(1.3, totalFactor)); // Clamp to ±30%

    let label = "Neutral";
    let trendDirection: "up" | "down" | "neutral" = "neutral";
    if (clampedFactor > 1.05) { label = "Aufschlag (Käufermarkt)"; trendDirection = "up"; }
    else if (clampedFactor < 0.95) { label = "Abschlag (Verkäufermarkt)"; trendDirection = "down"; }

    return { factor: clampedFactor, label, trend: trendDirection };
  }, [marketData]);

  const adjustedValue = Math.round(baseValue * marketFactor.factor);
  const difference = adjustedValue - baseValue;
  const diffPct = baseValue > 0 ? ((difference / baseValue) * 100) : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Marktfaktor-Bewertung</h3>
        {location && <span className="text-[10px] text-muted-foreground ml-auto">{location}</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[9px] text-muted-foreground">Basiswert</p>
          <p className="text-xs font-bold">{formatCurrency(baseValue)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[9px] text-muted-foreground">Marktfaktor</p>
          <p className={`text-xs font-bold ${
            marketFactor.trend === "up" ? "text-profit" :
            marketFactor.trend === "down" ? "text-loss" : ""
          }`}>
            {marketFactor.factor.toFixed(3)}x
          </p>
        </div>
        <div className="text-center p-2 rounded-lg bg-primary/10">
          <p className="text-[9px] text-muted-foreground">Marktwert</p>
          <p className="text-xs font-bold text-primary">{formatCurrency(adjustedValue)}</p>
        </div>
      </div>

      {/* Market condition indicator */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50">
        {marketFactor.trend === "up" ? (
          <TrendingUp className="h-3.5 w-3.5 text-profit" />
        ) : marketFactor.trend === "down" ? (
          <TrendingDown className="h-3.5 w-3.5 text-loss" />
        ) : (
          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <div className="flex-1">
          <p className="text-xs font-medium">{marketFactor.label}</p>
          <p className="text-[10px] text-muted-foreground">
            {difference >= 0 ? "+" : ""}{formatCurrency(difference)} ({diffPct >= 0 ? "+" : ""}{formatPercentDE(diffPct)})
          </p>
        </div>
        {marketData?.latestMortgage != null && (
          <Badge variant="outline" className="text-[9px] h-4">
            Zins: {formatPercentDE(marketData.latestMortgage)}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="mt-2 flex items-start gap-1.5 text-[9px] text-muted-foreground">
        <Info className="h-2.5 w-2.5 shrink-0 mt-0.5" />
        <span>Basiert auf aktuellem Zinsniveau und Markttrend. Keine Anlageberatung.</span>
      </div>
    </div>
  );
});
SchnellbewertungMarktfaktor.displayName = "SchnellbewertungMarktfaktor";

export { SchnellbewertungMarktfaktor };
