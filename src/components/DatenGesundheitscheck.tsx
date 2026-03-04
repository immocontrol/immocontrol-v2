/**
 * IMP20-16: Daten-Gesundheitscheck
 * Settings or Dashboard: Identify missing data (no tenant, no insurance,
 * no energy cert, no meter readings).
 */
import { memo, useMemo } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2, Users, Shield, Zap, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DataHealthItem {
  label: string;
  description: string;
  icon: typeof AlertTriangle;
  status: "ok" | "warning" | "missing";
  count: number;
  total: number;
}

const DatenGesundheitscheck = memo(() => {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: tenants = [] } = useQuery({
    queryKey: ["health_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("property_id").eq("is_active", true);
      return (data || []) as Array<{ property_id: string }>;
    },
    enabled: !!user,
  });

  const { data: insurances = [] } = useQuery({
    queryKey: ["health_insurances"],
    queryFn: async () => {
      const { data } = await supabase.from("insurances").select("property_id");
      return (data || []) as Array<{ property_id: string }>;
    },
    enabled: !!user,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["health_documents"],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("property_id, category");
      return (data || []) as Array<{ property_id: string; category: string }>;
    },
    enabled: !!user,
  });

  const healthItems = useMemo((): DataHealthItem[] => {
    if (properties.length === 0) return [];
    const total = properties.length;

    const tenantPropertyIds = new Set(tenants.map(t => t.property_id));
    const propertiesWithTenant = properties.filter(p => tenantPropertyIds.has(p.id)).length;

    const insurancePropertyIds = new Set(insurances.map(i => i.property_id));
    const propertiesWithInsurance = properties.filter(p => insurancePropertyIds.has(p.id)).length;

    const energyCertDocs = documents.filter(d => d.category?.toLowerCase().includes("energie"));
    const energyCertPropertyIds = new Set(energyCertDocs.map(d => d.property_id));
    const propertiesWithEnergyCert = properties.filter(p => energyCertPropertyIds.has(p.id)).length;

    const propertiesWithRent = properties.filter(p => p.monthlyRent > 0).length;

    return [
      {
        label: "Mieterdaten",
        description: "Aktive Mieter zugeordnet",
        icon: Users,
        status: propertiesWithTenant >= total ? "ok" : propertiesWithTenant > 0 ? "warning" : "missing",
        count: propertiesWithTenant,
        total,
      },
      {
        label: "Versicherungen",
        description: "Gebäudeversicherung hinterlegt",
        icon: Shield,
        status: propertiesWithInsurance >= total ? "ok" : propertiesWithInsurance > 0 ? "warning" : "missing",
        count: propertiesWithInsurance,
        total,
      },
      {
        label: "Energieausweis",
        description: "Energieausweis hochgeladen",
        icon: Zap,
        status: propertiesWithEnergyCert >= total ? "ok" : propertiesWithEnergyCert > 0 ? "warning" : "missing",
        count: propertiesWithEnergyCert,
        total,
      },
      {
        label: "Mieteinnahmen",
        description: "Monatliche Miete erfasst",
        icon: Gauge,
        status: propertiesWithRent >= total ? "ok" : propertiesWithRent > 0 ? "warning" : "missing",
        count: propertiesWithRent,
        total,
      },
    ];
  }, [properties, tenants, insurances, documents]);

  if (properties.length === 0) return null;

  const healthScore = healthItems.length > 0
    ? Math.round((healthItems.filter(i => i.status === "ok").length / healthItems.length) * 100)
    : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Daten-Gesundheitscheck</h3>
        </div>
        <Badge
          className={`text-[10px] h-5 ${
            healthScore >= 75 ? "bg-profit/20 text-profit" :
            healthScore >= 50 ? "bg-gold/20 text-gold" :
            "bg-loss/20 text-loss"
          }`}
        >
          {healthScore}% vollständig
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-secondary rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            healthScore >= 75 ? "bg-profit" : healthScore >= 50 ? "bg-gold" : "bg-loss"
          }`}
          style={{ width: `${healthScore}%` }}
        />
      </div>

      <div className="space-y-2">
        {healthItems.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
            {item.status === "ok" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-profit shrink-0" />
            ) : item.status === "warning" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0" />
            ) : (
              <item.icon className="h-3.5 w-3.5 text-loss shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.description}</p>
            </div>
            <span className={`text-[10px] font-medium ${
              item.status === "ok" ? "text-profit" : item.status === "warning" ? "text-gold" : "text-loss"
            }`}>
              {item.count}/{item.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
DatenGesundheitscheck.displayName = "DatenGesundheitscheck";

export { DatenGesundheitscheck };
