/**
 * Settings Page-Splitting — System Info section extracted from Settings.tsx
 */
import { useMemo, useState } from "react";
import { Database, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { clearAllAppCaches } from "@/lib/serviceWorkerRegistration";

interface SystemInfoSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
  totpEnabled: boolean;
}

/** Angezeigte Version/Build (Build-Zeitstempel oder "Entwicklung") */
function getBuildLabel(): string {
  if (import.meta.env.DEV) return "Entwicklung";
  if (typeof __APP_BUILD_TIME__ !== "undefined" && __APP_BUILD_TIME__) return __APP_BUILD_TIME__;
  return "–";
}

export function SystemInfoSettings({ sectionRef, totpEnabled }: SystemInfoSettingsProps) {
  const { user } = useAuth();
  const [clearing, setClearing] = useState(false);

  const dataUsageEstimate = useMemo(() => {
    let totalSize = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const item = localStorage.getItem(key);
          if (item) totalSize += (key.length + item.length) * 2;
        }
      }
    } catch { /* localStorage may be unavailable */ }
    return totalSize;
  }, []);

  const sessionInfo = useMemo(() => ({
    lastLogin: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "\u2013",
    provider: user?.app_metadata?.provider || "email",
  }), [user]);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const result = await clearAllAppCaches();
      const parts: string[] = [];
      if (result.caches > 0) parts.push(`${result.caches} Cache(s)`);
      if (result.indexedDB) parts.push("Offline-Daten");
      if (result.session) parts.push("Sitzungscache");
      const msg = parts.length > 0
        ? `${parts.join(", ")} geleert. Seite wird neu geladen.`
        : "Cache geleert. Seite wird neu geladen.";
      toast.success(msg);
      window.setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error("Cache konnte nicht geleert werden.");
      setClearing(false);
    }
  };

  return (
    <div id="system-info" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-3 animate-fade-in [animation-delay:180ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" /> System-Info
      </h2>
      <div className="grid grid-cols-2 gap-2 text-xs" aria-label="Systeminformationen">
        <div className="p-2 rounded-lg bg-secondary/30 col-span-2">
          <span className="text-muted-foreground">Version / Build</span>
          <p className="font-medium font-mono text-[11px] break-all">{getBuildLabel()}</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">Lokaler Speicher</span>
          <p className="font-medium">{(dataUsageEstimate / 1024).toFixed(1)} KB</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">Letzter Login</span>
          <p className="font-medium">{sessionInfo.lastLogin}</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">Auth-Methode</span>
          <p className="font-medium capitalize">{sessionInfo.provider}</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">2FA</span>
          <p className="font-medium">{totpEnabled ? "Aktiv" : "Nicht aktiv"}</p>
        </div>
      </div>
      <div className="pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2 touch-target"
          onClick={handleClearCache}
          disabled={clearing}
        >
          {clearing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {clearing ? "Leere …" : "Cache leeren"}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1.5">Löscht alle App-Caches (Service Worker, Offline-Daten, Sitzung). Anmeldung bleibt erhalten. Seite wird danach neu geladen.</p>
      </div>
    </div>
  );
}
