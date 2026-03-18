/**
 * Gamification: Update last_active_date, log activity_date, compute login streak.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const TODAY = new Date().toISOString().slice(0, 10);

export function useUserActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("user_activity").upsert(
        { user_id: user!.id, last_active_date: TODAY, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      await supabase.from("user_activity_dates").upsert(
        { user_id: user!.id, activity_date: TODAY },
        { onConflict: "user_id,activity_date" }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.userActivity.byUser(user?.id ?? "") });
      qc.invalidateQueries({ queryKey: ["user_activity_dates", user?.id] });
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    upsertMutation.mutate();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only on user id

  const { data: activity } = useQuery({
    queryKey: queryKeys.userActivity.byUser(user?.id ?? ""),
    queryFn: async () => {
      const { data } = await supabase
        .from("user_activity")
        .select("last_active_date")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { last_active_date: string } | null;
    },
    enabled: !!user,
  });

  const { data: streak = 0 } = useQuery({
    queryKey: ["user_activity_dates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_activity_dates")
        .select("activity_date")
        .eq("user_id", user!.id)
        .order("activity_date", { ascending: false })
        .limit(100);
      const dates = (data ?? []).map((r) => (r as { activity_date: string }).activity_date);
      return computeStreakFromDates(dates);
    },
    enabled: !!user,
  });

  return { lastActiveDate: activity?.last_active_date ?? null, streak };
}

/** Consecutive days ending today (from sorted list of activity_date strings YYYY-MM-DD). */
export function computeStreakFromDates(sortedDatesDesc: string[]): number {
  const today = new Date().toISOString().slice(0, 10);
  const set = new Set(sortedDatesDesc);
  if (!set.has(today)) return 0;
  let count = 0;
  let d = new Date(today + "T12:00:00Z");
  const oneDay = 86400000;
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    count++;
    d = new Date(d.getTime() - oneDay);
  }
  return count;
}
