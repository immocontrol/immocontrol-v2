import { useMemo } from "react";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

const KautionsOverview = ({ propertyId }: { propertyId?: string }) => {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: tenants = [] } = useQuery({
    queryKey: ["kautions_tenants", propertyId],
    queryFn: async () => {
      let q = supabase.from("tenants").select("*").eq("is_active", true);
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const total = tenants.reduce((s, t) => s + Number(t.deposit || 0), 0);
    const withDeposit = tenants.filter(t => Number(t.deposit || 0) > 0);
    const withoutDeposit = tenants.filter(t => !t.deposit || Number(t.deposit) === 0);
    const expectedTotal = tenants.reduce((s, t) => s + Number(t.monthly_rent || 0) * 3, 0);
    return { total, withDeposit: withDeposit.length, withoutDeposit: withoutDeposit.length, expectedTotal, coverage: expectedTotal > 0 ? (total / expectedTotal * 100) : 0 };
  }, [tenants]);

  if (tenants.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" /> Kautionsübersicht
        </h3>
        <span className="text-sm font-bold">{formatCurrency(stats.total)}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-secondary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">Eingezahlt</div>
          <div className="text-sm font-bold">{stats.withDeposit}</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">Fehlend</div>
          <div className={`text-sm font-bold ${stats.withoutDeposit > 0 ? "text-loss" : "text-profit"}`}>{stats.withoutDeposit}</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">Deckung</div>
          <div className={`text-sm font-bold ${stats.coverage >= 80 ? "text-profit" : stats.coverage >= 50 ? "text-gold" : "text-loss"}`}>{stats.coverage.toFixed(0)}%</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {tenants.map(t => {
          const deposit = Number(t.deposit || 0);
          const expected = Number(t.monthly_rent || 0) * 3;
          const prop = properties.find(p => p.id === t.property_id);
          return (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              {deposit > 0 ? <CheckCircle className="h-3.5 w-3.5 text-profit shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 text-loss shrink-0" />}
              <span className="truncate flex-1">{t.first_name} {t.last_name}</span>
              {!propertyId && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{prop?.name}</span>}
              <span className={`font-medium tabular-nums ${deposit > 0 ? "" : "text-loss"}`}>
                {deposit > 0 ? formatCurrency(deposit) : "fehlt"}
              </span>
              {expected > 0 && deposit > 0 && (
                <span className="text-[10px] text-muted-foreground">/ {formatCurrency(expected)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KautionsOverview;
