/**
 * Settings Page-Splitting — System Info section extracted from Settings.tsx
 */
import { useMemo } from "react";
import { Database } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SystemInfoSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
  totpEnabled: boolean;
}

export function SystemInfoSettings({ sectionRef, totpEnabled }: SystemInfoSettingsProps) {
  const { user } = useAuth();

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

  return (
    <div id="system-info" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-3 animate-fade-in [animation-delay:180ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" /> System-Info
      </h2>
      <div className="grid grid-cols-2 gap-2 text-xs" aria-label="Systeminformationen">
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
    </div>
  );
}
