/**
 * IMP20-20: Portfolio-Stresstest
 * MortgageStressTest: Combined scenarios (e.g., rates to 5% AND 2 properties vacant simultaneously).
 * Multi-factor stress testing for portfolio resilience.
 */
import { memo, useMemo, useState } from "react";
import { ShieldAlert, TrendingUp, Home, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";

interface StressScenario {
  name: string;
  interestRate: number;
  vacancyRate: number;
  maintenanceIncrease: number;
  rentDecrease: number;
}

const PRESET_SCENARIOS: StressScenario[] = [
  { name: "Mild", interestRate: 4.0, vacancyRate: 5, maintenanceIncrease: 10, rentDecrease: 0 },
  { name: "Moderat", interestRate: 5.0, vacancyRate: 10, maintenanceIncrease: 20, rentDecrease: 5 },
  { name: "Schwer", interestRate: 6.0, vacancyRate: 20, maintenanceIncrease: 30, rentDecrease: 10 },
  { name: "Extrem", interestRate: 7.0, vacancyRate: 30, maintenanceIncrease: 50, rentDecrease: 15 },
];

const PortfolioStresstest = memo(() => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [selectedScenario, setSelectedScenario] = useState(1); // Default: Moderat
  const [customRate, setCustomRate] = useState(5.0);
  const [customVacancy, setCustomVacancy] = useState(10);

  const { data: loans = [] } = useQuery({
    queryKey: ["stress_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment");
      return (data || []) as Array<{
        id: string;
        remaining_balance: number;
        interest_rate: number;
        monthly_payment: number;
      }>;
    },
    enabled: !!user,
  });

  const stressResults = useMemo(() => {
    const scenario = PRESET_SCENARIOS[selectedScenario];
    if (!scenario || properties.length === 0) return null;

    // Current situation
    const currentRent = stats.totalRent;
    const currentExpenses = stats.totalExpenses;
    const currentCreditRate = stats.totalCreditRate;
    const currentCashflow = currentRent - currentExpenses - currentCreditRate;

    // Stressed situation
    const stressedRent = currentRent * (1 - scenario.vacancyRate / 100) * (1 - scenario.rentDecrease / 100);
    const stressedExpenses = currentExpenses * (1 + scenario.maintenanceIncrease / 100);

    // Recalculate credit rates at new interest rate
    const stressedCreditRate = loans.reduce((sum, loan) => {
      if (loan.remaining_balance <= 0) return sum;
      const newMonthlyInterest = (loan.remaining_balance * scenario.interestRate / 100) / 12;
      const currentInterest = (loan.remaining_balance * loan.interest_rate / 100) / 12;
      const principal = Math.max(0, loan.monthly_payment - currentInterest);
      return sum + newMonthlyInterest + principal;
    }, 0);

    const stressedCashflow = stressedRent - stressedExpenses - (stressedCreditRate > 0 ? stressedCreditRate : currentCreditRate);
    const cashflowDelta = stressedCashflow - currentCashflow;
    const survivalMonths = stressedCashflow < 0
      ? Math.floor(Math.abs(stats.totalCashflow * 6) / Math.abs(stressedCashflow)) // Assume 6 months reserves
      : 999;

    const totalDebt = loans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
    const totalValue = stats.totalValue || 1;
    const currentLTV = (totalDebt / totalValue) * 100;
    const stressedValue = totalValue * (1 - scenario.rentDecrease / 100 * 5); // Rough: rent drop impacts value
    const stressedLTV = stressedValue > 0 ? (totalDebt / stressedValue) * 100 : 100;

    return {
      scenario,
      currentCashflow,
      stressedCashflow,
      cashflowDelta,
      stressedRent,
      stressedExpenses,
      stressedCreditRate: stressedCreditRate > 0 ? stressedCreditRate : currentCreditRate,
      survivalMonths,
      currentLTV,
      stressedLTV,
      survives: stressedCashflow >= 0,
      critical: stressedCashflow < -500,
    };
  }, [properties, stats, loans, selectedScenario]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Portfolio-Stresstest</h3>
      </div>

      {/* Scenario selector */}
      <div className="flex gap-1 mb-3">
        {PRESET_SCENARIOS.map((s, i) => (
          <Button
            key={s.name}
            variant={selectedScenario === i ? "default" : "outline"}
            size="sm"
            className="text-[10px] h-6 px-2 flex-1"
            onClick={() => setSelectedScenario(i)}
          >
            {s.name}
          </Button>
        ))}
      </div>

      {/* Scenario parameters */}
      {stressResults && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3 text-[10px]">
            <div className="p-1.5 rounded bg-background/50 text-center">
              <span className="text-muted-foreground">Zinssatz</span>
              <p className="font-bold text-loss">{formatPercentDE(stressResults.scenario.interestRate)}</p>
            </div>
            <div className="p-1.5 rounded bg-background/50 text-center">
              <span className="text-muted-foreground">Leerstand</span>
              <p className="font-bold text-loss">{stressResults.scenario.vacancyRate}%</p>
            </div>
            <div className="p-1.5 rounded bg-background/50 text-center">
              <span className="text-muted-foreground">Wartung +</span>
              <p className="font-bold text-loss">{stressResults.scenario.maintenanceIncrease}%</p>
            </div>
            <div className="p-1.5 rounded bg-background/50 text-center">
              <span className="text-muted-foreground">Miete -</span>
              <p className="font-bold text-loss">{stressResults.scenario.rentDecrease}%</p>
            </div>
          </div>

          {/* Results */}
          <div className={`p-3 rounded-lg border ${
            stressResults.survives ? "bg-profit/5 border-profit/20" :
            stressResults.critical ? "bg-loss/5 border-loss/20" :
            "bg-gold/5 border-gold/20"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {stressResults.survives ? (
                <CheckCircle2 className="h-4 w-4 text-profit" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-loss" />
              )}
              <span className="text-xs font-bold">
                {stressResults.survives ? "Portfolio übersteht Szenario" :
                 stressResults.critical ? "Kritisch — negativer Cashflow" :
                 "Angespannt — knapper Cashflow"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-muted-foreground">Aktueller Cashflow</span>
                <p className={`font-bold ${stressResults.currentCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(stressResults.currentCashflow)}/M
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Stress-Cashflow</span>
                <p className={`font-bold ${stressResults.stressedCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(stressResults.stressedCashflow)}/M
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Delta</span>
                <p className="font-bold text-loss">{formatCurrency(stressResults.cashflowDelta)}/M</p>
              </div>
              <div>
                <span className="text-muted-foreground">LTV</span>
                <p className={`font-bold ${stressResults.stressedLTV > 80 ? "text-loss" : "text-profit"}`}>
                  {formatPercentDE(stressResults.currentLTV)} → {formatPercentDE(stressResults.stressedLTV)}
                </p>
              </div>
            </div>

            {!stressResults.survives && stressResults.survivalMonths < 999 && (
              <p className="text-[10px] text-loss mt-2 font-medium">
                Bei 6 Monatsreserven: ~{stressResults.survivalMonths} Monate durchhaltbar
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
});
PortfolioStresstest.displayName = "PortfolioStresstest";

export { PortfolioStresstest };
