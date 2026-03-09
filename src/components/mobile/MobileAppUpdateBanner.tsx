/**
 * MOB5-20: Mobile App Update Banner
 * Live-Erkennung neuer Version (Railway/GitHub): version.json-Polling + Check bei Tab-Fokus/Reconnect.
 * Zeigt "Jetzt aktualisieren" / "Später" mit Ausblenden für 1 h.
 * Beim Aktualisieren: SW-Caches leeren + Reload, damit nach Redeploy wirklich die neue Version geladen wird.
 */
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { RefreshCw, X, ArrowUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearServiceWorkerCaches, unregisterServiceWorker } from "@/lib/serviceWorkerRegistration";

interface MobileAppUpdateBannerProps {
  /** Check interval in ms (default: 2 min); zusätzlich sofort bei Tab sichtbar / Reconnect */
  checkInterval?: number;
  /** Position */
  position?: "top" | "bottom";
  /** Custom update handler (overrides default reload) */
  onUpdate?: () => void;
  /** Auto-reload after N ms when update detected (default: 5000); 0 = nur Banner, kein Auto-Reload */
  autoReloadAfterMs?: number;
  /** Additional class */
  className?: string;
}

/** Live-Erkennung: Pollt /version.json (Railway/GitHub) + sofortiger Check bei Tab-Wechsel/Reconnect. */
function useAppVersionCheck(checkInterval: number) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const clientVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null;
  const checkRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!clientVersion || checkInterval <= 0) return;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) return;
        const data = (await res.json()) as { version?: string };
        if (typeof data?.version === "string" && data.version !== clientVersion) setUpdateAvailable(true);
      } catch {
        /* ignore */
      }
    };

    checkRef.current = check;
    check();

    const interval = setInterval(check, checkInterval);

    const onVisible = () => {
      if (document.visibilityState === "visible") checkRef.current?.();
    };
    const onOnline = () => { checkRef.current?.(); };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      checkRef.current = null;
    };
  }, [clientVersion, checkInterval]);

  return updateAvailable;
}

/**
 * Hook to detect Service Worker updates (new SW waiting after deploy).
 */
function useServiceWorkerUpdate(checkInterval: number) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const listenerAttachedRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let currentReg: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      if (!currentReg) return;
      const newWorker = currentReg.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      }
    };

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          currentReg = reg;
          setRegistration(reg);

          if (reg.waiting) setUpdateAvailable(true);

          if (!listenerAttachedRef.current) {
            reg.addEventListener("updatefound", onUpdateFound);
            listenerAttachedRef.current = true;
          }

          await reg.update();
        }
      } catch {
        /* Service worker not available */
      }
    };

    checkForUpdates();
    if (checkInterval > 0) interval = setInterval(checkForUpdates, checkInterval);

    const onVisible = () => { if (document.visibilityState === "visible") checkForUpdates(); };
    const onOnline = () => { checkForUpdates(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (currentReg && listenerAttachedRef.current) {
        currentReg.removeEventListener("updatefound", onUpdateFound);
        listenerAttachedRef.current = false;
      }
    };
  }, [checkInterval]);

  const applyUpdate = useCallback(async () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    try {
      await clearServiceWorkerCaches();
      await unregisterServiceWorker();
    } catch {
      /* ignore */
    }
    setTimeout(() => window.location.reload(), 300);
  }, [registration]);

  return { updateAvailable, applyUpdate };
}

export const MobileAppUpdateBanner = memo(function MobileAppUpdateBanner({
  checkInterval = 2 * 60 * 1000,
  position = "bottom",
  onUpdate,
  autoReloadAfterMs = 5000,
  className,
}: MobileAppUpdateBannerProps) {
  const isMobile = useIsMobile();
  const versionUpdateAvailable = useAppVersionCheck(checkInterval);
  const { updateAvailable: swUpdateAvailable, applyUpdate } = useServiceWorkerUpdate(checkInterval);
  const updateAvailable = versionUpdateAvailable || swUpdateAvailable;
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-reload nach Redeploy: Countdown starten wenn Update erkannt, dann Reload (Handy + Browser)
  useEffect(() => {
    if (!updateAvailable || isDismissed || isUpdating || autoReloadAfterMs <= 0) {
      if (autoReloadTimerRef.current) {
        clearTimeout(autoReloadTimerRef.current);
        autoReloadTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(null);
      return;
    }
    setCountdown(Math.ceil(autoReloadAfterMs / 1000));
    const countdownStep = 1000;
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((c) => (c != null && c > 1 ? c - 1 : null));
    }, countdownStep);
    autoReloadTimerRef.current = setTimeout(() => {
      autoReloadTimerRef.current = null;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (document.visibilityState === "visible" && !onUpdate) {
        applyUpdate();
      } else {
        setCountdown(null);
      }
    }, autoReloadAfterMs);
    return () => {
      if (autoReloadTimerRef.current) clearTimeout(autoReloadTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [updateAvailable, isDismissed, isUpdating, autoReloadAfterMs, onUpdate, applyUpdate]);

  // Clean up dismiss + auto-reload timers on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (autoReloadTimerRef.current) clearTimeout(autoReloadTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    if (onUpdate) {
      onUpdate();
    } else {
      await applyUpdate();
    }
  }, [onUpdate, applyUpdate]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    // Clear any existing timer before setting a new one
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    // Re-show after 1 hour if still not updated
    dismissTimerRef.current = setTimeout(() => setIsDismissed(false), 60 * 60 * 1000);
  }, []);

  if (!updateAvailable || isDismissed) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 px-3",
        position === "top" ? "top-0 pt-safe" : "bottom-0 pb-safe",
        isMobile && position === "bottom" && "bottom-16",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className={cn(
        "mx-auto max-w-lg rounded-xl border bg-background shadow-2xl overflow-hidden",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
        position === "top" && "animate-in slide-in-from-top-4"
      )}>
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                Neue Version verfügbar
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {countdown != null && countdown > 0
                  ? `Neue Version wird in ${countdown} Sek. geladen …`
                  : "Aktualisiere die App für die neuesten Verbesserungen und Fehlerbehebungen."}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50",
                    isMobile && "min-h-[36px]"
                  )}
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Wird aktualisiert...
                    </>
                  ) : (
                    <>
                      <ArrowUp className="w-3 h-3" />
                      Jetzt aktualisieren
                    </>
                  )}
                </button>

                <button
                  onClick={handleDismiss}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs text-muted-foreground",
                    "hover:bg-muted transition-colors",
                    isMobile && "min-h-[36px]"
                  )}
                >
                  Später
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors -mt-1 -mr-1"
              aria-label="Schließen"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
