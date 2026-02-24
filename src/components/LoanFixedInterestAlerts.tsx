import { AlertTriangle, Calendar, Landmark } from "lucide-react";

interface Loan {
  id: string;
  bank_name: string;
  remaining_balance: number;
  fixed_interest_until: string | null;
  interest_rate: number;
}

interface LoanFixedInterestAlertsProps {
  loans: Loan[];
  propertyNames: Record<string, string>;
}

import { formatCurrency } from "@/lib/formatters";

const LoanFixedInterestAlerts = ({ loans }: { loans: Loan[] }) => {
  const now = new Date();
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

  return (
    <div className="gradient-card rounded-xl border border-gold/30 bg-gold/5 p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-gold" />
        <span className="text-sm font-semibold">Zinsbindung läuft ab</span>
        <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-medium">{alerts.length}</span>
      </div>
      <div className="space-y-2">
        {alerts.map(l => (
          <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50">
            <Landmark className="h-3.5 w-3.5 text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{l.bank_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(l.remaining_balance)} · {l.interest_rate}%
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
