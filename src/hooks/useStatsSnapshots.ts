/**
 * Gamification: Tägliche Portfolio-Snapshots für Einheiten-Verlauf (Sparkline, "vor X Monaten").
 * Höchstens ein Snapshot pro Tag pro User; beim Aufruf von recordSnapshot wird der heutige Tag upserted.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryKeys";
import { fromTable } from "@/lib/typedSupabase";

export interface StatsSnapshotRow {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_units: number;
  property_count: number;
  equity: number;
  total_cashflow: number;
  total_value: number;
  total_rent: number;
  created_at: string;
}

export interface PortfolioStatsForSnapshot {
  totalUnits: number;
  propertyCount: number;
  equity: number;
  totalCashflow: number;
  totalValue: number;
  totalRent: number;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useStatsSnapshots() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: snapshots = [] } = useQuery({
    queryKey: queryKeys.statsSnapshots.all(user?.id ?? ""),
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await fromTable("user_stats_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("snapshot_date", { ascending: false })
        .limit(365);
      if (error) throw error;
      return (data ?? []) as StatsSnapshotRow[];
    },
    enabled: !!user?.id,
  });

  const upsertMutation = useMutation({
    mutationFn: async (stats: PortfolioStatsForSnapshot) => {
      if (!user?.id) throw new Error("Nicht angemeldet");
      const snapshot_date = todayDateString();
      const row = {
        user_id: user.id,
        snapshot_date,
        total_units: stats.totalUnits,
        property_count: stats.propertyCount,
        equity: stats.equity,
        total_cashflow: stats.totalCashflow,
        total_value: stats.totalValue,
        total_rent: stats.totalRent,
      };
      const { error } = await fromTable("user_stats_snapshots").upsert(row, {
        onConflict: "user_id,snapshot_date",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.statsSnapshots.all(user?.id ?? "") });
    },
  });

  const recordSnapshot = (stats: PortfolioStatsForSnapshot) => {
    if (!user?.id) return;
    upsertMutation.mutate(stats);
  };

  const sortedByDate = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  return {
    snapshots: sortedByDate,
    recordSnapshot,
    isRecording: upsertMutation.isPending,
  };
}
