/**
 * INHALT-13: Szenario-Simulation — "Was wäre wenn?"
 * Simulation von: Zinsanstieg, Mietausfall, Sanierungskosten, Mieterhöhung, Sondertilgung.
 * Auswirkung auf Gesamtportfolio sofort sichtbar.
 */
import { memo, useMemo, useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";

interface ScenarioResult {
  name: string;
  currentCashflow: number;
  scenarioCashflow: number;
  delta: number;
  impact: "positiv" | "neutral" | "negativ" | "kritisch";
}

const SzenarioSimulation = memo(() => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);

  // Scenario parameters
  const [zinsAnstieg, setZinsAnstieg] = useState(2); // +2%
  const [mietausfall, setMietausfall] = useState(3); // months
  const [sanierung, setSanierung] = useState(50000); // €
  const [mieterhoehung, setMieterhoehung] = useState(10); // %
  const [sondertilgung, setSondertilgung] = useState(20000); // €

  const { data: loans = [] } = useQuery({
    queryKey: ["scenario_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment");
      return (data || []) as Array<{
        id: string; remaining_balance: number; interest_rate: number; monthly_payment: number;
      }>;
    },
    enabled: !!user,
  });

  const scenarios = useMemo((): ScenarioResult[] => {
    if (properties.length === 0) return [];

    const currentMonthly = stats.totalCashflow;
    const currentAnnual = currentMonthly * 12;
    const totalDebt = loans.reduce((s, l) => s + (l.remaining_balance || 0), 0);

    const results: ScenarioResult[] = [];

    // 1. Zinsanstieg
    const additionalInterest = (totalDebt * zinsAnstieg / 100) / 12;
    const zinsScenario = currentMonthly - additionalInterest;
    results.push({
      name: `Zinsen +${zinsAnstieg}%`,
      currentCashflow: currentMonthly,
      scenarioCashflow: zinsScenario,
      delta: -additionalInterest,
      impact: zinsScenario < -500 ? "kritisch" : zinsScenario < 0 ? "negativ" : "neutral",
    });

    // 2. Mietausfall
    const lostRent = (stats.totalRent * mietausfall);
    const mietausfallMonthly = currentMonthly - (lostRent / 12);
    results.push({
      name: `${mietausfall} Mon. Mietausfall`,
      currentCashflow: currentMonthly,
      scenarioCashflow: mietausfallMonthly,
      delta: -(lostRent / 12),
      impact: mietausfallMonthly < -500 ? "kritisch" : mietausfallMonthly < 0 ? "negativ" : "neutral",
    });

    // 3. Sanierungskosten
    const sanierungMonthly = currentMonthly - (sanierung / 12);
    results.push({
      name: `Sanierung ${formatCurrency(sanierung)}`,
      currentCashflow: currentMonthly,
      scenarioCashflow: sanierungMonthly,
      delta: -(sanierung / 12),
      impact: sanierungMonthly < -500 ? "kritisch" : sanierungMonthly < 0 ? "negativ" : "neutral",
    });

    // 4. Mieterhöhung (positive)
    const additionalRent = stats.totalRent * (mieterhoehung / 100);
    const erhoehungScenario = currentMonthly + additionalRent;
    results.push({
      name: `Miete +${mieterhoehung}%`,
      currentCashflow: currentMonthly,
      scenarioCashflow: erhoehungScenario,
      delta: additionalRent,
      impact: "positiv",
    });

    // 5. Sondertilgung (reduces future interest)
    const interestSaved = (sondertilgung * (loans[0]?.interest_rate || 3) / 100) / 12;
    const tilgungScenario = currentMonthly + interestSaved;
    results.push({
      name: `Sondertilgung ${formatCurrency(sondertilgung)}`,
      currentCashflow: currentMonthly,
      scenarioCashflow: tilgungScenario,
      delta: interestSaved,
      impact: "positiv",
    });

    return results;
  }, [properties, stats, loans, zinsAnstieg, mietausfall, sanierung, mieterhoehung, sondertilgung]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Was wäre wenn?</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Sliders */}
      {expanded && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Zinsanstieg</span>
              <span className="font-bold text-loss">+{formatPercentDE(zinsAnstieg)}</span>
            </div>
            <Slider value={[zinsAnstieg]} onValueChange={([v]) => setZinsAnstieg(v)} min={0.5} max={5} step={0.5} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Mietausfall</span>
              <span className="font-bold text-loss">{mietausfall} Mon.</span>
            </div>
            <Slider value={[mietausfall]} onValueChange={([v]) => setMietausfall(v)} min={1} max={12} step={1} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Sanierung</span>
              <span className="font-bold">{formatCurrency(sanierung)}</span>
            </div>
            <Slider value={[sanierung]} onValueChange={([v]) => setSanierung(v)} min={10000} max={200000} step={10000} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Mieterhöhung</span>
              <span className="font-bold text-profit">+{mieterhoehung}%</span>
            </div>
            <Slider value={[mieterhoehung]} onValueChange={([v]) => setMieterhoehung(v)} min={5} max={20} step={1} />
          </div>
        </div>
      )}

      {/* Scenario results */}
      <div className="space-y-1.5">
        {scenarios.map((s) => (
          <div key={s.name} className={`p-2 rounded-lg border text-[10px] ${
            s.impact === "kritisch" ? "bg-loss/5 border-loss/20" :
            s.impact === "negativ" ? "bg-gold/5 border-gold/20" :
            s.impact === "positiv" ? "bg-profit/5 border-profit/20" :
            "bg-background/50 border-border/50"
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                {s.impact === "kritisch" ? <AlertTriangle className="h-3 w-3 text-loss" /> :
                 s.impact === "positiv" ? <CheckCircle2 className="h-3 w-3 text-profit" /> : null}
                <span className="font-medium">{s.name}</span>
              </div>
              <div className="text-right">
                <span className={`font-bold ${s.delta >= 0 ? "text-profit" : "text-loss"}`}>
                  {s.delta >= 0 ? "+" : ""}{formatCurrency(s.delta)}/M
                </span>
              </div>
            </div>
            <div className="flex justify-between mt-0.5 text-muted-foreground">
              <span>Cashflow: {formatCurrency(s.currentCashflow)}/M → {formatCurrency(s.scenarioCashflow)}/M</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
SzenarioSimulation.displayName = "SzenarioSimulation";

export { SzenarioSimulation };
