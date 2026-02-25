import { useState, useMemo } from "react";
import { AlertTriangle, ShieldCheck, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const MortgageStressTest = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [vacancyPct, setVacancyPct] = useState(20);
  const [rateIncrease, setRateIncrease] = useState(2);
  const [expenseIncrease, setExpenseIncrease] = useState(10);

  const { data: loans = [] } = useQuery({
    queryKey: ["stress_loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const stressResult = useMemo(() => {
    const totalRent = properties.reduce((s, p) => s + p.monthlyRent, 0);
    const totalExpenses = properties.reduce((s, p) => s + p.monthlyExpenses, 0);
    const totalCreditRate = properties.reduce((s, p) => s + p.monthlyCreditRate, 0);

    // Normal scenario
    const normalCashflow = totalRent - totalExpenses - totalCreditRate;

    // Stressed scenario
    const stressedRent = totalRent * (1 - vacancyPct / 100);
    const stressedExpenses = totalExpenses * (1 + expenseIncrease / 100);
    // Recalculate credit rates with higher interest
    const stressedCreditRate = loans.reduce((s, l) => {
      const newRate = Number(l.interest_rate) + rateIncrease;
      return s + (Number(l.remaining_balance) * (newRate + Number(l.repayment_rate)) / 100 / 12);
    }, 0);
    const stressedCashflow = stressedRent - stressedExpenses - (loans.length > 0 ? stressedCreditRate : totalCreditRate);
    const dscr = stressedCreditRate > 0 ? (stressedRent - stressedExpenses) / stressedCreditRate : 0;

    return { normalCashflow, stressedCashflow, stressedRent, stressedExpenses, stressedCreditRate, dscr, totalRent };
  }, [properties, loans, vacancyPct, rateIncrease, expenseIncrease]);

  if (properties.length === 0) return null;

  const survives = stressResult.stressedCashflow >= 0;

  return (
    <div className={`gradient-card rounded-xl border p-5 ${survives ? "border-profit/20" : "border-loss/20"}`}>
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" /> Belastungstest
      </h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-muted-foreground">Leerstand</label>
          <div className="flex items-center gap-1">
            <input type="range" min={0} max={50} value={vacancyPct} onChange={e => setVacancyPct(+e.target.value)}
              className="flex-1 h-1.5 accent-primary" />
            <span className="text-xs font-medium w-10 text-right">{vacancyPct}%</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Zinsanstieg</label>
          <div className="flex items-center gap-1">
            <input type="range" min={0} max={5} step={0.5} value={rateIncrease} onChange={e => setRateIncrease(+e.target.value)}
              className="flex-1 h-1.5 accent-primary" />
            <span className="text-xs font-medium w-10 text-right">+{rateIncrease}%</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Kostenanstieg</label>
          <div className="flex items-center gap-1">
            <input type="range" min={0} max={30} step={5} value={expenseIncrease} onChange={e => setExpenseIncrease(+e.target.value)}
              className="flex-1 h-1.5 accent-primary" />
            <span className="text-xs font-medium w-10 text-right">+{expenseIncrease}%</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <p className="text-[10px] text-muted-foreground">Normal-Cashflow</p>
          <p className={`text-sm font-bold ${stressResult.normalCashflow >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrency(stressResult.normalCashflow)}/M
          </p>
        </div>
        <div className={`p-3 rounded-lg text-center ${survives ? "bg-profit/10" : "bg-loss/10"}`}>
          <p className="text-[10px] text-muted-foreground">Stress-Cashflow</p>
          <p className={`text-sm font-bold ${survives ? "text-profit" : "text-loss"}`}>
            {formatCurrency(stressResult.stressedCashflow)}/M
          </p>
        </div>
      </div>
      <div className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium ${survives ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
        {survives ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {survives
          ? `Portfolio übersteht Stress-Szenario (DSCR: ${stressResult.dscr.toFixed(2)}x)`
          : `Portfolio ist im Stress-Szenario negativ! DSCR: ${stressResult.dscr.toFixed(2)}x`}
      </div>
    </div>
  );
};

export default MortgageStressTest;