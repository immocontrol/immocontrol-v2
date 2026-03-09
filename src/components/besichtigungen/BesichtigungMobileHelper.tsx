/**
 * Mobile-Erfassung für Besichtigungen — Offline-Hinweis,
 * Checkliste-Tipp, Sprachnotiz-Platzhalter.
 */
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { WifiOff, ListTodo, Mic } from "lucide-react";

export function BesichtigungMobileHelper() {
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <div className="space-y-2">
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2 text-xs">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Offline: Daten werden beim nächsten Sync übertragen. Erfassung weiterhin möglich.</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ListTodo className="h-3 w-3 shrink-0" />
          Checkliste beim Erfassen nutzen — Heizung, Fenster, Elektrik …
        </span>
        <span className="flex items-center gap-1 text-muted-foreground/70">
          <Mic className="h-3 w-3 shrink-0" />
          Sprachnotiz (optional) — später verfügbar
        </span>
      </div>
    </div>
  );
}
