/**
 * #15: Mieterhöhungs-Timeline
 * Shows when each tenant is eligible for a rent increase based on §558 BGB.
 * Rules: Rent can be increased max 20% in 3 years (Kappungsgrenze),
 * and earliest 15 months after the last increase (12 months notice + 3 months effect).
 */
import { useMemo } from "react";
import { Calendar, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface TenantWithProperty {
  id: string;
  name: string;
  property_name: string;
  property_id: string;
  monthly_rent: number;
  lease_start: string | null;
  last_rent_increase: string | null;
}

interface TimelineEntry {
  tenant: TenantWithProperty;
  eligibleDate: Date;
  daysUntil: number;
  status: "eligible" | "soon" | "waiting";
  potentialIncrease: number;
}

export function RentIncreaseTimeline() {
  const { user } = useAuth();

  const { data: tenants = [] } = useQuery({
    queryKey: ["rent-increase-timeline"],
    queryFn: async () => {
      const { data: props } = await supabase
        .from("properties")
        .select("id, name")
        .eq("user_id", user!.id);
      if (!props || props.length === 0) return [];

      const propMap = Object.fromEntries(props.map(p => [p.id, p.name]));
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id, name, property_id, monthly_rent, lease_start, last_rent_increase")
        .eq("is_active", true)
        .in("property_id", props.map(p => p.id));

      return (tenantData || []).map(t => ({
        ...t,
        property_name: propMap[t.property_id] || "Unbekannt",
      })) as TenantWithProperty[];
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const timeline = useMemo<TimelineEntry[]>(() => {
    const now = new Date();
    return tenants
      .map(tenant => {
        // §558 BGB: 15 months after last increase (or lease start if no increase)
        const referenceDate = tenant.last_rent_increase || tenant.lease_start;
        if (!referenceDate) return null;

        const ref = new Date(referenceDate);
        const eligible = new Date(ref);
        eligible.setMonth(eligible.getMonth() + 15); // 12 months + 3 months notice

        const daysUntil = Math.ceil((eligible.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Potential increase: max 20% Kappungsgrenze over 3 years
        const potentialIncrease = tenant.monthly_rent * 0.2;

        let status: "eligible" | "soon" | "waiting" = "waiting";
        if (daysUntil <= 0) status = "eligible";
        else if (daysUntil <= 90) status = "soon";

        return { tenant, eligibleDate: eligible, daysUntil, status, potentialIncrease };
      })
      .filter((e): e is TimelineEntry => e !== null)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [tenants]);

  if (timeline.length === 0) return null;

  const eligible = timeline.filter(e => e.status === "eligible");
  const soon = timeline.filter(e => e.status === "soon");

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Mieterhöhungs-Timeline
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          §558 BGB
        </span>
      </div>

      {eligible.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-profit uppercase tracking-wider mb-1.5">
            Jetzt möglich ({eligible.length})
          </p>
          {eligible.slice(0, 3).map(e => (
            <div key={e.tenant.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{e.tenant.name}</p>
                <p className="text-[10px] text-muted-foreground">{e.tenant.property_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-profit">+{formatCurrency(e.potentialIncrease)}/M</p>
                <p className="text-[10px] text-muted-foreground">max. Kappung</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {soon.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gold uppercase tracking-wider mb-1.5">
            In Kürze ({soon.length})
          </p>
          {soon.slice(0, 3).map(e => (
            <div key={e.tenant.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{e.tenant.name}</p>
                <p className="text-[10px] text-muted-foreground">{e.tenant.property_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium">{e.daysUntil} Tage</p>
                <p className="text-[10px] text-muted-foreground">
                  ab {e.eligibleDate.toLocaleDateString("de-DE")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {timeline.filter(e => e.status === "waiting").length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2">
          <Clock className="h-3 w-3 inline mr-1" />
          {timeline.filter(e => e.status === "waiting").length} weitere Mieter in Wartezeit
        </p>
      )}
    </div>
  );
}

export default RentIncreaseTimeline;
