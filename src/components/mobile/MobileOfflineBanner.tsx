/**
 * MOB3-20: Mobile Offline Status Banner
 * Persistent but non-intrusive banner at top when offline.
 * Shows queue counter and manual sync button.
 * Safari-safe: uses navigator.onLine with event listeners.
 */
import { memo, useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw, CloudOff, Check } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { useTimeoutFn } from "@/hooks/useTimeout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MobileOfflineBannerProps {
  /** Number of queued offline operations */
  queueCount?: number;
  /** Callback to manually trigger sync */
  onSync?: () => Promise<void>;
  className?: string;
}

export const MobileOfflineBanner = memo(function MobileOfflineBanner({
  queueCount = 0, onSync, className,
}: MobileOfflineBannerProps) {
  const haptic = useHaptic();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  /* FIX-18: Use useTimeoutFn for auto-cleanup on unmount */
  const syncResetTimer = useTimeoutFn();

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0 && onSync) {
      handleSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleSync = useCallback(async () => {
    if (!onSync || syncing) return;
    haptic.tap();
    setSyncing(true);
    try {
      await onSync();
      haptic.success();
      setJustSynced(true);
      toast.success("Offline-Daten synchronisiert");
      /* FIX-18: Timer auto-clears on unmount via useTimeoutFn */
      syncResetTimer.set(() => setJustSynced(false), 3000);
    } catch {
      haptic.error();
      toast.error("Synchronisierung fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  }, [onSync, syncing, haptic]);

  // Don't show if online and no queue
  if (isOnline && queueCount === 0 && !justSynced) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-[150] transition-all duration-300",
        !isOnline ? "bg-amber-500/15 border-b border-amber-500/30" : "",
        isOnline && queueCount > 0 ? "bg-blue-500/10 border-b border-blue-500/20" : "",
        justSynced ? "bg-emerald-500/10 border-b border-emerald-500/20" : "",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {!isOnline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-medium text-amber-700 truncate">
                Offline — Änderungen werden gespeichert
              </span>
            </>
          ) : justSynced ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-medium text-emerald-700 truncate">
                Alle Daten synchronisiert
              </span>
            </>
          ) : queueCount > 0 ? (
            <>
              <CloudOff className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-medium text-blue-700 truncate">
                {queueCount} {queueCount === 1 ? "Änderung" : "Änderungen"} ausstehend
              </span>
            </>
          ) : null}
        </div>

        {/* Sync button / queue counter */}
        <div className="flex items-center gap-2 shrink-0">
          {queueCount > 0 && !justSynced && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold min-w-[20px] text-center">
              {queueCount}
            </span>
          )}
          {isOnline && queueCount > 0 && onSync && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all active:scale-95",
                "bg-primary/10 text-primary hover:bg-primary/20",
                syncing && "opacity-60",
              )}
              aria-label="Jetzt synchronisieren"
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              {syncing ? "Sync..." : "Sync"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
