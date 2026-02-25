import { useMemo } from "react";
import { Home, AlertTriangle } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

const VacancyCostCalc = () => {
  const { properties } = useProperties();
  const { user } = useAuth();

  const { data: tenants = [] } = useQuery({
    queryKey: ["vacancy_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("property_id, is_active, monthly_rent");
      return data || [];
    },
    enabled: !!user,
  });

  const vacancyCosts = useMemo(() => {
    return properties.map(p => {
      const activeTenants = tenants.filter(t => t.property_id === p.id && t.is_active);
      const occupiedUnits = activeTenants.length;
      const vacantUnits = Math.max(0, p.units - occupiedUnits);
      if (vacantUnits === 0) return null;
      const avgRentPerUnit = p.units > 0 ? p.monthlyRent / p.units : 0;
      const lostRentMonthly = avgRentPerUnit * vacantUnits;
      const ongoingCostsPerUnit = p.units > 0 ? (p.monthlyExpenses + p.monthlyCreditRate) / p.units : 0;
      const vacancyCostMonthly = lostRentMonthly + ongoingCostsPerUnit * vacantUnits;
      return {
        name: p.name,
        vacantUnits,
        totalUnits: p.units,
        lostRentMonthly,
        vacancyCostMonthly,
        vacancyCostAnnual: vacancyCostMonthly * 12,
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[number]>[];
  }, [properties, tenants]);

  if (vacancyCosts.length === 0) return null;

  const totalAnnualCost = vacancyCosts.reduce((s, v: any) => s + v.vacancyCostAnnual, 0);

  return (
    <div className="gradient-card rounded-xl border border-loss/20 p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Home className="h-4 w-4 text-loss" /> Leerstandskosten
      </h3>
      <div className="space-y-2">
        {vacancyCosts.map((v: any, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-loss/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-loss" />
              <span className="font-medium">{v.name}</span>
              <span className="text-muted-foreground">{v.vacantUnits}/{v.totalUnits} leer</span>
            </div>
            <span className="font-semibold text-loss">{formatCurrency(v.vacancyCostMonthly)}/M</span>
          </div>
        ))}
        <div className="border-t border-border pt-2 flex justify-between text-xs font-semibold">
          <span>Gesamtkosten Leerstand</span>
          <span className="text-loss">{formatCurrency(totalAnnualCost)}/Jahr</span>
        </div>
      </div>
    </div>
  );
};

export default VacancyCostCalc;