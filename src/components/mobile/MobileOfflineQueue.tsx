/**
 * MOB-11: Offline-Indikator & Queue Enhancement
 * Enhanced offline banner with action queue. Inputs are queued offline
 * and auto-synced on reconnect. Shows "3 Änderungen synchronisiert" toast.
 */
import { memo, useState, useEffect, useCallback, useRef } from "react";
import { WifiOff, Wifi, CloudUpload, Check, AlertCircle } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { cn } from "@/lib/utils";

const QUEUE_KEY = "immo-offline-queue";

export interface OfflineAction {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/** Load queued actions from localStorage */
function loadQueue(): OfflineAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

/** Save queue to localStorage */
function saveQueue(queue: OfflineAction[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* silently fail */ }
}

/** Hook to manage offline action queue */
export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineAction[]>(loadQueue);
  const [syncing, setSyncing] = useState(false);

  const enqueue = useCallback((action: Omit<OfflineAction, "id" | "timestamp">) => {
    const newAction: OfflineAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    setQueue(prev => {
      const next = [...prev, newAction];
      saveQueue(next);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    saveQueue([]);
  }, []);

  return { queue, enqueue, clearQueue, syncing, setSyncing };
}

interface MobileOfflineQueueProps {
  /** Callback to process queued actions on reconnect */
  onSync?: (actions: OfflineAction[]) => Promise<void>;
}

export const MobileOfflineQueue = memo(function MobileOfflineQueue({ onSync }: MobileOfflineQueueProps) {
  const haptic = useHaptic();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Auto-sync queued actions
      const queue = loadQueue();
      if (queue.length > 0 && onSync) {
        setSyncing(true);
        onSync(queue)
          .then(() => {
            haptic.success();
            setSyncedCount(queue.length);
            saveQueue([]);
            setQueueCount(0);
            toast.success(`${queue.length} ${queue.length === 1 ? "Änderung" : "Änderungen"} synchronisiert`);
          })
          .catch((err) => {
            haptic.error();
            handleError(err, { context: "network", showToast: false });
            const retrySync = () => {
              const q = loadQueue();
              if (q.length === 0 || !onSync) return;
              setSyncing(true);
              onSync(q)
                .then(() => {
                  haptic.success();
                  setSyncedCount(q.length);
                  saveQueue([]);
                  setQueueCount(0);
                  toast.success(`${q.length} ${q.length === 1 ? "Änderung" : "Änderungen"} synchronisiert`);
                })
                .catch((e: unknown) => {
                  haptic.error();
                  handleError(e, { context: "network", showToast: false });
                  toast.error("Synchronisierung fehlgeschlagen — wird erneut versucht");
                })
                .finally(() => setSyncing(false));
            };
            toastErrorWithRetry("Synchronisierung fehlgeschlagen — bitte erneut versuchen", retrySync);
          })
          .finally(() => {
            setSyncing(false);
          });
      }
      timerRef.current = setTimeout(() => {
        setWasOffline(false);
        setSyncedCount(0);
      }, 4000);
    };

    const handleOffline = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsOnline(false);
      setWasOffline(false);
      haptic.error();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodically check queue count
    const interval = setInterval(() => {
      setQueueCount(loadQueue().length);
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [haptic, onSync]);

  // Online with successful sync
  if (isOnline && wasOffline && syncedCount > 0) {
    return (
      <div className="fixed top-14 left-0 right-0 z-[250] bg-profit/15 border-b border-profit/20 px-4 py-2 text-center animate-fade-in" role="status">
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-profit">
          <Check className="h-3.5 w-3.5" />
          <span>Wieder online — {syncedCount} {syncedCount === 1 ? "Änderung" : "Änderungen"} synchronisiert</span>
        </div>
      </div>
    );
  }

  // Online with syncing in progress
  if (isOnline && syncing) {
    return (
      <div className="fixed top-14 left-0 right-0 z-[250] bg-primary/10 border-b border-primary/20 px-4 py-2 text-center animate-fade-in" role="status">
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-primary">
          <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
          <span>Änderungen werden synchronisiert...</span>
        </div>
      </div>
    );
  }

  // Offline
  if (!isOnline) {
    return (
      <div className="fixed top-14 left-0 right-0 z-[250] bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 animate-fade-in" role="alert" aria-live="assertive">
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-destructive">
          <WifiOff className="h-3.5 w-3.5 animate-pulse" />
          <span>Keine Internetverbindung</span>
          {queueCount > 0 && (
            <span className="bg-destructive/20 px-1.5 py-0.5 rounded text-[10px]">
              {queueCount} {queueCount === 1 ? "Änderung" : "Änderungen"} in Warteschlange
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
});
