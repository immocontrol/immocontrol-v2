/**
 * Settings Page-Splitting — Backup & Export section extracted from Settings.tsx
 */
import { useState, useMemo } from "react";
import { Database, AlertTriangle } from "lucide-react";
import { DataExportBackup } from "@/components/DataExportBackup";

interface BackupSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function BackupSettings({ sectionRef }: BackupSettingsProps) {
  const [lastExportDate] = useState<string | null>(() => {
    try { return localStorage.getItem("immocontrol_last_export_date"); } catch { return null; }
  });

  const daysSinceLastExport = useMemo(() => {
    if (!lastExportDate) return null;
    const last = new Date(lastExportDate);
    const now = new Date();
    return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }, [lastExportDate]);

  return (
    <div id="backup" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:120ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" /> Daten-Backup & Export
      </h2>
      <p className="text-xs text-muted-foreground">
        Exportiere alle deine Daten als JSON-Backup oder CSV-Dateien für Excel.
      </p>
      {lastExportDate ? (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
          daysSinceLastExport !== null && daysSinceLastExport > 90
            ? "border-destructive/30 bg-destructive/5"
            : "border-profit/30 bg-profit/5"
        }`}>
          <Database className={`h-3.5 w-3.5 shrink-0 ${
            daysSinceLastExport !== null && daysSinceLastExport > 90 ? "text-destructive" : "text-profit"
          }`} />
          <div className="text-xs">
            <span className="font-medium">Letzter Export:</span>{" "}
            {new Date(lastExportDate).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
            {daysSinceLastExport !== null && daysSinceLastExport > 90 && (
              <span className="text-destructive font-medium ml-1">
                — ⚠ {daysSinceLastExport} Tage her! Bitte erstelle ein neues Backup.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gold/30 bg-gold/5">
          <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0" />
          <span className="text-xs text-gold font-medium">Noch kein Export durchgeführt — erstelle jetzt ein Backup!</span>
        </div>
      )}
      <DataExportBackup />
    </div>
  );
}
