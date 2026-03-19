/**
 * Gamification: Erfolge – Einheiten, Ziele, Meilensteine, Achievements, Level, Streak, Rückblick.
 */
import { useMemo } from "react";
import { Trophy, Flame, Target, Star, Share2, Wallet, TrendingUp } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/typedSupabase";
import { useAchievements } from "@/hooks/useAchievements";
import { useUserActivity } from "@/hooks/useUserActivity";
import { useStatsSnapshots } from "@/hooks/useStatsSnapshots";
import { EinheitenZaehler } from "@/components/EinheitenZaehler";
import PortfolioGoals from "@/components/PortfolioGoals";
import { getCategoryLabel, type AchievementCategory } from "@/lib/achievements";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";

function sparklinePoints(values: number[], w = 120, h = 28): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
}

function unitsAcquiredLast12Months(properties: { units: number; purchaseDate: string }[]): number {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return properties
    .filter((p) => p.purchaseDate && p.purchaseDate >= cutoffStr)
    .reduce((sum, p) => sum + (p.units || 0), 0);
}

export default function Erfolge() {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const unitsPerYear = useMemo(() => unitsAcquiredLast12Months(properties), [properties]);

  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ["portfolio_goals"],
    queryFn: async () => {
      const { data } = await fromTable("portfolio_goals").select("id, type, target, title, current_value").order("created_at");
      return (data || []) as { id: string; type: string; target: number; title: string; current_value?: number }[];
    },
    enabled: !!user,
  });

  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  const { data: tenantsCount = 0 } = useQuery({
    queryKey: ["erfolge_tenants_count", propertyIds],
    queryFn: async () => {
      if (propertyIds.length === 0) return 0;
      const { count } = await supabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .in("property_id", propertyIds);
      return count ?? 0;
    },
    enabled: !!user && propertyIds.length > 0,
  });

  const { data: viewingsCount = 0 } = useQuery({
    queryKey: ["erfolge_viewings_count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("property_viewings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: documentsCount = 0 } = useQuery({
    queryKey: ["erfolge_documents_count", propertyIds],
    queryFn: async () => {
      if (propertyIds.length === 0) return 0;
      const { count } = await supabase
        .from("property_documents")
        .select("id", { count: "exact", head: true })
        .in("property_id", propertyIds);
      return count ?? 0;
    },
    enabled: !!user && propertyIds.length > 0,
  });

  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ["erfolge_deals", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("id, stage");
      const list = (data || []) as { id: string; stage: string }[];
      return {
        count: list.length,
        abgeschlossen: list.filter((d) => d.stage === "abgeschlossen").length,
      };
    },
    enabled: !!user,
  });

  const dealsCount = dealsData?.count ?? 0;
  const dealsAbgeschlossenCount = dealsData?.abgeschlossen ?? 0;

  const { streak } = useUserActivity();

  const achievementOpts = useMemo(
    () => ({
      goals,
      unitsPerYear,
      tenantsCount,
      viewingsCount,
      documentsCount,
      dealsCount,
      dealsAbgeschlossenCount,
      streak,
      showToastOnUnlock: true,
    }),
    [
      goals,
      unitsPerYear,
      tenantsCount,
      viewingsCount,
      documentsCount,
      dealsCount,
      dealsAbgeschlossenCount,
      streak,
    ]
  );

  const { reached, all: allAchievements, points, level, progressToNext } = useAchievements(achievementOpts);
  const { snapshots } = useStatsSnapshots();

  const yearRecap = useMemo(() => {
    if (snapshots.length < 2) return null;
    const year = new Date().getFullYear();
    const firstDay = `${year}-01-01`;
    const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const atStart = sorted.find((s) => s.snapshot_date >= firstDay);
    const atEnd = sorted[sorted.length - 1];
    if (!atStart || !atEnd) return null;
    return {
      year,
      unitsStart: atStart.total_units,
      unitsEnd: atEnd.total_units,
      cashflowStart: Number(atStart.total_cashflow),
      cashflowEnd: Number(atEnd.total_cashflow),
    };
  }, [snapshots]);

  const quarterRecap = useMemo(() => {
    if (snapshots.length < 2) return null;
    const now = new Date();
    const year = now.getFullYear();
    const q = Math.floor(now.getMonth() / 3) + 1;
    const firstDay = `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
    const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const atStart = sorted.find((s) => s.snapshot_date >= firstDay);
    const atEnd = sorted[sorted.length - 1];
    if (!atStart || !atEnd || atStart.snapshot_date > atEnd.snapshot_date) return null;
    const unitsDiff = atEnd.total_units - atStart.total_units;
    const cashflowDiff = Number(atEnd.total_cashflow) - Number(atStart.total_cashflow);
    return {
      label: `Q${q} ${year}`,
      unitsDiff,
      cashflowDiff,
    };
  }, [snapshots]);

  const historyForSparkline = useMemo(() => {
    const list = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    return list.slice(-30);
  }, [snapshots]);

  const cashflowSparkline = useMemo(
    () => (historyForSparkline.length >= 2 ? sparklinePoints(historyForSparkline.map((s) => Number(s.total_cashflow))) : null),
    [historyForSparkline]
  );
  const equitySparkline = useMemo(
    () => (historyForSparkline.length >= 2 ? sparklinePoints(historyForSparkline.map((s) => Number(s.equity))) : null),
    [historyForSparkline]
  );

  const pageLoading = goalsLoading || dealsLoading;

  const reachedIds = useMemo(() => new Set(reached.map((a) => a.id)), [reached]);
  const goalsReachedCount = useMemo(() => {
    return goals.filter((g) => {
      let current = 0;
      if (g.type === "value") current = stats.totalValue;
      else if (g.type === "cashflow") current = stats.totalCashflow;
      else if (g.type === "units") current = stats.totalUnits;
      else if (g.type === "equity") current = stats.equity;
      else if (g.type === "units_per_year") current = unitsPerYear;
      return g.target > 0 && current >= g.target;
    }).length;
  }, [goals, stats.totalValue, stats.totalCashflow, stats.totalUnits, stats.equity, unitsPerYear]);

  const occupancyPct = useMemo(() => {
    return stats.totalUnits > 0 ? Math.min(100, Math.round((tenantsCount / stats.totalUnits) * 100)) : 0;
  }, [tenantsCount, stats.totalUnits]);

  const getLockedProgress = (achievementId: string): string | null => {
    switch (achievementId) {
      case "5_units": return `${Math.min(stats.totalUnits, 5)} / 5 Einheiten`;
      case "10_units": return `${Math.min(stats.totalUnits, 10)} / 10 Einheiten`;
      case "25_units": return `${Math.min(stats.totalUnits, 25)} / 25 Einheiten`;
      case "50_units": return `${Math.min(stats.totalUnits, 50)} / 50 Einheiten`;
      case "10_deals_pipeline": return `${Math.min(dealsCount, 10)} / 10 Deals`;
      case "occupancy_100": return `${occupancyPct} / 100 % Belegung`;
      case "cashflow_1k": return `${Math.round(Math.min(stats.totalCashflow, 1000))} / 1000 €`;
      case "equity_100k": return `${Math.round(Math.min(stats.equity, 100000))} / 100000 €`;
      case "equity_500k": return `${Math.round(Math.min(stats.equity, 500000))} / 500000 €`;
      case "rendite_5": return `${Math.min(Math.round(stats.avgRendite ?? 0), 5)} / 5 %`;
      case "streak_7": return `${Math.min(streak, 7)} / 7 Tage`;
      case "first_goal_reached": return `${Math.min(goalsReachedCount, 1)} / 1 Ziel`;
      default: return null;
    }
  };

  const byCategory = useMemo(() => {
    const map = new Map<AchievementCategory, typeof allAchievements>();
    for (const a of allAchievements) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return map;
  }, [allAchievements]);

  if (pageLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="gradient-card rounded-xl border border-border p-4 h-24 bg-muted/50 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border p-5 h-48 bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold" />
          Erfolge
        </h1>
        <Link to={ROUTES.PERSONAL_DASHBOARD}>
          <Button variant="outline" size="sm">Zum Dashboard</Button>
        </Link>
      </div>

      {/* Level & Punkte & Streak */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Level</p>
          <p className="text-lg font-bold flex items-center gap-1.5">
            <span aria-hidden>{level.emoji}</span>
            {level.title}
          </p>
          <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progressToNext.progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {points} Punkte
            {progressToNext.next && ` · Noch ${progressToNext.pointsToNext} bis ${progressToNext.next.title}`}
          </p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Aktiv-Streak</p>
          <p className="text-lg font-bold flex items-center gap-1.5">
            <Flame className={cn("h-4 w-4", streak > 0 && "text-amber-500")} />
            {streak} {streak === 1 ? "Tag" : "Tage"} in Folge
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Täglich einloggen hält den Streak</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Achievements</p>
          <p className="text-lg font-bold">
            {reached.length} / {allAchievements.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Badges freigeschaltet</p>
        </div>
      </div>

      {/* Einheiten & Ziele & Meilensteine */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Überblick</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <EinheitenZaehler />
          <div id="portfolio-goals-widget">
            <PortfolioGoals
              currentStats={{
                totalValue: stats.totalValue,
                totalCashflow: stats.totalCashflow,
                totalUnits: stats.totalUnits,
                equity: stats.equity,
              }}
            />
          </div>
          <PortfolioMilestonesWithShare />
        </div>
      </section>

      {/* Verlauf: Cashflow & Eigenkapital */}
      {(cashflowSparkline || equitySparkline) && (
        <section className="gradient-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3">Verlauf</h2>
          <div className="flex flex-wrap gap-6">
            {cashflowSparkline && (
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                <svg viewBox="0 0 120 28" className="w-[120px] h-7 text-primary" aria-hidden>
                  <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={cashflowSparkline} />
                </svg>
                <span className="text-[10px] text-muted-foreground">Cashflow</span>
              </div>
            )}
            {equitySparkline && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                <svg viewBox="0 0 120 28" className="w-[120px] h-7 text-primary" aria-hidden>
                  <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={equitySparkline} />
                </svg>
                <span className="text-[10px] text-muted-foreground">Eigenkapital</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quartals- & Jahres-Rückblick */}
      {(quarterRecap || yearRecap) ? (
        <section className="gradient-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3">Rückblick</h2>
          <div className="flex flex-wrap gap-4">
            {quarterRecap && (
              <div className="text-sm">
                <p className="text-muted-foreground">{quarterRecap.label}</p>
                <p>
                  {(quarterRecap.unitsDiff !== 0 || quarterRecap.cashflowDiff !== 0) && (
                    <>
                      {quarterRecap.unitsDiff !== 0 && (
                        <span className={cn(quarterRecap.unitsDiff > 0 ? "text-profit" : "text-loss")}>
                          {quarterRecap.unitsDiff > 0 ? "+" : ""}{quarterRecap.unitsDiff} Einh.
                        </span>
                      )}
                      {quarterRecap.unitsDiff !== 0 && quarterRecap.cashflowDiff !== 0 && " · "}
                      {quarterRecap.cashflowDiff !== 0 && (
                        <span className={cn(quarterRecap.cashflowDiff > 0 ? "text-profit" : "text-loss")}>
                          {quarterRecap.cashflowDiff > 0 ? "+" : ""}{formatCurrency(quarterRecap.cashflowDiff)} Cashflow
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            )}
            {yearRecap && (
              <div className="text-sm">
                <p className="text-muted-foreground">Dein {yearRecap.year}</p>
                <p>
                  Von {yearRecap.unitsStart} auf {yearRecap.unitsEnd} Einheiten
                  {yearRecap.cashflowEnd !== yearRecap.cashflowStart && (
                    <span className="text-muted-foreground">
                      {" "}
                      · Cashflow {formatCurrency(yearRecap.cashflowStart)} → {formatCurrency(yearRecap.cashflowEnd)}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="gradient-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-2">Rückblick</h2>
          <p className="text-xs text-muted-foreground">
            Quartals- und Jahres-Rückblick erscheinen nach mehreren Snapshot-Tagen.
          </p>
        </section>
      )}

      {/* Achievement-Badges */}
      <section id="badges">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Badges</h2>
        <div className="space-y-4">
          {Array.from(byCategory.entries()).map(([category, list]) => (
            <div key={category}>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{getCategoryLabel(category)}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {list.map((a) => {
                  const unlocked = reachedIds.has(a.id);
                  const Icon = a.icon;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "rounded-lg border p-3 flex items-start gap-2",
                        unlocked ? "border-gold/40 bg-gold/5" : "border-border bg-muted/30 opacity-75"
                      )}
                      title={a.description}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", unlocked ? "text-gold" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <p className={cn("text-xs font-medium truncate", unlocked && "text-foreground")}>{a.title}</p>
                        {!unlocked && getLockedProgress(a.id) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {getLockedProgress(a.id)}
                          </p>
                        )}
                        {unlocked && <Star className="h-3 w-3 text-gold fill-gold mt-0.5" aria-hidden />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PortfolioMilestonesWithShare() {
  const { properties, stats } = useProperties();
  const milestones = useMemo(() => {
    if (properties.length === 0) return [];
    return [
      { label: "Erstes Objekt", reached: stats.propertyCount >= 1 },
      { label: "5 Objekte", reached: stats.propertyCount >= 5 },
      { label: "10 Objekte", reached: stats.propertyCount >= 10 },
      { label: "€100k EK", reached: stats.equity >= 100000 },
      { label: "€500k EK", reached: stats.equity >= 500000 },
      { label: "€1M EK", reached: stats.equity >= 1000000 },
      { label: "Pos. Cashflow", reached: stats.totalCashflow > 0 },
      { label: "€1.000/M Cashflow", reached: stats.totalCashflow >= 1000 },
      { label: "5% Rendite", reached: (stats.avgRendite ?? 0) >= 5 },
    ];
  }, [properties, stats]);
  const reachedCount = milestones.filter((m) => m.reached).length;

  const handleShare = async () => {
    const text = `Ich habe ${reachedCount} von ${milestones.length} Meilensteinen in ImmoControl erreicht!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ImmoControl Meilensteine",
          text,
        });
        toast.success("Geteilt!");
      } catch {
        await copyToClipboard(text);
        toast.success("In Zwischenablage kopiert");
      }
    } else {
      await copyToClipboard(text);
      toast.success("In Zwischenablage kopiert");
    }
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          Meilensteine
          <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">
            {reachedCount}/{milestones.length}
          </span>
        </h3>
        {reachedCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleShare} aria-label="Meilensteine teilen">
            <Share2 className="h-3.5 w-3.5" />
            Teilen
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {milestones.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 text-xs p-1.5 rounded",
              m.reached ? "text-profit" : "text-muted-foreground"
            )}
          >
            {m.reached ? <Star className="h-3 w-3 text-gold fill-gold shrink-0" /> : <Star className="h-3 w-3 shrink-0" />}
            <span className={m.reached ? "line-through opacity-60" : ""}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}
