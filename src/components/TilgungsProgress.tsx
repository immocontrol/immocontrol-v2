import { useMemo } from "react";
import { Landmark, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";

const TilgungsProgress = () => {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: loans = [] } = useQuery({
    queryKey: queryKeys.loans.all,
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const progressData = useMemo(() => {
    return properties.map(p => {
      const propLoans = loans.filter(l => l.property_id === p.id);
      const totalLoan = propLoans.reduce((s, l) => s + Number(l.loan_amount), 0);
      const totalRemaining = propLoans.reduce((s, l) => s + Number(l.remaining_balance), 0);
      const tilgung = totalLoan - totalRemaining;
      const progress = totalLoan > 0 ? (tilgung / totalLoan * 100) : 0;
      const monthlyPayment = propLoans.reduce((s, l) => s + Number(l.monthly_payment), 0);
      const avgRate = propLoans.length > 0 
        ? propLoans.reduce((s, l) => s + Number(l.interest_rate), 0) / propLoans.length 
        : 0;
      // Estimated payoff date
      const monthlyTilgung = propLoans.reduce((s, l) => {
        const interest = Number(l.remaining_balance) * Number(l.interest_rate) / 100 / 12;
        return s + Math.max(0, Number(l.monthly_payment) - interest);
      }, 0);
      const monthsLeft = monthlyTilgung > 0 ? Math.ceil(totalRemaining / monthlyTilgung) : 0;
      const payoffDate = new Date();
      payoffDate.setMonth(payoffDate.getMonth() + monthsLeft);

      return {
        id: p.id,
        name: p.name,
        totalLoan,
        totalRemaining,
        tilgung,
        progress,
        monthlyPayment,
        avgRate,
        monthsLeft,
        payoffYear: payoffDate.getFullYear(),
      };
    }).filter(d => d.totalLoan > 0).sort((a, b) => b.progress - a.progress);
  }, [properties, loans]);

  if (progressData.length === 0) return null;

  const totalLoan = progressData.reduce((s, d) => s + d.totalLoan, 0);
  const totalTilgung = progressData.reduce((s, d) => s + d.tilgung, 0);
  const overallProgress = totalLoan > 0 ? (totalTilgung / totalLoan * 100) : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" /> Tilgungsfortschritt
        </h3>
        <span className="text-xs text-muted-foreground">{overallProgress.toFixed(1)}% getilgt</span>
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="h-3 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all progress-animated" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{formatCurrency(totalTilgung)} getilgt</span>
          <span>{formatCurrency(totalLoan - totalTilgung)} Restschuld</span>
        </div>
      </div>

      <div className="space-y-3">
        {progressData.map(d => (
          <div key={d.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Landmark className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium truncate max-w-[150px]">{d.name}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{d.avgRate.toFixed(2)}%</span>
                <span className="font-semibold text-foreground">{d.progress.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${d.progress >= 75 ? "bg-profit" : d.progress >= 40 ? "bg-primary" : "bg-gold"}`}
                style={{ width: `${d.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatCurrency(d.monthlyPayment)}/M</span>
              <span>schuldfrei ca. {d.payoffYear}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TilgungsProgress;
