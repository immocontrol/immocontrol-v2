import { useMemo } from "react";
import { Scale, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface DebtEquityWidgetProps {
  totalValue: number;
  totalDebt: number;
  equity: number;
}

const DebtEquityWidget = ({ totalValue, totalDebt, equity }: DebtEquityWidgetProps) => {
  const ltv = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;
  const deRatio = equity > 0 ? totalDebt / equity : 0;

  const ltvColor = ltv <= 60 ? "text-profit" : ltv <= 80 ? "text-gold" : "text-loss";
  const ltvBg = ltv <= 60 ? "bg-profit" : ltv <= 80 ? "bg-gold" : "bg-loss";

  const deLabel = deRatio <= 1 ? "Konservativ" : deRatio <= 2 ? "Moderat" : "Aggressiv";
  const deColor = deRatio <= 1 ? "text-profit" : deRatio <= 2 ? "text-gold" : "text-loss";

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Fremdkapitalquote</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">LTV</p>
          <p className={`text-2xl font-bold ${ltvColor}`}>{ltv.toFixed(1)}%</p>
          <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${ltvBg}`} style={{ width: `${Math.min(ltv, 100)}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Ziel: ≤60%</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Schulden/EK</p>
          <p className={`text-2xl font-bold ${deColor}`}>{deRatio.toFixed(2)}x</p>
          <p className={`text-xs font-medium mt-1 ${deColor}`}>{deLabel}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{formatCurrency(equity)} EK</p>
        </div>
      </div>
    </div>
  );
};

export default DebtEquityWidget;
