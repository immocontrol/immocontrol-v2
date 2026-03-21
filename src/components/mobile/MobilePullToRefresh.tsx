/**
 * MOB-2: Enhanced Pull-to-Refresh with visual indicator
 * Ring progress → check when ready → spinner while invalidating queries.
 */
import { memo, useCallback } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useHaptic } from "@/hooks/useHaptic";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobilePullToRefreshProps {
  /** Additional query keys to invalidate on refresh */
  queryKeys?: string[][];
}

export const MobilePullToRefresh = memo(function MobilePullToRefresh({ queryKeys: extraKeys }: MobilePullToRefreshProps) {
  const qc = useQueryClient();
  const haptic = useHaptic();
  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    haptic.medium();
    try {
      if (extraKeys && extraKeys.length > 0) {
        await Promise.all(extraKeys.map(k => qc.invalidateQueries({ queryKey: k })));
      } else {
        await qc.invalidateQueries();
      }
      haptic.success();
      toast.success("Daten aktualisiert");
    } catch (err: unknown) {
      haptic.error();
      handleError(err, { context: "network", showToast: false });
      toastErrorWithRetry("Aktualisierung fehlgeschlagen", () => handleRefresh());
    }
  }, [qc, haptic, extraKeys]);

  const { indicatorRef, indicator } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isMobile,
  });

  return (
    <PullToRefreshIndicator
      rootRef={indicatorRef}
      opacity={indicator.opacity}
      translateY={indicator.translateY}
      progress={indicator.progress}
      ready={indicator.ready}
      refreshing={indicator.refreshing}
    />
  );
});
