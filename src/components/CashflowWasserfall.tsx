/**
 * INHALT-11: Cashflow-Wasserfall — Wohin fließt jeder Euro?
 * Interaktiver Wasserfall pro Objekt: Mieteinnahmen → NK → Zinsen → Tilgung → Netto.
 */
import { memo, useMemo, useState } from "react";
import { Droplets, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface WaterfallStep {
  label: string;
  value: number;
  running: number;
  type: "income" | "expense" | "result";
  color: string;
}

const CashflowWasserfall = memo(() => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const [period, setPeriod] = useState<"monat" | "jahr">("monat");

  const { data: loans = [] } = useQuery({
    queryKey: ["waterfall_loans"],
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

  const waterfall = useMemo((): WaterfallStep[] => {
    const props = selectedProperty === "all" ? properties : properties.filter((p) => p.id === selectedProperty);
    if (props.length === 0) return [];

    const mult = period === "jahr" ? 12 : 1;
    const rent = props.reduce((s, p) => s + p.monthlyRent, 0) * mult;
    const expenses = props.reduce((s, p) => s + p.monthlyExpenses, 0) * mult;

    const relevantLoans = selectedProperty === "all" ? loans : loans.filter((l) => l.property_id === selectedProperty);
    const totalPayment = relevantLoans.reduce((s, l) => s + l.monthly_payment, 0) * mult;
    const totalInterest = relevantLoans.reduce((s, l) => s + (l.remaining_balance * l.interest_rate / 100 / 12), 0) * mult;
    const totalTilgung = Math.max(0, totalPayment - totalInterest);

    const instandhaltung = expenses * 0.3;
    const verwaltung = expenses * 0.2;
    const nebenkosten = expenses * 0.5;

    const nettoCashflow = rent - nebenkosten - instandhaltung - verwaltung - totalInterest - totalTilgung;

    let running = 0;
    const steps: WaterfallStep[] = [];

    running = rent;
    steps.push({ label: "Mieteinnahmen", value: rent, running, type: "income", color: "bg-profit" });

    running -= nebenkosten;
    steps.push({ label: "Nebenkosten", value: -nebenkosten, running, type: "expense", color: "bg-loss/70" });

    running -= instandhaltung;
    steps.push({ label: "Instandhaltung", value: -instandhaltung, running, type: "expense", color: "bg-loss/60" });

    running -= verwaltung;
    steps.push({ label: "Verwaltung", value: -verwaltung, running, type: "expense", color: "bg-loss/50" });

    running -= totalInterest;
    steps.push({ label: "Zinsen", value: -totalInterest, running, type: "expense", color: "bg-loss/80" });

    running -= totalTilgung;
    steps.push({ label: "Tilgung", value: -totalTilgung, running, type: "expense", color: "bg-primary/70" });

    steps.push({ label: "Netto-Cashflow", value: nettoCashflow, running: nettoCashflow, type: "result", color: nettoCashflow >= 0 ? "bg-profit" : "bg-loss" });

    return steps;
  }, [properties, loans, selectedProperty, period]);

  if (properties.length === 0) return null;

  const maxValue = waterfall.length > 0 ? Math.max(...waterfall.map((s) => Math.abs(s.running)), ...waterfall.map((s) => Math.abs(s.value))) : 1;
  const rentStep = waterfall.find((s) => s.type === "income");
  const resultStep = waterfall.find((s) => s.type === "result");

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Cashflow-Wasserfall</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={period === "monat" ? "default" : "ghost"}
            size="sm" className="text-[10px] h-5 px-2"
            onClick={() => setPeriod("monat")}
          >M</Button>
          <Button
            variant={period === "jahr" ? "default" : "ghost"}
            size="sm" className="text-[10px] h-5 px-2"
            onClick={() => setPeriod("jahr")}
          >J</Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Property selector */}
      {expanded && (
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="h-7 text-[10px] mb-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Objekte</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Waterfall chart (horizontal bars) */}
      <div className="space-y-1">
        {waterfall.map((step) => {
          const barWidth = maxValue > 0 ? (Math.abs(step.value) / maxValue) * 100 : 0;
          return (
            <div key={step.label} className="flex items-center gap-2 text-[10px]">
              <span className="w-24 text-right text-muted-foreground shrink-0 truncate">{step.label}</span>
              <div className="flex-1 h-4 relative">
                {step.type === "result" ? (
                  <div
                    className={`h-full rounded ${step.color} transition-all duration-500`}
                    style={{ width: `${Math.min(100, barWidth)}%` }}
                  />
                ) : (
                  <div
                    className={`h-full rounded ${step.color} transition-all duration-500`}
                    style={{ width: `${Math.min(100, barWidth)}%` }}
                  />
                )}
              </div>
              <span className={`w-20 text-right font-medium shrink-0 ${
                step.value >= 0 ? "text-profit" : "text-loss"
              }`}>
                {step.value >= 0 ? "+" : ""}{formatCurrency(step.value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {rentStep && resultStep && (
        <div className="mt-3 pt-2 border-t border-border grid grid-cols-2 gap-2 text-[10px]">
          <div className="text-center">
            <span className="text-muted-foreground">Einnahmen</span>
            <p className="font-bold text-profit">{formatCurrency(rentStep.value)}</p>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground">Netto</span>
            <p className={`font-bold ${resultStep.value >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(resultStep.value)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
CashflowWasserfall.displayName = "CashflowWasserfall";

export { CashflowWasserfall };
