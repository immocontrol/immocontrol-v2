import { useMemo } from "react";
import { Flame } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";

interface Property {
  id: string;
  name: string;
  purchasePrice: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCreditRate: number;
}

interface YieldHeatmapProps {
  properties: Property[];
}

const getHeatColor = (yield_: number): string => {
  if (yield_ >= 6) return "bg-profit text-white";
  if (yield_ >= 5) return "bg-profit/70 text-profit-foreground";
  if (yield_ >= 4) return "bg-gold/60 text-foreground";
  if (yield_ >= 3) return "bg-gold/30 text-foreground";
  if (yield_ >= 2) return "bg-loss/30 text-foreground";
  return "bg-loss/60 text-white";
};

const YieldHeatmap = ({ properties }: YieldHeatmapProps) => {
  const data = useMemo(() =>
    properties
      .map(p => ({
        ...p,
        brutto: p.purchasePrice > 0 ? (p.monthlyRent * 12 / p.purchasePrice) * 100 : 0,
        netto: p.purchasePrice > 0 ? ((p.monthlyRent - p.monthlyExpenses) * 12 / p.purchasePrice) * 100 : 0,
        cashflow: p.monthlyRent - p.monthlyExpenses - p.monthlyCreditRate,
      }))
      .sort((a, b) => b.brutto - a.brutto),
    [properties]
  );

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Rendite-Heatmap</span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-3 h-3 rounded bg-loss/60 inline-block" /> &lt;2%
          <span className="w-3 h-3 rounded bg-gold/30 inline-block ml-1" /> 3-4%
          <span className="w-3 h-3 rounded bg-profit inline-block ml-1" /> ≥6%
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {data.map(p => (
          <Tooltip key={p.id}>
            <TooltipTrigger asChild>
              <div className={`rounded-lg p-3 cursor-default transition-transform hover:scale-105 ${getHeatColor(p.brutto)}`}>
                <p className="text-[11px] font-semibold truncate">{p.name}</p>
                <p className="text-lg font-bold mt-0.5">{p.brutto.toFixed(1)}%</p>
                <p className="text-[10px] opacity-80">Brutto</p>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs space-y-1">
              <p className="font-semibold">{p.name}</p>
              <p>Brutto-Rendite: {p.brutto.toFixed(2)}%</p>
              <p>Netto-Rendite: {p.netto.toFixed(2)}%</p>
              <p>Cashflow: {formatCurrency(p.cashflow)}/M</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default YieldHeatmap;
