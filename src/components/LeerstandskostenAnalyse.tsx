/**
 * INHALT-9: Leerstandskosten-Analyse — Was kostet jeder Tag Leerstand?
 * Pro Objekt/Einheit: tägliche Kosten bei Leerstand.
 * Prognose wie lange Leerstand finanziell tragbar ist.
 */
import { memo, useMemo, useState } from "react";
import { Home, AlertTriangle, Clock, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface VacancyCost {
  propertyId: string;
  name: string;
  location: string;
  dailyCost: number;
  monthlyCost: number;
  annualCost: number;
  monthlyRentLost: number;
  maxAffordableMonths: number;
  recommendation: string;
  severity: "low" | "medium" | "high";
}

const LeerstandskostenAnalyse = memo(() => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);

  const { data: loans = [] } = useQuery({
    queryKey: ["vacancy_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment, property_id");
      return (data || []) as Array<{
        id: string; remaining_balance: number; interest_rate: number;
        monthly_payment: number; property_id: string;
      }>;
    },
    enabled: !!user,
  });

  const vacancyCosts = useMemo((): VacancyCost[] => {
    return properties.map((p) => {
      const pLoans = loans.filter((l) => l.property_id === p.id);
      const monthlyDebt = pLoans.reduce((s, l) => s + l.monthly_payment, 0);
      const monthlyExpenses = p.monthlyExpenses;
      const monthlyRent = p.monthlyRent;

      // Costs during vacancy: debt + expenses + opportunity cost (lost rent)
      const monthlyCostDirect = monthlyDebt + monthlyExpenses;
      const monthlyOpportunity = monthlyRent;
      const monthlyCost = monthlyCostDirect + monthlyOpportunity;
      const dailyCost = monthlyCost / 30;
      const annualCost = monthlyCost * 12;

      // How long can you afford vacancy? Based on 6 months of rent reserve
      const reserve = monthlyRent * 6;
      const maxAffordableMonths = monthlyCostDirect > 0 ? Math.floor(reserve / monthlyCostDirect) : 999;

      let recommendation = "";
      let severity: VacancyCost["severity"] = "low";

      if (monthlyCostDirect > monthlyRent * 0.8) {
        severity = "high";
        recommendation = "Hohe Fixkosten — schnelle Neuvermietung oder Mietpreissenkung empfohlen";
      } else if (monthlyCostDirect > monthlyRent * 0.5) {
        severity = "medium";
        recommendation = "Moderate Fixkosten — Renovierung für schnellere Vermietung prüfen";
      } else {
        severity = "low";
        recommendation = "Niedrige Fixkosten — finanziell gut aufgestellt für Überbrückung";
      }

      return {
        propertyId: p.id, name: p.name, location: p.location,
        dailyCost, monthlyCost, annualCost, monthlyRentLost: monthlyOpportunity,
        maxAffordableMonths, recommendation, severity,
      };
    }).sort((a, b) => b.dailyCost - a.dailyCost);
  }, [properties, loans]);

  if (properties.length === 0) return null;

  const totalDailyCost = vacancyCosts.reduce((s, v) => s + v.dailyCost, 0);
  const highRiskCount = vacancyCosts.filter((v) => v.severity === "high").length;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Leerstandskosten</h3>
          {highRiskCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">{highRiskCount} Risiko</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Total daily cost */}
      <div className="text-center p-2 rounded-lg bg-loss/5 border border-loss/20 mb-3">
        <p className="text-[10px] text-muted-foreground">Kosten bei Vollleerstand</p>
        <p className="text-lg font-bold text-loss">{formatCurrency(totalDailyCost)}/Tag</p>
        <p className="text-[10px] text-muted-foreground">
          = {formatCurrency(totalDailyCost * 30)}/Monat = {formatCurrency(totalDailyCost * 365)}/Jahr
        </p>
      </div>

      {/* Per-property breakdown */}
      <div className="space-y-1.5">
        {vacancyCosts.slice(0, expanded ? undefined : 3).map((v) => (
          <div key={v.propertyId} className={`p-2 rounded-lg border text-[10px] ${
            v.severity === "high" ? "bg-loss/5 border-loss/20" :
            v.severity === "medium" ? "bg-gold/5 border-gold/20" :
            "bg-background/50 border-border/50"
          }`}>
            <div className="flex justify-between items-start mb-1">
              <div>
                <span className="font-medium">{v.name}</span>
                <span className="text-muted-foreground ml-1">{v.location}</span>
              </div>
              <span className="font-bold text-loss">{formatCurrency(v.dailyCost)}/Tag</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div>
                <span className="text-muted-foreground">Fixkosten/M</span>
                <p className="font-medium text-loss">{formatCurrency(v.monthlyCost - v.monthlyRentLost)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Entg. Miete/M</span>
                <p className="font-medium text-muted-foreground">{formatCurrency(v.monthlyRentLost)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Reserve reicht</span>
                <p className={`font-medium ${v.maxAffordableMonths <= 3 ? "text-loss" : v.maxAffordableMonths <= 6 ? "text-gold" : "text-profit"}`}>
                  {v.maxAffordableMonths >= 999 ? "∞" : `${v.maxAffordableMonths} Mon.`}
                </p>
              </div>
            </div>
            {expanded && (
              <p className="text-muted-foreground mt-1 italic">{v.recommendation}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
LeerstandskostenAnalyse.displayName = "LeerstandskostenAnalyse";

export { LeerstandskostenAnalyse };
