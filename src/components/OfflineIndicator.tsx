/**
 * UX-7: Offline Indicator Banner
 * Visible persistent banner when no internet connection.
 */
import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    let onlineTimer: ReturnType<typeof setTimeout> | null = null;
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(prev => {
        if (prev) {
          onlineTimer = setTimeout(() => setWasOffline(false), 3000);
        }
        return prev;
      });
    };
    const handleOffline = () => {
      if (onlineTimer) { clearTimeout(onlineTimer); onlineTimer = null; }
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      if (onlineTimer) clearTimeout(onlineTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /* Nur "wieder online"-Hinweis; Offline-Hinweis kommt einmal vom AppLayout-Banner oben. */
  if (isOnline && !wasOffline) return null;
  if (!isOnline) return null;

  if (isOnline && wasOffline) {
    return (
      <div className="fixed top-14 left-0 right-0 z-[250] bg-profit/15 border-b border-profit/20 px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2 animate-fade-in" role="status">
        <Wifi className="h-3.5 w-3.5 text-profit" />
        <span className="text-profit">Wieder online — Daten werden synchronisiert</span>
      </div>
    );
  }

  return null;
}
