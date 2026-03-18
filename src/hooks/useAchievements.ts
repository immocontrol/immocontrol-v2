/**
 * Gamification: Achievement context, reached list, sync to DB, one-time toast on unlock.
 */
import { useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  ACHIEVEMENTS,
  computeReachedAchievements,
  computePoints,
  getLevelForPoints,
  getProgressToNextLevel,
  type AchievementContext,
  type AchievementDef,
} from "@/lib/achievements";

interface Goal {
  type: string;
  target: number;
  current_value?: number;
}

function getCurrentForGoal(goal: Goal, stats: { totalValue: number; totalCashflow: number; totalUnits: number; equity: number }, unitsPerYear: number): number {
  switch (goal.type) {
    case "value": return stats.totalValue;
    case "cashflow": return stats.totalCashflow;
    case "units": return stats.totalUnits;
    case "units_per_year": return unitsPerYear;
    case "equity": return stats.equity;
    default: return 0;
  }
}

export function useAchievements(opts: {
  goals?: Goal[];
  unitsPerYear?: number;
  tenantsCount?: number;
  viewingsCount?: number;
  documentsCount?: number;
  dealsCount?: number;
  dealsAbgeschlossenCount?: number;
  showToastOnUnlock?: boolean;
}) {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const qc = useQueryClient();
  const showToast = opts.showToastOnUnlock ?? true;
  const toastedRef = useRef<Set<string>>(new Set());

  const goalsReachedCount = useMemo(() => {
    if (!opts.goals?.length || opts.unitsPerYear === undefined) return 0;
    return opts.goals.filter((g) => {
      const current = getCurrentForGoal(g, stats, opts.unitsPerYear ?? 0);
      return g.target > 0 && current >= g.target;
    }).length;
  }, [opts.goals, opts.unitsPerYear, stats]);

  const context: AchievementContext = useMemo(
    () => ({
      stats: {
        totalUnits: stats.totalUnits,
        propertyCount: stats.propertyCount,
        equity: stats.equity,
        totalCashflow: stats.totalCashflow,
        avgRendite: stats.avgRendite ?? 0,
      },
      properties: properties.map((p) => ({ type: p.type, units: p.units })),
      tenantsCount: opts.tenantsCount ?? 0,
      viewingsCount: opts.viewingsCount ?? 0,
      documentsCount: opts.documentsCount ?? 0,
      dealsCount: opts.dealsCount ?? 0,
      dealsAbgeschlossenCount: opts.dealsAbgeschlossenCount ?? 0,
      goalsReachedCount,
    }),
    [
      stats,
      properties,
      opts.tenantsCount,
      opts.viewingsCount,
      opts.documentsCount,
      opts.dealsCount,
      opts.dealsAbgeschlossenCount,
      goalsReachedCount,
    ]
  );

  const reached = useMemo(() => computeReachedAchievements(context), [context]);
  const points = useMemo(
    () =>
      computePoints({
        totalUnits: stats.totalUnits,
        propertyCount: stats.propertyCount,
        goalsReachedCount,
        achievementsReachedCount: reached.length,
      }),
    [stats.totalUnits, stats.propertyCount, goalsReachedCount, reached.length]
  );
  const level = useMemo(() => getLevelForPoints(points), [points]);
  const progressToNext = useMemo(() => getProgressToNextLevel(points), [points]);

  const { data: unlockedIds = [] } = useQuery({
    queryKey: queryKeys.userAchievements.all(user?.id ?? ""),
    queryFn: async () => {
      const { data } = await supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.achievement_id);
    },
    enabled: !!user,
  });

  const insertAchievement = useMutation({
    mutationFn: async (achievementId: string) => {
      const { error } = await supabase.from("user_achievements").insert({
        user_id: user!.id,
        achievement_id: achievementId,
      });
      if (error?.code === "23505") return; // unique violation – already unlocked
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.userAchievements.all(user?.id ?? "") });
    },
  });

  useEffect(() => {
    if (!user || !showToast) return;
    const newlyReached = reached.filter((a) => !unlockedIds.includes(a.id));
    for (const a of newlyReached) {
      if (toastedRef.current.has(a.id)) continue;
      toastedRef.current.add(a.id);
      insertAchievement.mutate(a.id);
      toast.success(`Achievement freigeschaltet: ${a.title}`, {
        description: a.description,
        duration: 5000,
      });
    }
  }, [user, showToast, reached, unlockedIds, insertAchievement]);

  return {
    context,
    reached,
    all: ACHIEVEMENTS,
    points,
    level,
    progressToNext,
    unlockedIds,
  };
}
