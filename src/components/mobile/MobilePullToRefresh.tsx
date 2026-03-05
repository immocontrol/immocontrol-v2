/**
 * MOB-2: Enhanced Pull-to-Refresh with visual indicator
 * Shows a spinner with progress feedback and haptic response on mobile.
 */
import { memo, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useHaptic } from "@/hooks/useHaptic";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MobilePullToRefreshProps {
  /** Additional query keys to invalidate on refresh */
  queryKeys?: string[][];
}

export const MobilePullToRefresh = memo(function MobilePullToRefresh({ queryKeys: extraKeys }: MobilePullToRefreshProps) {
  const qc = useQueryClient();
  const haptic = useHaptic();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic.medium();
    try {
      if (extraKeys && extraKeys.length > 0) {
        await Promise.all(extraKeys.map(k => qc.invalidateQueries({ queryKey: k })));
      } else {
        await qc.invalidateQueries();
      }
      haptic.success();
      toast.success("Daten aktualisiert");
    } catch {
      haptic.error();
      toast.error("Aktualisierung fehlgeschlagen");
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [qc, haptic, extraKeys]);

  const { indicatorRef } = usePullToRefresh({ onRefresh: handleRefresh });

  return (
    <div
      ref={indicatorRef}
      className={cn(
        "fixed top-0 left-1/2 z-[300] rounded-full w-10 h-10 flex items-center justify-center shadow-lg pointer-events-none transition-all duration-200",
        refreshing ? "bg-primary text-primary-foreground" : "bg-background border border-border text-foreground",
      )}
      style={{ opacity: 0, transform: "translateX(-50%) translateY(-40px)" }}
      aria-hidden
    >
      <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
    </div>
  );
});
