import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const LoanAmortizationMini = () => {
  const { user } = useAuth();

  const { data: loans = [] } = useQuery({
    queryKey: queryKeys.loans.all,
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("remaining_balance, interest_rate, repayment_rate, monthly_payment, loan_amount");
      return data || [];
    },
    enabled: !!user,
  });

  const chartData = useMemo(() => {
    if (loans.length === 0) return [];
    
    let totalBalance = loans.reduce((s, l) => s + Number(l.remaining_balance), 0);
    const totalMonthly = loans.reduce((s, l) => s + Number(l.monthly_payment), 0);
    const avgRate = totalBalance > 0
      ? loans.reduce((s, l) => s + Number(l.interest_rate) * Number(l.remaining_balance), 0) / totalBalance / 100
      : 0;

    const data: { year: string; schuld: number }[] = [];
    const startYear = new Date().getFullYear();
    
    for (let y = 0; y <= 30 && totalBalance > 0; y++) {
      data.push({ year: String(startYear + y), schuld: Math.round(totalBalance) });
      for (let m = 0; m < 12 && totalBalance > 0; m++) {
        const interest = totalBalance * avgRate / 12;
        totalBalance = Math.max(0, totalBalance + interest - totalMonthly);
      }
    }
    return data;
  }, [loans]);

  if (chartData.length < 2) return null;

  const totalDebt = chartData[0]?.schuld || 0;
  const payoffYear = chartData.length > 1 ? chartData[chartData.length - 1].year : "–";

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Tilgungsverlauf</h3>
        <span className="text-[10px] text-muted-foreground">Schuldenfrei ca. {payoffYear}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        Aktuell: {formatCurrency(totalDebt)} Restschuld
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={4} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
          />
          <Area type="monotone" dataKey="schuld" stroke="hsl(var(--primary))" fill="url(#debtGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LoanAmortizationMini;
