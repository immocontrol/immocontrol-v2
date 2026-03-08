/**
 * Leerstands-Szenarien-Rechner
 * Verschiedene Szenarien (Mieterwechsel, Sanierung, Renovierung, Vollleerstand) mit Kosten.
 */
import { memo, useMemo, useState } from "react";
import { Home, Wrench, Building2, AlertTriangle } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const SCENARIOS = [
  { key: "mieterwechsel", label: "Mieterwechsel", months: 1, icon: Home },
  { key: "renovierung", label: "Renovierung", months: 2, icon: Wrench },
  { key: "sanierung", label: "Sanierung", months: 3, icon: Building2 },
  { key: "voll", label: "Vollleerstand", months: 12, icon: AlertTriangle },
] as const;

interface VacancyScenariosProps {
  propertyId?: string;
}

const VacancyScenarios = memo(({ propertyId }: VacancyScenariosProps) => {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: loans = [] } = useQuery({
    queryKey: ["vacancy_scenarios_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, monthly_payment, property_id");
      return (data || []) as Array<{ id: string; monthly_payment: number; property_id: string }>;
    },
    enabled: !!user,
  });

  const props = useMemo(() => {
    const list = propertyId
      ? properties.filter(p => p.id === propertyId)
      : properties;
    return list;
  }, [properties, propertyId]);

  const data = useMemo(() => {
    return props.map((p) => {
      const pLoans = loans.filter((l) => l.property_id === p.id);
      const monthlyDebt = pLoans.reduce((s, l) => s + (l.monthly_payment || 0), 0);
      const monthlyExpenses = p.monthlyExpenses || 0;
      const monthlyRent = p.monthlyRent || 0;
      const directCosts = monthlyDebt + monthlyExpenses;
      const opportunityCost = monthlyRent;

      const scenarioCosts = SCENARIOS.map((s) => {
        const total = (directCosts + opportunityCost) * s.months;
        return { ...s, total, directCosts, opportunityCost };
      });

      return {
        id: p.id,
        name: p.name,
        monthlyRent,
        directCosts,
        scenarioCosts,
      };
    });
  }, [props, loans]);

  if (props.length === 0) return null;

  const totalByScenario = SCENARIOS.map((s) => {
    const sum = data.reduce((acc, d) => {
      const sc = d.scenarioCosts.find(x => x.key === s.key);
      return acc + (sc?.total ?? 0);
    }, 0);
    return { ...s, total: sum };
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Home className="h-4 w-4 text-primary" />
        Leerstands-Szenarien
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        Geschätzte Kosten je Szenario (Fixkosten + entgangene Miete).
      </p>
      <div className="grid grid-cols-2 gap-2">
        {totalByScenario.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className="rounded-lg border border-border bg-background/50 p-3 text-center"
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xs font-bold text-loss">{formatCurrency(s.total)}</p>
              <p className="text-[9px] text-muted-foreground">{s.months} Mon.</p>
            </div>
          );
        })}
      </div>
      {data.length > 0 && data.length <= 3 && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          {data.map((d) => (
            <div key={d.id} className="text-[10px] flex justify-between items-center">
              <span className="truncate">{d.name}</span>
              <span className="text-loss font-medium">
                {formatCurrency(d.scenarioCosts[0]?.total ?? 0)}/1M
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

VacancyScenarios.displayName = "VacancyScenarios";

export { VacancyScenarios };
