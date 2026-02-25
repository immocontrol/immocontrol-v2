import { useMemo } from "react";
import { Activity, TrendingUp, Shield, AlertTriangle } from "lucide-react";

interface Props {
  totalValue: number;
  totalDebt: number;
  totalCashflow: number;
  totalRent: number;
  totalExpenses: number;
  totalCreditRate: number;
  vacancyRate: number;
  propertyCount: number;
}

export default function PortfolioHealthScore({
  totalValue, totalDebt, totalCashflow, totalRent, totalExpenses, totalCreditRate, vacancyRate, propertyCount,
}: Props) {
  const score = useMemo(() => {
    if (propertyCount === 0) return 0;
    let s = 50;
    // LTV score (0-25)
    const ltv = totalValue > 0 ? totalDebt / totalValue : 1;
    if (ltv <= 0.5) s += 25;
    else if (ltv <= 0.7) s += 15;
    else if (ltv <= 0.85) s += 5;
    else s -= 10;
    // Cashflow score (0-25)
    if (totalCashflow > 0) s += Math.min(25, totalCashflow / 100);
    else s -= 10;
    // DSCR score (0-15)
    const dscr = totalCreditRate > 0 ? (totalRent - totalExpenses) / totalCreditRate : 2;
    if (dscr >= 1.5) s += 15;
    else if (dscr >= 1.2) s += 10;
    else if (dscr >= 1.0) s += 5;
    else s -= 5;
    // Vacancy (0-10)
    if (vacancyRate <= 5) s += 10;
    else if (vacancyRate <= 15) s += 5;
    else s -= 5;
    // Diversification
    if (propertyCount >= 3) s += 5;
    return Math.min(100, Math.max(0, Math.round(s)));
  }, [totalValue, totalDebt, totalCashflow, totalRent, totalExpenses, totalCreditRate, vacancyRate, propertyCount]);

  const color = score >= 75 ? "text-profit" : score >= 50 ? "text-gold" : "text-loss";
  const bgColor = score >= 75 ? "bg-profit" : score >= 50 ? "bg-gold" : "bg-loss";
  const label = score >= 80 ? "Ausgezeichnet" : score >= 60 ? "Gut" : score >= 40 ? "Befriedigend" : "Verbesserungsbedarf";
  const Icon = score >= 75 ? Shield : score >= 50 ? TrendingUp : AlertTriangle;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio-Gesundheit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className={`text-sm font-bold ${color}`}>{label}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className={`text-3xl font-bold tabular-nums ${color}`}>{score}</div>
        <div className="flex-1">
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full ${bgColor} rounded-full transition-all duration-1000`} style={{ width: `${score}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
