import { useMemo } from "react";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const YearOverYear = () => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();

  const { data: payments = [] } = useQuery({
    queryKey: ["yoy_payments"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_payments").select("amount, status, due_date");
      return data || [];
    },
    enabled: !!user,
  });

  const comparison = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const thisYearPayments = payments.filter(p => new Date(p.due_date).getFullYear() === thisYear && p.status === "confirmed");
    const lastYearPayments = payments.filter(p => new Date(p.due_date).getFullYear() === lastYear && p.status === "confirmed");

    const thisIncome = thisYearPayments.reduce((s, p) => s + Number(p.amount), 0);
    const lastIncome = lastYearPayments.reduce((s, p) => s + Number(p.amount), 0);

    // Normalize to same month count
    const currentMonth = now.getMonth() + 1;
    const normalizedLast = lastIncome > 0 ? (lastIncome / 12) * currentMonth : 0;

    const incomeChange = normalizedLast > 0 ? ((thisIncome - normalizedLast) / normalizedLast) * 100 : 0;

    return {
      thisYear,
      lastYear,
      thisIncome,
      lastIncome: normalizedLast,
      incomeChange,
      propertyCount: properties.length,
      portfolioValue: stats.totalValue,
    };
  }, [payments, properties, stats]);

  if (payments.length === 0) return null;

  const TrendIcon = comparison.incomeChange > 1 ? TrendingUp : comparison.incomeChange < -1 ? TrendingDown : Minus;
  const trendColor = comparison.incomeChange > 1 ? "text-profit" : comparison.incomeChange < -1 ? "text-loss" : "text-muted-foreground";

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-3">Jahresvergleich {comparison.lastYear} vs. {comparison.thisYear}</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mieteingänge {comparison.thisYear}</p>
          <p className="text-lg font-bold">{formatCurrency(comparison.thisIncome)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vj. (hochgerechnet)</p>
          <p className="text-lg font-bold text-muted-foreground">{formatCurrency(comparison.lastIncome)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Veränderung</p>
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            <span className="text-lg font-bold">{comparison.incomeChange >= 0 ? "+" : ""}{comparison.incomeChange.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearOverYear;
