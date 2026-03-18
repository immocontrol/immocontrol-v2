/**
 * Gamification: Erfolge – Einheiten, Ziele, Meilensteine, Achievements, Level, Streak, Rückblick.
 */
import { useMemo } from "react";
import { Trophy, Flame, Target, Star, Share2 } from "lucide-react";
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
import PortfolioMilestones from "@/components/PortfolioMilestones";
import { getCategoryLabel, type AchievementCategory } from "@/lib/achievements";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";

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

  const { data: goals = [] } = useQuery({
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

  const { data: dealsData } = useQuery({
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

  const achievementOpts = useMemo(
    () => ({
      goals,
      unitsPerYear,
      tenantsCount,
      viewingsCount,
      documentsCount,
      dealsCount,
      dealsAbgeschlossenCount,
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
    ]
  );

  const { reached, all: allAchievements, points, level, progressToNext } = useAchievements(achievementOpts);
  const { streak } = useUserActivity();
  const { snapshots } = useStatsSnapshots();

  const monthRecap = useMemo(() => {
    if (snapshots.length < 2) return null;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const atStart = sorted.find((s) => s.snapshot_date >= firstDay);
    const atEnd = sorted[sorted.length - 1];
    if (!atStart || !atEnd || atStart.snapshot_date > atEnd.snapshot_date) return null;
    const unitsDiff = atEnd.total_units - atStart.total_units;
    const cashflowDiff = Number(atEnd.total_cashflow) - Number(atStart.total_cashflow);
    return {
      monthName: now.toLocaleDateString("de-DE", { month: "long" }),
      unitsDiff,
      cashflowDiff,
    };
  }, [snapshots, stats.totalUnits, stats.totalCashflow]);

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

  const reachedIds = useMemo(() => new Set(reached.map((a) => a.id)), [reached]);
  const byCategory = useMemo(() => {
    const map = new Map<AchievementCategory, typeof allAchievements>();
    for (const a of allAchievements) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return map;
  }, [allAchievements]);

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

      {/* Monats- / Jahres-Rückblick */}
      {(monthRecap || yearRecap) && (
        <section className="gradient-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3">Rückblick</h2>
          <div className="flex flex-wrap gap-4">
            {monthRecap && (
              <div className="text-sm">
                <p className="text-muted-foreground">Dein {monthRecap.monthName}</p>
                <p>
                  {monthRecap.unitsDiff !== 0 && (
                    <span className={cn(monthRecap.unitsDiff > 0 ? "text-profit" : "text-loss")}>
                      {monthRecap.unitsDiff > 0 ? "+" : ""}{monthRecap.unitsDiff} Einheiten
                    </span>
                  )}
                  {monthRecap.unitsDiff !== 0 && monthRecap.cashflowDiff !== 0 && " · "}
                  {monthRecap.cashflowDiff !== 0 && (
                    <span className={cn(monthRecap.cashflowDiff > 0 ? "text-profit" : "text-loss")}>
                      {monthRecap.cashflowDiff > 0 ? "+" : ""}{formatCurrency(monthRecap.cashflowDiff)} Cashflow
                    </span>
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
      )}

      {/* Achievement-Badges */}
      <section>
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
      } catch {
        await copyToClipboard(text);
      }
    } else {
      await copyToClipboard(text);
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
