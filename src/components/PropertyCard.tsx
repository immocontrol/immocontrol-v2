import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Home, TrendingUp, ChevronRight, Percent, Wallet, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface PropertyCardProps {
  id: string;
  name: string;
  location: string;
  type: string;
  units: number;
  purchasePrice: number;
  currentValue: number;
  monthlyRent: number;
  monthlyCashflow: number;
  monthlyExpenses?: number;
  monthlyCreditRate?: number;
  remainingDebt?: number;
  sqm?: number;
  ownership?: string;
  imageUrl?: string;
  delay?: number;
  yearBuilt?: number;
}

const PropertyCard = memo(({
  id,
  name,
  location: loc,
  type,
  units,
  purchasePrice,
  currentValue,
  monthlyRent,
  monthlyCashflow,
  monthlyExpenses = 0,
  monthlyCreditRate = 0,
  remainingDebt = 0,
  sqm,
  ownership,
  delay = 0,
  yearBuilt,
}: PropertyCardProps) => {
  /* NEW-61: Memoize all derived calculations to prevent re-computation on parent re-renders */
  const metrics = useMemo(() => {
    const appreciation = purchasePrice > 0 ? ((currentValue - purchasePrice) / purchasePrice) * 100 : 0;
    const pricePerSqm = sqm && sqm > 0 ? currentValue / sqm : null;
    const bruttoRendite = purchasePrice > 0 ? ((monthlyRent * 12) / purchasePrice) * 100 : 0;
    const ltv = currentValue > 0 ? (remainingDebt / currentValue) * 100 : 0;
    const expenseRatio = monthlyRent > 0 ? ((monthlyExpenses + monthlyCreditRate) / monthlyRent) * 100 : 0;
    /* NEW-62: Net yield after expenses */
    const nettoRendite = purchasePrice > 0 ? (((monthlyRent - monthlyExpenses) * 12) / purchasePrice) * 100 : 0;
    return { appreciation, pricePerSqm, bruttoRendite, ltv, expenseRatio, nettoRendite };
  }, [purchasePrice, currentValue, monthlyRent, sqm, remainingDebt, monthlyExpenses, monthlyCreditRate]);

  const { appreciation, pricePerSqm, bruttoRendite, ltv, expenseRatio } = metrics;

  return (
    <Link
      to={`/objekt/${id}`}
      className="block gradient-card rounded-xl border border-border p-4 hover:border-primary/30 hover-lift group animate-fade-in transition-all duration-300 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      style={{ animationDelay: `${delay}ms` }}
      aria-label={`${name} – ${loc} – Cashflow ${formatCurrency(monthlyCashflow)}/M`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate min-w-0 flex-1 pr-1 leading-tight">
              {name}
            </h3>
            {ownership && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                ownership === "egbr" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"
              }`}>
                {ownership === "egbr" ? "eGbR" : "Privat"}
              </span>
            )}
            {ltv > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                ltv <= 60 ? "bg-profit/10 text-profit" : ltv <= 80 ? "bg-gold/10 text-gold" : "bg-loss/10 text-loss"
              }`}>
                LTV {ltv.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3" />
            {loc}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md">
          {type}
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Home className="h-3 w-3" /> {units} {units === 1 ? "Einheit" : "Einheiten"}
        </span>
        {pricePerSqm && (
          <span className="text-xs text-muted-foreground">
            · {formatCurrency(pricePerSqm)}/m²
          </span>
        )}
        {/* NEW-63: Show building year if available */}
        {yearBuilt && yearBuilt > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Calendar className="h-3 w-3" /> {yearBuilt}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Wert</div>
          <div className="font-semibold">{formatCurrency(currentValue)}</div>
          <div className={`text-xs flex items-center gap-0.5 ${appreciation >= 0 ? "text-profit" : "text-loss"}`}>
            <TrendingUp className="h-3 w-3" />
            {appreciation >= 0 ? "+" : ""}{appreciation.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Miete/M</div>
          <div className="font-semibold">{formatCurrency(monthlyRent)}</div>
          {/* Improvement 1: Annual rent */}
          <div className="text-xs text-muted-foreground">{formatCurrency(monthlyRent * 12)}/J</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Cashflow/M</div>
          <div className={`font-semibold ${monthlyCashflow >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrency(monthlyCashflow)}
          </div>
          {monthlyRent > 0 && (
            <div className="h-1 mt-1 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${monthlyCashflow >= 0 ? "bg-profit" : "bg-loss"}`}
                style={{ width: `${Math.min(100, Math.abs(monthlyCashflow / monthlyRent) * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Rendite</div>
          <div className={`font-semibold flex items-center gap-0.5 ${bruttoRendite >= 5 ? "text-profit" : bruttoRendite >= 3 ? "text-gold" : "text-loss"}`}>
            <Percent className="h-3 w-3" />
            {bruttoRendite.toFixed(1)}%
          </div>
          {remainingDebt > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Schuld: {(remainingDebt / 1000).toFixed(0)}k
            </div>
          )}
        </div>
      </div>

      {/* Improvement 2: Expense ratio bar */}
      {monthlyRent > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span className="flex items-center gap-0.5"><Wallet className="h-2.5 w-2.5" /> Kostenquote</span>
            <span className={expenseRatio > 100 ? "text-loss font-medium" : ""}>{expenseRatio.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${expenseRatio > 100 ? "bg-loss" : expenseRatio > 80 ? "bg-gold" : "bg-profit"}`}
              style={{ width: `${Math.min(100, expenseRatio)}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
});

PropertyCard.displayName = "PropertyCard";

export default PropertyCard;
