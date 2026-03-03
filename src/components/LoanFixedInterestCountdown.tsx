/**
 * #16: Zinsbindungs-Countdown mit 6M + 1J Erinnerung
 * Shows a countdown for each loan's fixed interest period with actionable recommendations.
 * Reminders at 1 year and 6 months before expiry.
 */
import { useMemo } from "react";
import { Clock, AlertTriangle, Landmark, TrendingUp, Calendar, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatters";

interface LoanAlert {
  id: string;
  bankName: string;
  propertyName: string;
  fixedUntil: Date;
  daysLeft: number;
  monthsLeft: number;
  interestRate: number;
  remainingBalance: number;
  monthlyPayment: number;
  urgency: "expired" | "critical" | "warning" | "info" | "safe";
  recommendation: string;
}

export function LoanFixedInterestCountdown() {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: loans = [] } = useQuery({
    queryKey: queryKeys.loans.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const propMap = useMemo(
    () => Object.fromEntries(properties.map(p => [p.id, p.name])),
    [properties]
  );

  const alerts = useMemo<LoanAlert[]>(() => {
    const now = new Date();
    return loans
      .filter(l => l.fixed_interest_until)
      .map(l => {
        const fixedUntil = new Date(l.fixed_interest_until!);
        const daysLeft = Math.ceil((fixedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const monthsLeft = Math.ceil(daysLeft / 30);

        let urgency: LoanAlert["urgency"] = "safe";
        let recommendation = "";

        if (daysLeft <= 0) {
          urgency = "expired";
          recommendation = "Zinsbindung abgelaufen — Anschlussfinanzierung dringend klären!";
        } else if (daysLeft <= 180) { // 6 months
          urgency = "critical";
          recommendation = "In weniger als 6 Monaten: Forward-Darlehen jetzt abschließen oder Angebote einholen.";
        } else if (daysLeft <= 365) { // 1 year
          urgency = "warning";
          recommendation = "In weniger als 1 Jahr: Jetzt Angebote für Anschlussfinanzierung vergleichen. Forward-Darlehen sichert aktuelle Konditionen.";
        } else if (daysLeft <= 730) { // 2 years
          urgency = "info";
          recommendation = "Noch Zeit — aber Forward-Darlehen ab 36 Monate vor Ablauf möglich.";
        }

        return {
          id: l.id,
          bankName: l.bank_name,
          propertyName: propMap[l.property_id] || "Unbekannt",
          fixedUntil,
          daysLeft,
          monthsLeft,
          interestRate: Number(l.interest_rate),
          remainingBalance: Number(l.remaining_balance),
          monthlyPayment: Number(l.monthly_payment),
          urgency,
          recommendation,
        };
      })
      .filter(a => a.urgency !== "safe")
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [loans, propMap]);

  if (alerts.length === 0) return null;

  const urgencyColors: Record<LoanAlert["urgency"], string> = {
    expired: "border-loss/40 bg-loss/5",
    critical: "border-loss/30 bg-loss/5",
    warning: "border-gold/30 bg-gold/5",
    info: "border-primary/20 bg-primary/5",
    safe: "border-border",
  };

  const urgencyIcons: Record<LoanAlert["urgency"], React.ReactNode> = {
    expired: <AlertTriangle className="h-4 w-4 text-loss" />,
    critical: <Bell className="h-4 w-4 text-loss" />,
    warning: <Clock className="h-4 w-4 text-gold" />,
    info: <Calendar className="h-4 w-4 text-primary" />,
    safe: <Landmark className="h-4 w-4" />,
  };

  const urgencyLabels: Record<LoanAlert["urgency"], string> = {
    expired: "Abgelaufen!",
    critical: "< 6 Monate",
    warning: "< 1 Jahr",
    info: "< 2 Jahre",
    safe: "",
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          Zinsbindungs-Countdown
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {alerts.length} Darlehen
        </span>
      </div>

      <div className="space-y-2">
        {alerts.slice(0, 5).map(a => (
          <div key={a.id} className={`rounded-lg border p-3 ${urgencyColors[a.urgency]}`}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">{urgencyIcons[a.urgency]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate">{a.bankName}</p>
                  <span className={`text-[10px] font-bold shrink-0 ${
                    a.urgency === "expired" || a.urgency === "critical" ? "text-loss" :
                    a.urgency === "warning" ? "text-gold" : "text-primary"
                  }`}>
                    {a.daysLeft <= 0 ? urgencyLabels.expired : `${a.daysLeft} Tage`}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">{a.propertyName}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px]">
                  <span>Restschuld: {formatCurrency(a.remainingBalance)}</span>
                  <span>Zins: {a.interestRate.toFixed(2)}%</span>
                </div>

                {/* Countdown bar */}
                {a.daysLeft > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          a.urgency === "critical" ? "bg-loss" :
                          a.urgency === "warning" ? "bg-gold" : "bg-primary"
                        }`}
                        style={{ width: `${Math.max(5, Math.min(100, (1 - a.daysLeft / 730) * 100))}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Endet am {a.fixedUntil.toLocaleDateString("de-DE")}
                      {a.monthsLeft > 0 && ` (${a.monthsLeft} Monate)`}
                    </p>
                  </div>
                )}

                {/* Recommendation */}
                <div className="mt-2 p-2 rounded bg-secondary/50">
                  <p className="text-[10px] leading-relaxed">
                    <TrendingUp className="h-3 w-3 inline mr-1 text-primary" />
                    {a.recommendation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > 5 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          +{alerts.length - 5} weitere Darlehen mit auslaufender Zinsbindung
        </p>
      )}
    </div>
  );
}

export default LoanFixedInterestCountdown;
