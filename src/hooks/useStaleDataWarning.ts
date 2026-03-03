/**
 * #20: Automatic Stale-Data Warning
 * Shows a toast when the tab regains focus after being hidden for a while,
 * and triggers a refetch of all active queries.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function useStaleDataWarning() {
  const qc = useQueryClient();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current) {
        const elapsed = Date.now() - hiddenAt.current;
        hiddenAt.current = null;

        if (elapsed >= STALE_THRESHOLD_MS) {
          // Invalidate all queries to trigger refetches
          qc.invalidateQueries();
          toast.info("Daten wurden aktualisiert", {
            description: `Tab war ${Math.round(elapsed / 60_000)} Min. inaktiv`,
            duration: 3000,
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [qc]);
}
