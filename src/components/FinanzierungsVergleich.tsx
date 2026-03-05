/**
 * INHALT-3: Finanzierungsvergleich — Anschlussfinanzierung-Rechner
 * Bei auslaufender Zinsbindung verschiedene Szenarien vergleichen.
 */
import { memo, useMemo, useState } from "react";
import { RefreshCw, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE, formatDurationMonths } from "@/lib/formatters";

interface RefinanceScenario {
  name: string;
  rate: number;
  term: number; // years
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  monthlySaving: number;
}

const FinanzierungsVergleich = memo(() => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [expanded, setExpanded] = useState(false);
  const [newRate, setNewRate] = useState(3.5);
  const [sondertilgung, setSondertilgung] = useState(0);

  const { data: loans = [] } = useQuery({
    queryKey: ["refinance_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment, bank_name, property_id, fixed_interest_end_date");
      return (data || []) as Array<{
        id: string;
        remaining_balance: number;
        interest_rate: number;
        monthly_payment: number;
        bank_name: string;
        property_id: string;
        fixed_interest_end_date: string | null;
      }>;
    },
    enabled: !!user,
  });

  const analysis = useMemo(() => {
    if (loans.length === 0) return null;

    const expiringLoans = loans.filter((l) => {
      if (!l.fixed_interest_end_date) return false;
      const endDate = new Date(l.fixed_interest_end_date);
      const now = new Date();
      const monthsLeft = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsLeft > 0 && monthsLeft <= 60; // Within 5 years
    }).sort((a, b) => new Date(a.fixed_interest_end_date!).getTime() - new Date(b.fixed_interest_end_date!).getTime());

    const totalBalance = loans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
    const adjustedBalance = Math.max(0, totalBalance - sondertilgung);
    const avgRate = loans.length > 0
      ? loans.reduce((s, l) => s + l.interest_rate * l.remaining_balance, 0) / Math.max(1, totalBalance)
      : 0;

    // Calculate scenarios
    const scenarios: RefinanceScenario[] = [
      { name: "Aktuell", rate: avgRate, term: 10 },
      { name: "Günstig", rate: Math.max(1, newRate - 0.5), term: 10 },
      { name: "Markt", rate: newRate, term: 10 },
      { name: "Konservativ", rate: newRate + 0.5, term: 15 },
      { name: "Forward", rate: newRate + 0.3, term: 10 },
    ].map((s) => {
      const r = s.rate / 100 / 12;
      const n = s.term * 12;
      const monthly = r > 0
        ? adjustedBalance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : adjustedBalance / n;
      const totalCost = monthly * n;
      const totalInterest = totalCost - adjustedBalance;
      const currentMonthly = loans.reduce((sum, l) => sum + l.monthly_payment, 0);
      return {
        ...s,
        monthlyPayment: monthly,
        totalInterest,
        totalCost,
        monthlySaving: currentMonthly - monthly,
      };
    });

    return { expiringLoans, totalBalance, adjustedBalance, avgRate, scenarios };
  }, [loans, newRate, sondertilgung]);

  if (properties.length === 0 || !analysis) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Finanzierungsvergleich</h3>
          {analysis.expiringLoans.length > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">
              {analysis.expiringLoans.length} läuft aus
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Current vs New Rate */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Aktueller Ø-Zins</p>
          <p className="text-xs font-bold">{formatPercentDE(analysis.avgRate)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Restschuld</p>
          <p className="text-xs font-bold">{formatCurrency(analysis.adjustedBalance)}</p>
        </div>
      </div>

      {/* Rate slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">Neuer Zinssatz</span>
          <span className="font-bold">{formatPercentDE(newRate)}</span>
        </div>
        <Slider
          value={[newRate]}
          onValueChange={([v]) => setNewRate(v)}
          min={1}
          max={7}
          step={0.1}
          className="mb-2"
        />
      </div>

      {/* Sondertilgung */}
      {expanded && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">Sondertilgung</span>
            <span className="font-bold">{formatCurrency(sondertilgung)}</span>
          </div>
          <Slider
            value={[sondertilgung]}
            onValueChange={([v]) => setSondertilgung(v)}
            min={0}
            max={Math.min(analysis.totalBalance, 100000)}
            step={5000}
          />
        </div>
      )}

      {/* Scenario comparison */}
      <div className="space-y-1.5">
        {analysis.scenarios.slice(0, expanded ? undefined : 3).map((s) => (
          <div key={s.name} className={`p-2 rounded-lg border text-[10px] ${
            s.monthlySaving > 0 ? "bg-profit/5 border-profit/20" :
            s.monthlySaving < -100 ? "bg-loss/5 border-loss/20" :
            "bg-background/50 border-border/50"
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground ml-1">({formatPercentDE(s.rate)}, {s.term}J)</span>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatCurrency(s.monthlyPayment)}/M</p>
                {s.name !== "Aktuell" && (
                  <p className={s.monthlySaving > 0 ? "text-profit" : "text-loss"}>
                    {s.monthlySaving > 0 ? "−" : "+"}{formatCurrency(Math.abs(s.monthlySaving))}/M
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expiring loans warning */}
      {analysis.expiringLoans.length > 0 && expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground mb-2">Auslaufende Zinsbindungen</p>
          {analysis.expiringLoans.map((l) => {
            const endDate = new Date(l.fixed_interest_end_date!);
            const monthsLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
            const property = properties.find((p) => p.id === l.property_id);
            return (
              <div key={l.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-gold/5 mb-1">
                <AlertTriangle className="h-3 w-3 text-gold shrink-0" />
                <span>{l.bank_name || "Darlehen"}</span>
                {property && <span className="text-muted-foreground">({property.name})</span>}
                <span className="ml-auto font-medium">{formatDurationMonths(monthsLeft)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
FinanzierungsVergleich.displayName = "FinanzierungsVergleich";

export { FinanzierungsVergleich };
