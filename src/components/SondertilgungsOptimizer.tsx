/**
 * IMP20-15: Sondertilgungs-Optimierer
 * In Loans: Calculate when/how much extra payment saves interest.
 * Based on cashflow surplus + remaining term.
 */
import { memo, useMemo, useState } from "react";
import { Calculator, TrendingDown, Euro, Sliders } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/formatters";

interface Loan {
  id: string;
  bank_name: string;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
  loan_amount: number;
  property_id?: string;
}

interface SondertilgungsOptimizerProps {
  loans: Loan[];
  monthlyCashflowSurplus?: number;
}

interface SondertilgungResult {
  loanId: string;
  bankName: string;
  optimalAmount: number;
  interestSaved: number;
  monthsSaved: number;
  remainingAfter: number;
}

const SondertilgungsOptimizer = memo(({ loans, monthlyCashflowSurplus = 0 }: SondertilgungsOptimizerProps) => {
  const [extraPaymentPct, setExtraPaymentPct] = useState(50); // % of surplus to use

  const results = useMemo((): SondertilgungResult[] => {
    const availableSurplus = monthlyCashflowSurplus * 12 * (extraPaymentPct / 100);
    if (availableSurplus <= 0 || loans.length === 0) return [];

    // Prioritize highest interest rate loans first (avalanche method)
    const sorted = [...loans]
      .filter(l => l.remaining_balance > 0 && l.interest_rate > 0)
      .sort((a, b) => b.interest_rate - a.interest_rate);

    let remaining = availableSurplus;
    return sorted.map(loan => {
      const maxSondertilgung = Math.min(remaining, loan.remaining_balance * 0.05); // Usually max 5% p.a.
      remaining -= maxSondertilgung;

      // Calculate interest saved
      const monthlyRate = loan.interest_rate / 100 / 12;
      const monthsRemaining = monthlyRate > 0
        ? Math.ceil(-Math.log(1 - (loan.remaining_balance * monthlyRate) / loan.monthly_payment) / Math.log(1 + monthlyRate))
        : 0;
      const newBalance = loan.remaining_balance - maxSondertilgung;
      const newMonthsRemaining = monthlyRate > 0 && newBalance > 0
        ? Math.ceil(-Math.log(1 - (newBalance * monthlyRate) / loan.monthly_payment) / Math.log(1 + monthlyRate))
        : 0;
      const monthsSaved = Math.max(0, Number.isFinite(monthsRemaining) ? monthsRemaining : 0) - Math.max(0, Number.isFinite(newMonthsRemaining) ? newMonthsRemaining : 0);
      const interestSaved = maxSondertilgung * (loan.interest_rate / 100) * (monthsSaved / 12);

      return {
        loanId: loan.id,
        bankName: loan.bank_name,
        optimalAmount: Math.round(maxSondertilgung),
        interestSaved: Math.round(Math.max(0, Number.isFinite(interestSaved) ? interestSaved : 0)),
        monthsSaved: Math.max(0, Number.isFinite(monthsSaved) ? monthsSaved : 0),
        remainingAfter: Math.round(newBalance),
      };
    }).filter(r => r.optimalAmount > 0);
  }, [loans, monthlyCashflowSurplus, extraPaymentPct]);

  const totalSaved = results.reduce((s, r) => s + r.interestSaved, 0);
  const totalExtra = results.reduce((s, r) => s + r.optimalAmount, 0);

  if (loans.length === 0 || monthlyCashflowSurplus <= 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Sondertilgungs-Optimierer</h3>
        {totalSaved > 0 && (
          <Badge className="text-[10px] h-5 bg-profit/20 text-profit ml-auto">
            ~{formatCurrency(totalSaved)} Zinsen sparen
          </Badge>
        )}
      </div>

      {/* Slider for % of surplus */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Cashflow-Überschuss nutzen</span>
          <span className="font-medium">{extraPaymentPct}% = {formatCurrency(monthlyCashflowSurplus * 12 * extraPaymentPct / 100)}/Jahr</span>
        </div>
        <Slider
          value={[extraPaymentPct]}
          onValueChange={([v]) => setExtraPaymentPct(v)}
          min={10}
          max={100}
          step={10}
          className="w-full"
        />
      </div>

      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map(r => (
            <div key={r.loanId} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50">
              <Euro className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{r.bankName}</p>
                <p className="text-[10px] text-muted-foreground">
                  Sondertilgung: {formatCurrency(r.optimalAmount)}
                  {r.monthsSaved > 0 && <span className="text-profit ml-1">({r.monthsSaved} Monate früher fertig)</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-medium text-profit">-{formatCurrency(r.interestSaved)}</p>
                <p className="text-[9px] text-muted-foreground">Zinsen gespart</p>
              </div>
            </div>
          ))}
          {totalExtra > 0 && (
            <div className="text-center text-[10px] text-muted-foreground pt-1">
              Gesamt: {formatCurrency(totalExtra)} Sondertilgung → ~{formatCurrency(totalSaved)} weniger Zinsen
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Kein optimaler Sondertilgungs-Betrag berechenbar
        </p>
      )}
    </div>
  );
});
SondertilgungsOptimizer.displayName = "SondertilgungsOptimizer";

export { SondertilgungsOptimizer };
