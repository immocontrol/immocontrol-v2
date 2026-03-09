/**
 * Portfolio-Diversifikations-Heatmap — Verteilung nach Region,
 * Objekttyp, Mieterkonzentration, Risiko-Indikatoren.
 */
import { useMemo, useState } from "react";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatPercentDE } from "@/lib/formatters";
import { AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { isDeepSeekConfigured, suggestDiversificationInterpretation } from "@/integrations/ai/extractors";

export function PortfolioDiversifikation() {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [aiLoading, setAiLoading] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ["diversifikation_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, property_id, monthly_rent").eq("is_active", true);
      return data || [];
    },
    enabled: !!user,
  });

  const analysis = useMemo(() => {
    if (properties.length === 0) return null;

    const byLocation = new Map<string, { rent: number; value: number }>();
    const byType = new Map<string, { count: number; rent: number }>();
    let tenantConcentration = 0;
    const rentByProperty = new Map<string, number>();

    for (const p of properties) {
      const loc = p.location || p.address?.split(",")[0] || "Unbekannt";
      const existing = byLocation.get(loc) || { rent: 0, value: 0 };
      byLocation.set(loc, {
        rent: existing.rent + p.monthlyRent,
        value: existing.value + p.currentValue,
      });

      const t = p.type || "ETW";
      const tExisting = byType.get(t) || { count: 0, rent: 0 };
      byType.set(t, { count: tExisting.count + 1, rent: tExisting.rent + p.monthlyRent });
      rentByProperty.set(p.id, p.monthlyRent);
    }

    const totalRent = stats.totalRent * 12;
    for (const [, rent] of rentByProperty) {
      const share = totalRent > 0 ? (rent * 12) / totalRent : 0;
      if (share > 0.4) tenantConcentration = Math.max(tenantConcentration, share);
    }

    const locationShare = Array.from(byLocation.entries()).map(([loc, d]) => ({
      location: loc,
      rentShare: totalRent > 0 ? (d.rent * 12 / totalRent) * 100 : 0,
      valueShare: stats.totalValue > 0 ? (d.value / stats.totalValue) * 100 : 0,
    }));

    const typeShare = Array.from(byType.entries()).map(([type, d]) => ({
      type,
      count: d.count,
      rentShare: totalRent > 0 ? (d.rent * 12 / totalRent) * 100 : 0,
    }));

    return {
      byLocation: locationShare.sort((a, b) => b.rentShare - a.rentShare),
      byType: typeShare.sort((a, b) => b.rentShare - a.rentShare),
      maxLocationShare: Math.max(...locationShare.map((l) => l.rentShare), 0),
      maxTypeShare: Math.max(...typeShare.map((t) => t.rentShare), 0),
      tenantConcentration,
    };
  }, [properties, stats, tenants]);

  if (!analysis || properties.length === 0) return null;

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Portfolio-Diversifikation</h3>
        {isDeepSeekConfigured() && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={aiLoading}
            onClick={async () => {
              setAiLoading(true);
              try {
                const text = await suggestDiversificationInterpretation({
                  propertyCount: properties.length,
                  maxLocationShare: analysis.maxLocationShare,
                  tenantConcentration: analysis.tenantConcentration,
                  locations: analysis.byLocation.map((l) => l.location),
                  types: analysis.byType.map((t) => t.type),
                });
                if (text) toast.info(text, { duration: 8000 });
              } catch (e) {
                handleError(e, { context: "ai", details: "diversification", showToast: true });
              } finally {
                setAiLoading(false);
              }
            }}
            aria-label="KI Einschätzung"
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            KI Einschätzung
          </Button>
        )}
      </div>

      {analysis.tenantConcentration > 0.4 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-xs">
            Mieterkonzentration: Über 40% der Miete von einem Objekt — Risiko bei Leerstand erhöht.
          </span>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-2">Verteilung nach Region (Anteil Miete)</p>
        <div className="space-y-1.5">
          {analysis.byLocation.slice(0, 6).map((l) => (
            <div key={l.location} className="flex items-center gap-2">
              <span className="text-xs w-24 truncate" title={l.location}>
                {l.location}
              </span>
              <div className="flex-1 h-4 rounded bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded transition-all"
                  style={{ width: `${Math.min(100, l.rentShare)}%` }}
                />
              </div>
              <span className="text-xs w-10 text-right">{formatPercentDE(l.rentShare)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Verteilung nach Objekttyp</p>
        <div className="flex flex-wrap gap-2">
          {analysis.byType.map((t) => (
            <div
              key={t.type}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-xs"
            >
              <span>{t.type}</span>
              <span className="text-muted-foreground">({t.count})</span>
              <span className="font-medium">{formatPercentDE(t.rentShare)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
