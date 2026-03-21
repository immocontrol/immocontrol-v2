/**
 * Syndication / Co-Invest-Tracking — Objekte mit mehreren Anteilseignern,
 * Anteile in %, Cashflow-Verteilung.
 */
import { useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Users, Landmark, FileBarChart, Home, ChevronRight } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES, propertyDetail } from "@/lib/routes";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/formatters";

const SyndicationPage = () => {
  const { user } = useAuth();
  const { properties, loading: propertiesLoading } = useProperties();
  const navigate = useNavigate();

  const { data: shareholders = [], isLoading: shareholdersLoading } = useQuery({
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

  const isLoading = propertiesLoading || shareholdersLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto px-4 py-6 min-w-0" role="status" aria-label="Syndication wird geladen">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-muted animate-pulse rounded" />
          <div className="h-4 w-72 bg-muted/70 animate-pulse rounded" />
          <div className="flex gap-2 mt-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-2">
              <div className="h-5 bg-muted animate-pulse rounded w-1/3" />
              <div className="h-4 bg-muted/80 animate-pulse rounded w-2/3" />
              <div className="h-4 bg-muted/60 animate-pulse rounded w-1/2" />
              <div className="flex justify-between gap-2 pt-2">
                <div className="h-3 bg-muted/50 animate-pulse rounded w-20" />
                <div className="h-3 bg-muted/50 animate-pulse rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 min-w-0" role="main" aria-label="Syndication">
        <EmptyState
          icon={Users}
          title="Keine Objekte"
          description="Syndication zeigt Objekte mit mehreren Anteilseignern (Co-Invest). Lege zuerst Objekte an und trage danach Anteilseigner in den Objektdetails ein."
          action={
            <Button onClick={() => navigate(ROUTES.OBJEKTE)} className="touch-target min-h-[44px] gap-2">
              <Home className="h-4 w-4" /> Objekte anlegen
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6 min-w-0" role="main" aria-label="Syndication">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> Syndication / Co-Invest
          </PageHeaderTitle>
          <PageHeaderDescription>
            {propsWithShares.length > 0
              ? `${propsWithShares.length} ${propsWithShares.length === 1 ? "Objekt" : "Objekte"} mit mehreren Anteilseignern — Anteile und Cashflow-Verteilung`
              : "Objekte mit mehreren Anteilseignern — Anteile und Cashflow-Verteilung"}
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
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
        </PageHeaderActions>
      </PageHeader>

      {propsWithShares.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Noch keine Co-Invest-Objekte"
          description="Trage bei Objekten Anteilseigner ein (Name, Anteil in %). Sobald ein Objekt mindestens zwei Anteilseigner hat, erscheint es hier mit Cashflow-Verteilung."
          action={
            <Button asChild variant="default" className="touch-target min-h-[44px] gap-2">
              <Link to={ROUTES.OBJEKTE}>
                <Home className="h-4 w-4" /> Zu Objekten
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {propsWithShares.map((p) => {
            const shares = shareholders.filter((s) => s.property_id === p.id);
            const totalShare = shares.reduce((s, sh) => s + Number(sh.share_percent), 0);
            const address = p.address || p.location || "";
            return (
              <Link
                key={p.id}
                to={propertyDetail(p.id)}
                className="block rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-md transition-all focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 group"
                aria-label={`${p.name} – Co-Invest-Details`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-wrap-safe break-words" title={p.name}>{p.name}</p>
                    {address && (
                      <p className="text-xs text-muted-foreground mt-0.5 min-w-0 text-wrap-safe break-words" title={address}>{address}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                </div>
                <p className="text-sm mt-2">
                  Cashflow/M: {formatCurrency(p.monthlyCashflow)} · Anteile gesamt: {totalShare}%
                </p>
                <div className="mt-2 space-y-1">
                  {shares.map((sh) => (
                    <div key={sh.id} className="flex justify-between text-xs gap-2 min-w-0">
                      <span className="truncate min-w-0" title={sh.shareholder_name || undefined}>{sh.shareholder_name || "Anteil"}</span>
                      <span className="shrink-0">{sh.share_percent}% → {formatCurrency((p.monthlyCashflow * Number(sh.share_percent)) / 100)}/M</span>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
