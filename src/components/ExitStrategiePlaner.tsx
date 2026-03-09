/**
 * INHALT-5: Exit-Strategie-Planer — Verkaufszeitpunkt-Optimierung
 * Berechnung wann der optimale Verkaufszeitpunkt ist.
 * Vergleich "Halten vs. Verkaufen vs. Refinanzieren".
 */
import { memo, useMemo, useState } from "react";
import { LogOut, TrendingUp, Clock, Calculator, ChevronDown, ChevronUp, Building2, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { isDeepSeekConfigured, suggestExitStrategieInterpretation } from "@/integrations/ai/extractors";

interface ExitAnalysis {
  propertyId: string;
  name: string;
  purchaseDate: string;
  spekulationsfristEnde: Date;
  spekulationsfristAbgelaufen: boolean;
  monthsUntilFrist: number;
  currentValue: number;
  purchasePrice: number;
  remainingDebt: number;
  netProceeds: number; // After debt + costs
  annualCashflow: number;
  haltenVsVerkaufenYears: number; // Years until holding beats selling
  recommendation: "halten" | "verkaufen" | "warten";
  recommendationText: string;
}

const ExitStrategiePlaner = memo(() => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [expanded, setExpanded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [appreciationRate, setAppreciationRate] = useState(2); // % p.a.
  const [sellingCosts, setSellingCosts] = useState(8); // % of sale price (Makler + Notar + Steuer)

  const { data: loans = [] } = useQuery({
    queryKey: ["exit_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, property_id");
      return (data || []) as Array<{ id: string; remaining_balance: number; property_id: string }>;
    },
    enabled: !!user,
  });

  const analyses = useMemo((): ExitAnalysis[] => {
    return properties.map((p) => {
      const pLoans = loans.filter((l) => l.property_id === p.id);
      const debt = pLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
      const purchaseDate = new Date(p.purchaseDate);
      const spekulationsfristEnde = new Date(purchaseDate);
      spekulationsfristEnde.setFullYear(spekulationsfristEnde.getFullYear() + 10);
      const now = new Date();
      const monthsUntilFrist = Math.max(0, (spekulationsfristEnde.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const spekulationsfristAbgelaufen = monthsUntilFrist <= 0;

      const costs = p.currentValue * (sellingCosts / 100);
      const spekulationssteuer = !spekulationsfristAbgelaufen ? Math.max(0, (p.currentValue - p.purchasePrice) * 0.42) : 0;
      const netProceeds = p.currentValue - debt - costs - spekulationssteuer;

      const annualCashflow = p.monthlyCashflow * 12;

      // How many years until accumulated cashflow from holding exceeds net sale proceeds?
      let haltenVsVerkaufenYears = 0;
      if (annualCashflow > 0 && netProceeds > 0) {
        let accCashflow = 0;
        let futureValue = p.currentValue;
        for (let y = 1; y <= 30; y++) {
          accCashflow += annualCashflow;
          futureValue *= (1 + appreciationRate / 100);
          const futureNetProceeds = futureValue - debt - (futureValue * sellingCosts / 100);
          if (accCashflow + futureNetProceeds > netProceeds + netProceeds * 0.03 * y) {
            haltenVsVerkaufenYears = y;
            break;
          }
        }
        if (haltenVsVerkaufenYears === 0) haltenVsVerkaufenYears = 30;
      }

      let recommendation: "halten" | "verkaufen" | "warten" = "halten";
      let recommendationText = "";

      if (!spekulationsfristAbgelaufen && monthsUntilFrist < 24) {
        recommendation = "warten";
        recommendationText = `Spekulationsfrist endet in ${Math.ceil(monthsUntilFrist)} Monaten — warten lohnt sich`;
      } else if (annualCashflow < 0 && netProceeds > 0) {
        recommendation = "verkaufen";
        recommendationText = `Negativer Cashflow (${formatCurrency(annualCashflow)}/J) — Verkauf prüfen`;
      } else if (annualCashflow > 0) {
        recommendation = "halten";
        recommendationText = `Positiver Cashflow + Wertsteigerung — Halten empfohlen`;
      } else {
        recommendation = "halten";
        recommendationText = "Keine klare Empfehlung — individuelle Prüfung nötig";
      }

      return {
        propertyId: p.id, name: p.name, purchaseDate: p.purchaseDate,
        spekulationsfristEnde, spekulationsfristAbgelaufen, monthsUntilFrist,
        currentValue: p.currentValue, purchasePrice: p.purchasePrice,
        remainingDebt: debt, netProceeds, annualCashflow,
        haltenVsVerkaufenYears, recommendation, recommendationText,
      };
    }).sort((a, b) => {
      if (a.recommendation === "verkaufen" && b.recommendation !== "verkaufen") return -1;
      if (a.recommendation === "warten" && b.recommendation === "halten") return -1;
      return 0;
    });
  }, [properties, loans, appreciationRate, sellingCosts]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Exit-Strategie-Planer</h3>
        </div>
        <div className="flex items-center gap-1">
          {isDeepSeekConfigured() && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[10px] px-1.5"
              disabled={aiLoading}
              onClick={async () => {
                setAiLoading(true);
                try {
                  const holdCount = analyses.filter((a) => a.recommendation === "halten").length;
                  const sellCount = analyses.filter((a) => a.recommendation === "verkaufen").length;
                  const waitCount = analyses.filter((a) => a.recommendation === "warten").length;
                  const text = await suggestExitStrategieInterpretation({
                    propertyCount: analyses.length,
                    holdCount,
                    sellCount,
                    waitCount,
                    totalNetProceeds: analyses.reduce((s, a) => s + a.netProceeds, 0),
                    totalAnnualCashflow: analyses.reduce((s, a) => s + a.annualCashflow, 0),
                  });
                  if (text) toast.info(text, { duration: 8000 });
                } catch (e) {
                  handleError(e, { context: "ai", details: "exitStrategie", showToast: true });
                } finally {
                  setAiLoading(false);
                }
              }}
              aria-label="KI Einschätzung"
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              KI
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Settings */}
      {expanded && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Wertsteigerung/J</span>
              <span className="font-bold">{formatPercentDE(appreciationRate)}</span>
            </div>
            <Slider value={[appreciationRate]} onValueChange={([v]) => setAppreciationRate(v)} min={0} max={5} step={0.5} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Verkaufskosten</span>
              <span className="font-bold">{formatPercentDE(sellingCosts)}</span>
            </div>
            <Slider value={[sellingCosts]} onValueChange={([v]) => setSellingCosts(v)} min={3} max={15} step={0.5} />
          </div>
        </div>
      )}

      {/* Property exit analyses */}
      <div className="space-y-2">
        {analyses.slice(0, expanded ? undefined : 2).map((a) => (
          <div key={a.propertyId} className={`p-2 rounded-lg border ${
            a.recommendation === "verkaufen" ? "bg-loss/5 border-loss/20" :
            a.recommendation === "warten" ? "bg-gold/5 border-gold/20" :
            "bg-profit/5 border-profit/20"
          }`}>
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium">{a.name}</span>
              </div>
              <Badge className={`text-[10px] h-5 ${
                a.recommendation === "verkaufen" ? "bg-loss text-white" :
                a.recommendation === "warten" ? "bg-gold text-white" :
                "bg-profit text-white"
              }`}>
                {a.recommendation === "verkaufen" ? "Verkauf prüfen" :
                 a.recommendation === "warten" ? "Abwarten" : "Halten"}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-1 text-[10px] mb-1">
              <div>
                <span className="text-muted-foreground">Netto-Erlös</span>
                <p className={`font-medium ${a.netProceeds >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(a.netProceeds)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Cashflow/J</span>
                <p className={`font-medium ${a.annualCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(a.annualCashflow)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Spekul.-Frist</span>
                <p className={`font-medium ${a.spekulationsfristAbgelaufen ? "text-profit" : "text-gold"}`}>
                  {a.spekulationsfristAbgelaufen ? "Abgelaufen" : `${Math.ceil(a.monthsUntilFrist)} Mon.`}
                </p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">{a.recommendationText}</p>
          </div>
        ))}
      </div>
    </div>
  );
});
ExitStrategiePlaner.displayName = "ExitStrategiePlaner";

export { ExitStrategiePlaner };
