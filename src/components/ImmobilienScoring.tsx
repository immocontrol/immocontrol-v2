/**
 * INHALT-4: Immobilien-Scoring — Objektbewertung nach 10 Kriterien
 * Jedes Objekt automatisch bewerten mit Ampelsystem (grün/gelb/rot).
 */
import { memo, useMemo, useState } from "react";
import { Star, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";

interface CriterionScore {
  name: string;
  score: number; // 0-10
  color: "profit" | "gold" | "loss";
  detail: string;
}

interface PropertyScore {
  propertyId: string;
  name: string;
  location: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  rating: "A" | "B" | "C" | "D";
  criteria: CriterionScore[];
}

const scoreCriterion = (name: string, value: number, thresholds: [number, number]): CriterionScore => {
  const score = value >= thresholds[1] ? 10 : value >= thresholds[0] ? 6 : 3;
  const color = score >= 8 ? "profit" : score >= 5 ? "gold" : "loss";
  return { name, score, color, detail: `${value.toFixed(1)}` };
};

const ImmobilienScoring = memo(() => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);

  const { data: loans = [] } = useQuery({
    queryKey: ["scoring_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment, property_id, fixed_interest_end_date");
      return (data || []) as Array<{
        id: string; remaining_balance: number; interest_rate: number;
        monthly_payment: number; property_id: string; fixed_interest_end_date: string | null;
      }>;
    },
    enabled: !!user,
  });

  const scores = useMemo((): PropertyScore[] => {
    return properties.map((p) => {
      const pLoans = loans.filter((l) => l.property_id === p.id);
      const debt = pLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
      const ltv = p.currentValue > 0 ? (debt / p.currentValue) * 100 : 0;
      const rendite = p.purchasePrice > 0 ? (p.monthlyRent * 12 / p.purchasePrice) * 100 : 0;
      const cashflowRendite = p.currentValue > 0 ? (p.monthlyCashflow * 12 / p.currentValue) * 100 : 0;
      const appreciation = p.purchasePrice > 0 ? ((p.currentValue - p.purchasePrice) / p.purchasePrice) * 100 : 0;
      const ekQuote = p.currentValue > 0 ? ((p.currentValue - debt) / p.currentValue) * 100 : 0;
      const nkQuote = p.monthlyRent > 0 ? (p.monthlyExpenses / p.monthlyRent) * 100 : 100;
      const dscr = p.monthlyCreditRate > 0 ? p.monthlyRent / p.monthlyCreditRate : 999;
      const sqmPrice = p.sqm > 0 ? p.purchasePrice / p.sqm : 0;
      const monthsToFixEnd = pLoans.reduce((min, l) => {
        if (!l.fixed_interest_end_date) return min;
        const months = (new Date(l.fixed_interest_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
        return months > 0 && months < min ? months : min;
      }, 999);
      const mieterhöhungsPotenzial = rendite < 4 ? 10 : rendite < 5 ? 8 : 5;

      const criteria: CriterionScore[] = [
        scoreCriterion("Rendite", rendite, [3, 5]),
        scoreCriterion("Cashflow", cashflowRendite, [1, 3]),
        scoreCriterion("Wertsteigerung", appreciation, [5, 15]),
        scoreCriterion("EK-Quote", ekQuote, [20, 40]),
        scoreCriterion("NK-Quote", 100 - nkQuote, [60, 80]),
        scoreCriterion("DSCR", dscr, [1.2, 1.5]),
        scoreCriterion("Zinsbindung", Math.min(monthsToFixEnd / 12, 10), [3, 5]),
        scoreCriterion("qm-Preis", sqmPrice > 0 ? Math.max(0, 5000 - sqmPrice) / 500 * 10 : 5, [3, 7]),
        scoreCriterion("Mieterhöhung", mieterhöhungsPotenzial, [5, 7]),
        scoreCriterion("Diversifikation", properties.length >= 3 ? 8 : properties.length >= 2 ? 6 : 3, [5, 7]),
      ];

      const totalScore = criteria.reduce((s, c) => s + c.score, 0);
      const maxScore = criteria.length * 10;
      const percentage = (totalScore / maxScore) * 100;
      const rating = percentage >= 75 ? "A" : percentage >= 55 ? "B" : percentage >= 35 ? "C" : "D";

      return { propertyId: p.id, name: p.name, location: p.location, totalScore, maxScore, percentage, rating, criteria };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [properties, loans]);

  if (properties.length === 0) return null;

  const avgScore = scores.length > 0 ? scores.reduce((s, p) => s + p.percentage, 0) / scores.length : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Immobilien-Scoring</h3>
          <Badge variant="outline" className="text-[10px] h-5">Ø {avgScore.toFixed(0)}%</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Property score cards */}
      <div className="space-y-2">
        {scores.slice(0, expanded ? undefined : 3).map((ps) => (
          <div key={ps.propertyId} className="p-2 rounded-lg bg-background/50 border border-border/50">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium">{ps.name}</span>
                <span className="text-[10px] text-muted-foreground">{ps.location}</span>
              </div>
              <Badge className={`text-[10px] h-5 ${
                ps.rating === "A" ? "bg-profit text-white" :
                ps.rating === "B" ? "bg-primary text-white" :
                ps.rating === "C" ? "bg-gold text-white" :
                "bg-loss text-white"
              }`}>
                {ps.rating} ({ps.percentage.toFixed(0)}%)
              </Badge>
            </div>

            {/* Score bar */}
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  ps.percentage >= 75 ? "bg-profit" : ps.percentage >= 55 ? "bg-primary" : ps.percentage >= 35 ? "bg-gold" : "bg-loss"
                }`}
                style={{ width: `${ps.percentage}%` }}
              />
            </div>

            {/* Criteria detail (expanded) */}
            {expanded && (
              <div className="grid grid-cols-5 gap-1 mt-2">
                {ps.criteria.map((c) => (
                  <div key={c.name} className="text-center">
                    <div className={`text-[9px] font-bold text-${c.color}`}>{c.score}</div>
                    <div className="text-[8px] text-muted-foreground truncate">{c.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
ImmobilienScoring.displayName = "ImmobilienScoring";

export { ImmobilienScoring };
