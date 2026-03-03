/**
 * #1: Live-Zinsmonitor Widget — EURIBOR 3M + Baufinanzierung 10J
 * Data from ECB and Bundesbank APIs (free, no auth required)
 * 20-year history chart with interactive hover tooltips
 */
import { useState, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Landmark, BarChart3 } from "lucide-react";
import { useMarketRates } from "@/hooks/useMarketRates";
import { formatPercentDE } from "@/lib/formatters";

interface HoverInfo {
  x: number;
  y: number;
  date: string;
  rate: number;
}

/* Extracted as a standalone component to avoid Rules of Hooks violation */
function HistoryChartInner({ euribor, mortgage, hover, setHover, svgRef }: {
  euribor: { date: string; rate: number }[];
  mortgage: { date: string; rate: number }[];
  hover: HoverInfo | null;
  setHover: (h: HoverInfo | null) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const w = 480;
  const h = 180;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const allRates = [...euribor.map(p => p.rate), ...mortgage.map(p => p.rate)];
  const minRate = Math.min(...allRates);
  const maxRate = Math.max(...allRates);
  const range = maxRate - minRate || 1;
  const padded = range * 0.1;
  const yMin = minRate - padded;
  const yMax = maxRate + padded;
  const yRange = yMax - yMin;

  const toPath = (points: { rate: number }[]) => {
    if (points.length < 2) return "";
    const step = chartW / (points.length - 1);
    return points.map((p, i) => {
      const x = padL + i * step;
      const y = padT + chartH - ((p.rate - yMin) / yRange) * chartH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };

  const yTicks: number[] = [];
  const tickStep = yRange > 4 ? 1 : yRange > 2 ? 0.5 : 0.25;
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) {
    yTicks.push(v);
  }

  const longerSeries = euribor.length >= mortgage.length ? euribor : mortgage;
  const yearInterval = longerSeries.length > 180 ? 5 : longerSeries.length > 60 ? 2 : 1;
  const xLabels: { x: number; label: string }[] = [];
  const xStep = chartW / Math.max(longerSeries.length - 1, 1);
  let lastYear = "";
  longerSeries.forEach((p, i) => {
    const year = p.date.slice(0, 4);
    if (year !== lastYear && parseInt(year) % yearInterval === 0) {
      xLabels.push({ x: padL + i * xStep, label: year });
      lastYear = year;
    }
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || longerSeries.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * w - padL;
    const step = chartW / (longerSeries.length - 1);
    const idx = Math.round(svgX / step);
    const clampedIdx = Math.max(0, Math.min(idx, longerSeries.length - 1));
    const point = longerSeries[clampedIdx];
    const px = padL + clampedIdx * step;
    const py = padT + chartH - ((point.rate - yMin) / yRange) * chartH;
    setHover({ x: px, y: py, date: point.date, rate: point.rate });
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto"
      onMouseLeave={() => setHover(null)}
      onMouseMove={handleMouseMove}
    >
      {yTicks.map(v => {
        const y = padT + chartH - ((v - yMin) / yRange) * chartH;
        return (
          <g key={`y-${v}`}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="8" fontFamily="system-ui">
              {v.toFixed(1)}%
            </text>
          </g>
        );
      })}
      {xLabels.map(({ x, label }) => (
        <text key={`x-${label}-${x}`} x={x} y={h - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="8" fontFamily="system-ui">
          {label}
        </text>
      ))}
      {euribor.length >= 2 && (
        <path d={toPath(euribor)} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {mortgage.length >= 2 && (
        <path d={toPath(mortgage)} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {hover && (
        <>
          <line x1={hover.x} y1={padT} x2={hover.x} y2={padT + chartH} stroke="hsl(var(--foreground))" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
          <circle cx={hover.x} cy={hover.y} r="3.5" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
          <rect
            x={hover.x > w / 2 ? hover.x - 100 : hover.x + 8}
            y={Math.max(padT, hover.y - 28)}
            width="92"
            height="24"
            rx="4"
            fill="hsl(var(--popover))"
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
          />
          <text
            x={hover.x > w / 2 ? hover.x - 54 : hover.x + 54}
            y={Math.max(padT + 12, hover.y - 18)}
            textAnchor="middle"
            className="fill-foreground"
            fontSize="9"
            fontWeight="600"
            fontFamily="system-ui"
          >
            {hover.date} · {hover.rate.toFixed(2).replace(".", ",")}%
          </text>
        </>
      )}
    </svg>
  );
}

export function InterestRateMonitor() {
  const { data, isLoading, refetch, isFetching } = useMarketRates();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

      {/* Current rates */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* EURIBOR 3M */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
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

        {/* Baufinanzierung 10J */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
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
      </div>

      {/* 20-year interactive chart */}
      {(euriborHistory.length > 6 || mortgageHistory.length > 6) && (
        <div className="border-t border-border/50 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> 20-Jahres-Verlauf
            </p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-primary rounded-full inline-block" /> EURIBOR
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: "hsl(var(--chart-2))" }} /> Baufin.
              </span>
            </div>
          </div>
          <HistoryChartInner euribor={euriborHistory} mortgage={mortgageHistory} hover={hover} setHover={setHover} svgRef={svgRef} />
          <div className="flex gap-4 text-[10px] mt-1">
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
