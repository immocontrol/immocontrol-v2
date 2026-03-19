/**
 * Gamification: Einheiten-Zähler mit Verlauf (Sparkline + "vor X Monaten").
 * Zeigt totalUnits, propertyCount, optional Fortschritt zu Einheiten-Ziel und Verlinkung zum Ziel setzen.
 */
import { useEffect, useMemo } from "react";
import { Building2, TrendingUp, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "@/context/PropertyContext";
import { useStatsSnapshots } from "@/hooks/useStatsSnapshots";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/typedSupabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

function formatMonthsAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const months = Math.round((now.getTime() - d.getTime()) / (30 * 24 * 60 * 60 * 1000));
  if (months <= 0) return "Heute";
  if (months === 1) return "Vor 1 Monat";
  return `Vor ${months} Monaten`;
}

function unitsAcquiredLast12Months(properties: { units: number; purchaseDate: string }[]): number {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return properties
    .filter((p) => p.purchaseDate && p.purchaseDate >= cutoffStr)
    .reduce((sum, p) => sum + (p.units || 0), 0);
}

export function EinheitenZaehler() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { stats, properties } = useProperties();
  const { snapshots, recordSnapshot } = useStatsSnapshots();

  const { totalUnits, propertyCount } = stats;
  const unitsPerYearCurrent = useMemo(() => unitsAcquiredLast12Months(properties), [properties]);

  const { data: goals = [] } = useQuery({
    queryKey: ["portfolio_goals"],
    queryFn: async () => {
      const { data } = await fromTable("portfolio_goals").select("id, type, target, title").order("created_at");
      return (data || []) as { id: string; type: string; target: number; title: string }[];
    },
    enabled: !!user,
  });

  const unitsGoal = useMemo(
    () => goals.find((g) => g.type === "units" || g.type === "units_per_year"),
    [goals],
  );
  const unitsGoalProgress = useMemo(() => {
    if (!unitsGoal || unitsGoal.target <= 0) return null;
    const current = unitsGoal.type === "units_per_year" ? unitsPerYearCurrent : totalUnits;
    const pct = Math.min(100, (current / unitsGoal.target) * 100);
    const remaining = Math.max(0, unitsGoal.target - current);
    return { current, target: unitsGoal.target, pct, remaining, type: unitsGoal.type };
  }, [unitsGoal, totalUnits, unitsPerYearCurrent]);

  useEffect(() => {
    recordSnapshot({
      totalUnits: stats.totalUnits,
      propertyCount: stats.propertyCount,
      equity: stats.equity,
      totalCashflow: stats.totalCashflow,
      totalValue: stats.totalValue,
      totalRent: stats.totalRent,
    });
    // Nur bei Änderung der Stats auslösen; recordSnapshot ist stabil genug (upsert pro Tag idempotent).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.totalUnits, stats.propertyCount, stats.equity, stats.totalCashflow, stats.totalValue, stats.totalRent]);

  const historyForSparkline = useMemo(() => {
    const list = [...snapshots].sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );
    return list.slice(-30);
  }, [snapshots]);

  const previousSnapshot = useMemo(() => {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
    );
    const today = new Date().toISOString().slice(0, 10);
    return sorted.find((s) => s.snapshot_date !== today);
  }, [snapshots]);

  const growth30Days = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 31);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const old = snapshots
      .filter((s) => s.snapshot_date <= cutoffStr)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))[0];
    if (!old) return null;
    const diff = totalUnits - old.total_units;
    return { diff, from: old.snapshot_date };
  }, [snapshots, totalUnits]);

  const sparklinePoints = useMemo(() => {
    if (historyForSparkline.length < 2) return null;
    const values = historyForSparkline.map((s) => s.total_units);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 120;
    const h = 28;
    const step = w / (values.length - 1);
    return values
      .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
      .join(" ");
  }, [historyForSparkline]);

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 text-primary" />
        Meine Einheiten
      </h3>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl font-bold tabular-nums text-foreground">{totalUnits}</span>
        <span className="text-sm text-muted-foreground">
          Einheiten in {propertyCount} {propertyCount === 1 ? "Objekt" : "Objekten"}
        </span>
      </div>

      {unitsGoalProgress && unitsGoalProgress.remaining > 0 && (
        <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-2">
          <p className="text-xs font-medium text-foreground">
            Ziel: {unitsGoalProgress.target} Einh.{unitsGoalProgress.type === "units_per_year" ? "/Jahr" : ""}
            <span className="text-muted-foreground font-normal"> · Noch {Math.round(unitsGoalProgress.remaining)} bis zum Ziel</span>
          </p>
          <div className="mt-1.5 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${unitsGoalProgress.pct}%` }}
            />
          </div>
        </div>
      )}

      {unitsGoalProgress && unitsGoalProgress.remaining <= 0 && unitsGoalProgress.target > 0 && (
        <p className="text-xs text-profit font-medium mt-2">
          Ziel erreicht: {unitsGoalProgress.target} Einheiten{unitsGoalProgress.type === "units_per_year" ? "/Jahr" : ""}
        </p>
      )}

      <button
        type="button"
        onClick={() => navigate(".", { state: { openGoalDialog: true, goalPresetType: "units" } })}
        className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
      >
        <Target className="h-3 w-3" />
        Einheiten-Ziel setzen
      </button>
      <button
        type="button"
        onClick={() => navigate("/erfolge#badges")}
        className="mt-1 text-xs text-primary/90 hover:underline flex items-center gap-1"
      >
        <Target className="h-3 w-3" />
        Zu Badges & Erfolgen
      </button>

      {growth30Days && growth30Days.diff !== 0 && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span className={cn(growth30Days.diff > 0 ? "text-profit" : "text-loss")}>
            {growth30Days.diff > 0 ? "+" : ""}{growth30Days.diff} Einheiten in 30 Tagen
          </span>
        </p>
      )}

      {previousSnapshot && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {formatMonthsAgo(previousSnapshot.snapshot_date)}: {previousSnapshot.total_units} Einheiten
          {previousSnapshot.total_units !== totalUnits && (
            <span className={cn(totalUnits > previousSnapshot.total_units ? "text-profit" : "text-loss")}>
              {" "}
              → heute {totalUnits}
            </span>
          )}
        </p>
      )}

      {sparklinePoints && historyForSparkline.length >= 2 ? (
        <div className="mt-3 flex items-center gap-2">
          <svg
            viewBox="0 0 120 28"
            className="w-[120px] h-7 text-primary"
            aria-hidden
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklinePoints}
            />
          </svg>
          <span className="text-[10px] text-muted-foreground">
            Verlauf (letzte {historyForSparkline.length} Einträge)
          </span>
        </div>
      ) : (
        snapshots.length === 0 && (
          <p className="text-[10px] text-muted-foreground mt-3">
            Verlauf erscheint nach mehreren Tagen Nutzung.
          </p>
        )
      )}
    </div>
  );
}
