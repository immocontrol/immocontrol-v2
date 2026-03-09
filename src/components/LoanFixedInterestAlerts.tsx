/**
 * IMP20-2: Zinsbindungs-Countdown + Live-Zinsmonitor Integration
 * Shows expiring fixed interest periods WITH current market rates for comparison.
 * When interest lock expires in <12 months, shows potential refinancing savings.
 */
import { Link } from "react-router-dom";
import { AlertTriangle, Calendar, Landmark, TrendingDown, RefreshCw, ChevronRight } from "lucide-react";
import { useMarketRates } from "@/hooks/useMarketRates";
import { ROUTES } from "@/lib/routes";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";

interface Loan {
  id: string;
  bank_name: string;
  remaining_balance: number;
  fixed_interest_until: string | null;
  interest_rate: number;
}

interface LoanFixedInterestAlertsProps {
  loans: Loan[];
  propertyNames?: Record<string, string>;
}

const LoanFixedInterestAlerts = ({ loans }: LoanFixedInterestAlertsProps) => {
  const now = new Date();
  const { data: marketData } = useMarketRates();

  const alerts = loans
    .filter(l => l.fixed_interest_until)
    .map(l => {
      const end = new Date(l.fixed_interest_until!);
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...l, days };
    })
    .filter(l => l.days <= 365 && l.days >= -30)
    .sort((a, b) => a.days - b.days);

  if (alerts.length === 0) return null;

  const currentMortgageRate = marketData?.latestMortgage ?? null;

  // IMP20-2: Calculate potential refinancing savings for each alert
  const alertsWithSavings = alerts.map(l => {
    if (currentMortgageRate === null || currentMortgageRate >= l.interest_rate) {
      return { ...l, monthlySaving: 0, annualSaving: 0, canSave: false };
    }
    const currentMonthlyInterest = (l.remaining_balance * l.interest_rate) / 100 / 12;
    const newMonthlyInterest = (l.remaining_balance * currentMortgageRate) / 100 / 12;
    const monthlySaving = currentMonthlyInterest - newMonthlyInterest;
    return { ...l, monthlySaving, annualSaving: monthlySaving * 12, canSave: monthlySaving > 10 };
  });

  const totalAnnualSavings = alertsWithSavings.reduce((s, a) => s + a.annualSaving, 0);

  return (
    <div className="gradient-card rounded-xl border border-gold/30 bg-gold/5 p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-gold" />
        <span className="text-sm font-semibold">Zinsbindung läuft ab</span>
        <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-medium">{alerts.length}</span>
        {/* IMP20-2: Show current market rate for comparison */}
        {currentMortgageRate !== null && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium ml-auto">
            Markt: {formatPercentDE(currentMortgageRate)}
          </span>
        )}
      </div>

      {/* IMP20-2: Refinancing savings summary */}
      {totalAnnualSavings > 50 && (
        <div className="mb-3 p-2.5 rounded-lg bg-profit/10 border border-profit/20 flex flex-wrap items-center gap-2">
          <TrendingDown className="h-3.5 w-3.5 text-profit shrink-0" />
          <p className="text-[10px] font-medium text-profit flex-1 min-w-0">
            Bei Refinanzierung zum Marktzins: ~{formatCurrency(totalAnnualSavings)}/Jahr Ersparnis möglich
          </p>
          <Link
            to={ROUTES.REFINANZIERUNG}
            className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5 font-medium touch-target min-h-[36px] items-center"
            aria-label="Refinanzierung prüfen"
          >
            Szenario prüfen <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {alertsWithSavings.map(l => (
          <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50">
            <Landmark className="h-3.5 w-3.5 text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{l.bank_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(l.remaining_balance)} · {l.interest_rate}%
                {/* IMP20-2: Show savings potential per loan */}
                {l.canSave && (
                  <span className="ml-1.5 text-profit font-medium">
                    → {currentMortgageRate !== null ? formatPercentDE(currentMortgageRate) : "–"} = -{formatCurrency(l.monthlySaving)}/M
                  </span>
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-[10px] font-medium ${l.days < 0 ? "text-loss" : l.days <= 90 ? "text-loss" : "text-gold"}`}>
                {l.days < 0 ? `${Math.abs(l.days)}d abgelaufen` : `in ${l.days}d`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(l.fixed_interest_until!).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoanFixedInterestAlerts;
