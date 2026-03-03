/**
 * #1: Live-Zinsmonitor Widget — EURIBOR 3M + Baufinanzierung 10J
 * Data from ECB and Bundesbank APIs (free, no auth required)
 */
import { TrendingUp, TrendingDown, Minus, RefreshCw, Landmark, BarChart3 } from "lucide-react";
import { useMarketRates } from "@/hooks/useMarketRates";
import { formatPercentDE } from "@/lib/formatters";

export function InterestRateMonitor() {
  const { data, isLoading, refetch, isFetching } = useMarketRates();

  if (isLoading) {
    return (
      <div className="gradient-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Zinsmonitor</h3>
        </div>
        <div className="space-y-3">
          <div className="h-16 skeleton-wave rounded-lg" />
          <div className="h-16 skeleton-wave rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const euriborHistory = data.euribor3m;
  const mortgageHistory = data.mortgageRate;

  const euriborChange = euriborHistory.length >= 2
    ? euriborHistory[euriborHistory.length - 1].rate - euriborHistory[euriborHistory.length - 2].rate
    : 0;
  const mortgageChange = mortgageHistory.length >= 2
    ? mortgageHistory[mortgageHistory.length - 1].rate - mortgageHistory[mortgageHistory.length - 2].rate
    : 0;

  const TrendIcon = ({ change }: { change: number }) => {
    if (change > 0.05) return <TrendingUp className="h-3.5 w-3.5 text-loss" />;
    if (change < -0.05) return <TrendingDown className="h-3.5 w-3.5 text-profit" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const trendColor = (change: number) => {
    if (change > 0.05) return "text-loss";
    if (change < -0.05) return "text-profit";
    return "text-muted-foreground";
  };

  // Mini sparkline
  const Sparkline = ({ points, color }: { points: { rate: number }[]; color: string }) => {
    if (points.length < 2) return null;
    const rates = points.map(p => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const range = max - min || 1;
    const w = 120;
    const h = 32;
    const step = w / (rates.length - 1);
    const pathPoints = rates.map((r, i) => `${i * step},${h - ((r - min) / range) * h}`);
    return (
      <svg width={w} height={h} className="shrink-0">
        <polyline
          points={pathPoints.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          Zinsmonitor
        </h3>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1 rounded-md hover:bg-secondary transition-colors"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-3">
        {/* EURIBOR 3M */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">EURIBOR 3M</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold tabular-nums">
                {data.latestEuribor !== null ? formatPercentDE(data.latestEuribor) : "–"}
              </span>
              {euriborHistory.length >= 2 && (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${trendColor(euriborChange)}`}>
                  <TrendIcon change={euriborChange} />
                  {euriborChange >= 0 ? "+" : ""}{euriborChange.toFixed(2).replace(".", ",")}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {euriborHistory.length > 0 ? euriborHistory[euriborHistory.length - 1].date : ""}
              {" · EZB"}
            </p>
          </div>
          <Sparkline points={euriborHistory.slice(-12)} color="hsl(var(--primary))" />
        </div>

        {/* Baufinanzierung 5-10J */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Baufinanzierung 10J</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold tabular-nums">
                {data.latestMortgage !== null ? formatPercentDE(data.latestMortgage) : "–"}
              </span>
              {mortgageHistory.length >= 2 && (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${trendColor(mortgageChange)}`}>
                  <TrendIcon change={mortgageChange} />
                  {mortgageChange >= 0 ? "+" : ""}{mortgageChange.toFixed(2).replace(".", ",")}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {mortgageHistory.length > 0 ? mortgageHistory[mortgageHistory.length - 1].date : ""}
              {" · Bundesbank"}
            </p>
          </div>
          <Sparkline points={mortgageHistory.slice(-12)} color="hsl(var(--chart-2))" />
        </div>
      </div>

      {/* 24-month trend */}
      {(euriborHistory.length > 6 || mortgageHistory.length > 6) && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-2">
            <BarChart3 className="h-3 w-3" /> 24-Monats-Trend
          </p>
          <div className="flex gap-4 text-[10px]">
            {euriborHistory.length > 6 && (
              <div>
                <span className="text-muted-foreground">EURIBOR: </span>
                <span className="font-medium">
                  {formatPercentDE(euriborHistory[0].rate)} → {formatPercentDE(euriborHistory[euriborHistory.length - 1].rate)}
                </span>
              </div>
            )}
            {mortgageHistory.length > 6 && (
              <div>
                <span className="text-muted-foreground">Baufin.: </span>
                <span className="font-medium">
                  {formatPercentDE(mortgageHistory[0].rate)} → {formatPercentDE(mortgageHistory[mortgageHistory.length - 1].rate)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InterestRateMonitor;
