import { useState, useMemo } from "react";
import { RefreshCw, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

const LoanRefinancingCalc = () => {
  const { user } = useAuth();
  const [newRate, setNewRate] = useState(3.5);

  const { data: loans = [] } = useQuery({
    queryKey: ["refinancing_loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const analysis = useMemo(() => {
    if (loans.length === 0) return null;
    const results = loans.map(l => {
      const currentMonthlyInterest = Number(l.remaining_balance) * Number(l.interest_rate) / 100 / 12;
      const newMonthlyInterest = Number(l.remaining_balance) * newRate / 100 / 12;
      const monthlySavings = currentMonthlyInterest - newMonthlyInterest;
      const annualSavings = monthlySavings * 12;
      return {
        id: l.id,
        bankName: l.bank_name,
        balance: Number(l.remaining_balance),
        currentRate: Number(l.interest_rate),
        monthlySavings,
        annualSavings,
        worthIt: monthlySavings > 50,
      };
    }).filter(r => r.currentRate > newRate);

    const totalMonthlySavings = results.reduce((s, r) => s + r.monthlySavings, 0);
    const totalAnnualSavings = results.reduce((s, r) => s + r.annualSavings, 0);
    return { results, totalMonthlySavings, totalAnnualSavings };
  }, [loans, newRate]);

  if (!analysis || loans.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <RefreshCw className="h-4 w-4 text-muted-foreground" /> Umschuldungs-Rechner
      </h3>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Neuer Zinssatz:</label>
        <input type="number" step="0.1" value={newRate} onChange={e => setNewRate(+e.target.value)}
          className="h-8 w-24 text-xs rounded-lg border border-border bg-background px-2" />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      {analysis.results.length === 0 ? (
        <p className="text-xs text-muted-foreground">Kein Darlehen mit höherem Zinssatz gefunden.</p>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {analysis.results.map(r => (
              <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/30">
                <div>
                  <span className="font-medium">{r.bankName}</span>
                  <span className="text-muted-foreground ml-2">{r.currentRate}% → {newRate}%</span>
                </div>
                <span className={`font-semibold ${r.worthIt ? "text-profit" : "text-muted-foreground"}`}>
                  {r.worthIt && <TrendingDown className="h-3 w-3 inline mr-0.5" />}
                  {formatCurrency(r.monthlySavings)}/M
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-xs font-semibold">
            <span>Gesamtersparnis</span>
            <span className="text-profit">{formatCurrency(analysis.totalAnnualSavings)}/Jahr</span>
          </div>
        </>
      )}
    </div>
  );
};

export default LoanRefinancingCalc;