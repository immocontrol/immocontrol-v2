import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useProperties } from "@/context/PropertyContext";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

const ContractExpiryCountdown = () => {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: contracts = [] } = useQuery({
    queryKey: ["contract_expiry_countdown"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, property_id, end_date, is_indefinite, status, contract_type, cold_rent")
        .eq("status", "active")
        .eq("is_indefinite", false)
        .not("end_date", "is", null)
        .order("end_date");
      return data || [];
    },
    enabled: !!user,
  });

  const expiring = contracts.map(c => {
    const daysLeft = Math.ceil((new Date(c.end_date!).getTime() - Date.now()) / 86400000);
    const prop = properties.find(p => p.id === c.property_id);
    return { ...c, daysLeft, propertyName: prop?.name || "–" };
  }).filter(c => c.daysLeft > 0 && c.daysLeft <= 180);

  if (expiring.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Clock className="h-4 w-4 text-gold" /> Vertragsablauf-Countdown
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">{expiring.length} Verträge laufen in den nächsten 6 Monaten aus</p>
      <div className="space-y-2">
        {expiring.slice(0, 5).map(c => (
          <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
            {c.daysLeft <= 30 ? (
              <AlertTriangle className="h-4 w-4 text-loss shrink-0" />
            ) : c.daysLeft <= 90 ? (
              <AlertTriangle className="h-4 w-4 text-gold shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{c.propertyName}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(c.end_date!).toLocaleDateString("de-DE")}
              </p>
            </div>
            <span className={`text-xs font-bold ${c.daysLeft <= 30 ? "text-loss" : c.daysLeft <= 90 ? "text-gold" : "text-muted-foreground"}`}>
              {c.daysLeft}d
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractExpiryCountdown;
