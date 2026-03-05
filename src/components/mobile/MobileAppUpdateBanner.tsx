/**
 * MOB5-20: Mobile App Update Banner
 * Shows update notification when a new app version is available via Service Worker.
 * Includes "Update now" button and dismissible banner with auto-recheck.
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { RefreshCw, X, ArrowUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileAppUpdateBannerProps {
  /** Check interval in milliseconds (default: 5 minutes) */
  checkInterval?: number;
  /** Position */
  position?: "top" | "bottom";
  /** Custom update handler (overrides default reload) */
  onUpdate?: () => void;
  /** Additional class */
  className?: string;
}

/**
 * Hook to detect Service Worker updates.
 */
function useServiceWorkerUpdate(checkInterval: number) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          setRegistration(reg);

          // Check for waiting worker
          if (reg.waiting) {
            setUpdateAvailable(true);
          }

          // Listen for new updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });

          // Trigger update check
          await reg.update();
        }
      } catch {
        // Service worker not available
      }
    };

    checkForUpdates();

    // Periodic check
    if (checkInterval > 0) {
      interval = setInterval(checkForUpdates, checkInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkInterval]);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    // Reload after short delay to allow SW to activate
    setTimeout(() => window.location.reload(), 500);
  }, [registration]);

  return { updateAvailable, applyUpdate };
}

export const MobileAppUpdateBanner = memo(function MobileAppUpdateBanner({
  checkInterval = 5 * 60 * 1000,
  position = "bottom",
  onUpdate,
  className,
}: MobileAppUpdateBannerProps) {
  const isMobile = useIsMobile();
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate(checkInterval);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    if (onUpdate) {
      onUpdate();
    } else {
      applyUpdate();
    }
  }, [onUpdate, applyUpdate]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    // Re-show after 1 hour if still not updated
    setTimeout(() => setIsDismissed(false), 60 * 60 * 1000);
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
                Aktualisiere die App für die neuesten Verbesserungen und Fehlerbehebungen.
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
