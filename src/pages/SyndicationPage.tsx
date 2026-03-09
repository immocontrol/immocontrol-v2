/**
 * Syndication / Co-Invest-Tracking — Objekte mit mehreren Anteilseignern,
 * Anteile in %, Cashflow-Verteilung.
 */
import { useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Users, Landmark, FileBarChart, Home } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/routes";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";

const SyndicationPage = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const navigate = useNavigate();

  const { data: shareholders = [] } = useQuery({
    queryKey: queryKeys.propertyShareholders.all(user?.id ?? ""),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("property_shareholders")
          .select("*")
          .eq("user_id", user!.id);
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  useEffect(() => {
    document.title = "Syndication – ImmoControl";
  }, []);

  const propsWithShares = useMemo(() => {
    const map = new Map<string, typeof shareholders>();
    for (const s of shareholders) {
      const arr = map.get(s.property_id) || [];
      arr.push(s);
      map.set(s.property_id, arr);
    }
    return properties.filter((p) => map.has(p.id) && (map.get(p.id)?.length ?? 0) > 1);
  }, [properties, shareholders]);

  if (properties.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="Syndication">
        <EmptyState
          icon={Users}
          title="Keine Objekte"
          description="Syndication basiert auf Objekten mit mehreren Anteilseignern. Lege zuerst Objekte an."
          action={
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => navigate(ROUTES.OBJEKTE)}
            >
              Objekte anlegen
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Syndication">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Syndication / Co-Invest
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Objekte mit mehreren Anteilseignern — Anteile und Cashflow-Verteilung
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.OBJEKTE} className="gap-1.5 touch-target min-h-[36px]" aria-label="Objekte">
              <Home className="h-3.5 w-3.5" /> Objekte
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.LOANS} className="gap-1.5 touch-target min-h-[36px]" aria-label="Darlehen">
              <Landmark className="h-3.5 w-3.5" /> Darlehen
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.REPORTS} className="gap-1.5 touch-target min-h-[36px]" aria-label="Berichte">
              <FileBarChart className="h-3.5 w-3.5" /> Berichte
            </Link>
          </Button>
        </div>
      </div>

      {propsWithShares.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
          Noch keine Co-Invest-Objekte. Anteilseigner können pro Objekt in den Objektdetails hinterlegt werden
          (Feature in Entwicklung).
        </div>
      ) : (
        <div className="space-y-4">
          {propsWithShares.map((p) => {
            const shares = shareholders.filter((s) => s.property_id === p.id);
            const totalShare = shares.reduce((s, sh) => s + Number(sh.share_percent), 0);
            return (
              <div key={p.id} className="rounded-xl border border-border p-4">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.address}</p>
                <p className="text-sm mt-2">
                  Cashflow/M: {formatCurrency(p.monthlyCashflow)} · Anteile gesamt: {totalShare}%
                </p>
                <div className="mt-2 space-y-1">
                  {shares.map((sh) => (
                    <div key={sh.id} className="flex justify-between text-xs">
                      <span>{sh.shareholder_name || "Anteil"}</span>
                      <span>{sh.share_percent}% → {formatCurrency((p.monthlyCashflow * Number(sh.share_percent)) / 100)}/M</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
