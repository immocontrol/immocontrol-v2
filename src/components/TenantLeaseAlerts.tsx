import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Clock, AlertTriangle, User } from "lucide-react";

interface TenantLeaseAlertsProps {
  propertyNames: Record<string, string>;
}

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  move_out_date: string | null;
  property_id: string;
  is_active: boolean;
}

const TenantLeaseAlerts = ({ propertyNames }: TenantLeaseAlertsProps) => {
  const { user } = useAuth();

  const { data: tenants = [] } = useQuery({
    queryKey: ["lease_alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, first_name, last_name, move_out_date, property_id, is_active")
        .eq("is_active", true)
        .not("move_out_date", "is", null);
      return (data || []) as Tenant[];
    },
    enabled: !!user,
  });

  const now = new Date();
  const alerts = tenants
    .map(t => {
      const end = new Date(t.move_out_date!);
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...t, days };
    })
    .filter(t => t.days <= 90 && t.days >= -30)
    .sort((a, b) => a.days - b.days);

  if (alerts.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-gold" />
        <span className="text-sm font-semibold">Auslaufende Mietverträge</span>
        <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-medium">{alerts.length}</span>
      </div>
      <div className="space-y-2">
        {alerts.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.days < 0 ? "bg-loss/10" : t.days <= 30 ? "bg-loss/10" : "bg-gold/10"}`}>
              {t.days < 0 ? <AlertTriangle className="h-3.5 w-3.5 text-loss" /> : <User className="h-3.5 w-3.5 text-gold" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{t.first_name} {t.last_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{propertyNames[t.property_id] || "Unbekannt"}</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${t.days < 0 ? "bg-loss/10 text-loss" : t.days <= 30 ? "bg-loss/10 text-loss" : "bg-gold/10 text-gold"}`}>
              {t.days < 0 ? `${Math.abs(t.days)}d abgelaufen` : `in ${t.days}d`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TenantLeaseAlerts;
