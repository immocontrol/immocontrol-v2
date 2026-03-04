/** NEW-18: Vermögensaufbau-Timeline (Persönliche Finanzplanung)
 * Shows a timeline visualization of wealth building through real estate investments. */
import { memo, useMemo, useState } from "react";
import { TrendingUp, Target, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TimelineProps {
  totalEquity: number;
  totalValue: number;
  totalDebt: number;
  monthlyCashflow: number;
  propertyCount: number;
  /** Average annual appreciation rate (default: 2%) */
  appreciationRate?: number;
}

interface Milestone {
  year: number;
  equity: number;
  value: number;
  debt: number;
  cashflow: number;
  label: string;
  reached: boolean;
}

const MILESTONES = [100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000];

const VermoegenTimeline = memo(({
  totalEquity,
  totalValue,
  totalDebt,
  monthlyCashflow,
  propertyCount,
  appreciationRate = 2,
}: TimelineProps) => {
  const [expanded, setExpanded] = useState(false);

  const projection = useMemo(() => {
    if (propertyCount === 0) return [];

    const years: Milestone[] = [];
    let equity = totalEquity;
    let value = totalValue;
    let debt = totalDebt;
    let annualCashflow = monthlyCashflow * 12;
    const aprRate = appreciationRate / 100;

    for (let y = 0; y <= 30; y++) {
      // Determine milestone label
      let label = `Jahr ${y}`;
      const nextMilestone = MILESTONES.find(m => m > equity - annualCashflow && m <= equity);
      if (nextMilestone) {
        label = `${formatCurrency(nextMilestone)} Eigenkapital`;
      }
      if (y === 0) label = "Heute";

      years.push({
        year: new Date().getFullYear() + y,
        equity: Math.round(equity),
        value: Math.round(value),
        debt: Math.round(Math.max(0, debt)),
        cashflow: Math.round(annualCashflow),
        label,
        reached: y === 0,
      });

      // Project forward
      value *= (1 + aprRate);
      // Assume ~2% annual debt reduction (Tilgung)
      const annualRepayment = debt * 0.02;
      debt -= annualRepayment;
      equity = value - Math.max(0, debt);
      // Cashflow grows slightly with appreciation
      // (Rent increases ~1.5% annually in Germany)
      annualCashflow *= 1.015;
    }

    return years;
  }, [totalEquity, totalValue, totalDebt, monthlyCashflow, propertyCount, appreciationRate]);

  if (propertyCount === 0) return null;

  const financialFreedomYear = projection.find(p => p.cashflow >= 3000 * 12);
  const millionYear = projection.find(p => p.equity >= 1000000);
  const displayItems = expanded ? projection : projection.slice(0, 6);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Vermögensaufbau-Timeline</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">{appreciationRate}% Wertsteigerung/Jahr</Badge>
      </div>

      {/* Key milestones */}
      <div className="grid grid-cols-2 gap-2">
        {millionYear && (
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-[10px] text-muted-foreground">1 Mio. € Eigenkapital</p>
            <p className="text-sm font-bold text-primary">{millionYear.year}</p>
            <p className="text-[10px] text-muted-foreground">in {millionYear.year - new Date().getFullYear()} Jahren</p>
          </div>
        )}
        {financialFreedomYear && (
          <div className="p-2 rounded-lg bg-profit/5 border border-profit/10">
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-profit" />
              <p className="text-[10px] text-muted-foreground">Finanzielle Freiheit</p>
            </div>
            <p className="text-sm font-bold text-profit">{financialFreedomYear.year}</p>
            <p className="text-[10px] text-muted-foreground">≥ 3.000 €/M Cashflow</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative space-y-0">
        {displayItems.map((item, idx) => (
          <div key={item.year} className="flex items-start gap-3 pb-3 last:pb-0">
            {/* Timeline line & dot */}
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                idx === 0 ? "bg-primary ring-2 ring-primary/30" :
                item.equity >= 1000000 ? "bg-profit ring-2 ring-profit/30" :
                "bg-border"
              }`} />
              {idx < displayItems.length - 1 && (
                <div className="w-px flex-1 min-h-[20px] bg-border" />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0 -mt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{item.year}</span>
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                <span>EK: {formatCurrency(item.equity)}</span>
                <span>Wert: {formatCurrency(item.value)}</span>
                {item.debt > 0 && <span>Schuld: {formatCurrency(item.debt)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {projection.length > 6 && (
        <Button variant="ghost" size="sm" className="w-full text-xs h-7 gap-1" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUp className="h-3 w-3" /> Weniger anzeigen</> : <><ChevronDown className="h-3 w-3" /> Alle 30 Jahre anzeigen</>}
        </Button>
      )}
    </div>
  );
});
VermoegenTimeline.displayName = "VermoegenTimeline";

export { VermoegenTimeline };
