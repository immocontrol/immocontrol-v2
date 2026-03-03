import { useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AnnualSummaryCard = () => {
  const { properties, stats } = useProperties();

  const summary = useMemo(() => {
    if (properties.length === 0) return null;
    const annualRent = stats.totalRent * 12;
    const annualExpenses = properties.reduce((s, p) => s + p.monthlyExpenses * 12, 0);
    const annualCreditRates = properties.reduce((s, p) => s + p.monthlyCreditRate * 12, 0);
    const annualCashflow = stats.totalCashflow * 12;
    const totalTilgung = properties.reduce((s, p) => {
      const tilgung = p.monthlyCreditRate - (p.remainingDebt * p.interestRate / 100 / 12);
      return s + Math.max(0, tilgung) * 12;
    }, 0);
    const totalAppreciation = properties.reduce((s, p) => s + (p.currentValue - p.purchasePrice), 0);
    /* IMP-34-5: Fix operator precedence — parentheses clarify intended calculation order;
       guard against division by zero when properties.length is 0 */
    const avgHoldingYears = properties.length > 0
      ? properties.reduce((s, p) => {
          const years = (Date.now() - new Date(p.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          return s + Math.max(1, years);
        }, 0) / properties.length
      : 1;
    /* IMP-34-19: NaN guard on annualAppreciation — ensures finite result even with invalid dates */
    const rawAppreciation = totalAppreciation / Math.max(1, avgHoldingYears);
    const annualAppreciation = Number.isFinite(rawAppreciation) ? rawAppreciation : 0;
    const totalReturn = annualCashflow + totalTilgung + annualAppreciation;

    return {
      annualRent, annualExpenses, annualCreditRates, annualCashflow,
      totalTilgung, annualAppreciation, totalReturn,
    };
  }, [properties, stats]);

  if (!summary) return null;

  const items = [
    { label: "Jahres-Mieteinnahmen", value: summary.annualRent, type: "income" },
    { label: "Bewirtschaftungskosten", value: -summary.annualExpenses, type: "expense" },
    { label: "Kreditraten", value: -summary.annualCreditRates, type: "expense" },
    { label: "Netto-Cashflow", value: summary.annualCashflow, type: "result" },
    { label: "Tilgungsaufbau", value: summary.totalTilgung, type: "equity" },
    { label: "Wertzuwachs", value: summary.annualAppreciation, type: "equity" },
  ];

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" /> Jahresübersicht {new Date().getFullYear()}
      </h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className={`flex items-center justify-between text-xs ${item.type === "result" ? "border-t border-border pt-2 font-semibold" : ""}`}>
            <div className="flex items-center gap-2">
              {item.value > 0 ? <TrendingUp className="h-3 w-3 text-profit" /> :
               item.value < 0 ? <TrendingDown className="h-3 w-3 text-loss" /> :
               <Minus className="h-3 w-3 text-muted-foreground" />}
              <span className={item.type === "result" ? "" : "text-muted-foreground"}>{item.label}</span>
            </div>
            <span className={`tabular-nums ${item.value >= 0 ? "text-profit" : "text-loss"}`}>
              {item.value >= 0 ? "+" : ""}{formatCurrency(item.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 p-2 rounded-lg bg-primary/5 flex justify-between items-center text-xs font-semibold">
        <span className="flex items-center gap-1">
          Vermögensaufbau/Jahr
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] max-w-[200px]">
              Cashflow + Tilgung + Wertzuwachs = Gesamter jährlicher Vermögensaufbau
            </TooltipContent>
          </Tooltip>
        </span>
        <span className={summary.totalReturn >= 0 ? "text-profit" : "text-loss"}>
          {summary.totalReturn >= 0 ? "+" : ""}{formatCurrency(summary.totalReturn)}
        </span>
      </div>
    </div>
  );
};

export default AnnualSummaryCard;
