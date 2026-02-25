import { useMemo } from "react";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

const BudgetVsActual = () => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();

  const { data: payments = [] } = useQuery({
    queryKey: ["budget_vs_actual"],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from("rent_payments")
        .select("amount, status, due_date")
        .gte("due_date", `${year}-01-01`)
        .lte("due_date", `${year}-12-31`);
      return data || [];
    },
    enabled: !!user,
  });

  const data = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    
    const budgetRent = stats.totalRent * currentMonth;
    const actualRent = payments.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0);
    
    const budgetExpenses = properties.reduce((s, p) => s + p.monthlyExpenses, 0) * currentMonth;
    const budgetCashflow = stats.totalCashflow * currentMonth;
    const actualCashflow = actualRent - budgetExpenses;

    return {
      budgetRent,
      actualRent,
      rentDiff: actualRent - budgetRent,
      rentPct: budgetRent > 0 ? (actualRent / budgetRent * 100) : 0,
      budgetCashflow,
      actualCashflow,
      cashflowDiff: actualCashflow - budgetCashflow,
      currentMonth,
    };
  }, [payments, stats, properties]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-1">Budget vs. Ist ({new Date().getFullYear()})</h3>
      <p className="text-[10px] text-muted-foreground mb-3">Stand: {data.currentMonth} Monate</p>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Mieteinnahmen</span>
            <span className={`font-medium ${data.rentDiff >= 0 ? "text-profit" : "text-loss"}`}>
              {data.rentPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.rentPct >= 90 ? "bg-profit" : data.rentPct >= 70 ? "bg-gold" : "bg-loss"}`}
              style={{ width: `${Math.min(100, data.rentPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Soll: {formatCurrency(data.budgetRent)}</span>
            <span>Ist: {formatCurrency(data.actualRent)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground">Soll-Cashflow</p>
            <p className="text-sm font-bold">{formatCurrency(data.budgetCashflow)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Ist-Cashflow</p>
            <p className={`text-sm font-bold ${data.actualCashflow >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(data.actualCashflow)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetVsActual;
