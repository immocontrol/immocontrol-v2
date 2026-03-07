/**
 * Settings Page-Splitting — Backup & Export section extracted from Settings.tsx
 * Includes Cloud-Backup: upload JSON backup to Supabase Storage (bucket "backups").
 */
import { useState, useMemo, useCallback } from "react";
import { Database, AlertTriangle, Cloud, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { Button } from "@/components/ui/button";
import { DataExportBackup } from "@/components/DataExportBackup";

const BACKUP_TABLES = [
  "properties", "tenants", "loans", "contacts", "todos", "tickets",
  "property_notes", "rent_payments", "invoices", "contracts", "service_contracts",
  "utility_billings", "utility_billing_items", "maintenance_items",
  "property_insurances", "owner_meetings", "deals", "crm_leads", "messages",
] as const;

interface BackupSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function BackupSettings({ sectionRef }: BackupSettingsProps) {
  const { user } = useAuth();
  const [lastExportDate] = useState<string | null>(() => {
    try { return localStorage.getItem("immocontrol_last_export_date"); } catch { return null; }
  });

  const daysSinceLastExport = useMemo(() => {
    if (!lastExportDate) return null;
    const last = new Date(lastExportDate);
    const now = new Date();
    return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }, [lastExportDate]);

  const [cloudUploading, setCloudUploading] = useState(false);
  const uploadToCloud = useCallback(async () => {
    if (!user) return;
    setCloudUploading(true);
    try {
      const backup: Record<string, unknown[]> = {};
      for (const table of BACKUP_TABLES) {
        try {
          const { data } = await supabase.from(table as never).select("*");
          backup[table] = (data || []) as unknown[];
        } catch { backup[table] = []; }
      }
      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId: user.id,
        tables: backup,
        metadata: { tableCount: BACKUP_TABLES.length, totalRecords: Object.values(backup).reduce((s, arr) => s + arr.length, 0) },
      };
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const path = `${user.id}/ImmoControl_Backup_${ts}.json`;
      const { error } = await supabase.storage.from("backups").upload(path, blob, { contentType: "application/json", upsert: true });
      if (error) throw error;
      localStorage.setItem("immocontrol_last_export_date", new Date().toISOString());
      toast.success("Backup in Cloud gespeichert");
    } catch (err: unknown) {
      handleError(err, { context: "cloud-backup", showToast: false });
      const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      toastErrorWithRetry(msg.includes("bucket") || msg.includes("Bucket") ? "Cloud-Backup-Bucket nicht eingerichtet. Siehe Supabase Storage." : msg, () => uploadToCloud());
    } finally {
      setCloudUploading(false);
    }
  }, [user]);

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
      <div className="rounded-lg border border-border/50 p-3 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Cloud className="h-3.5 w-3.5 text-muted-foreground" /> Cloud-Backup
        </p>
        <p className="text-[11px] text-muted-foreground">
          Speichert das vollständige JSON-Backup in Supabase Storage (Bucket <code className="text-[10px] bg-secondary px-0.5 rounded">backups</code>).
        </p>
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={uploadToCloud} disabled={cloudUploading}>
          {cloudUploading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Wird hochgeladen...</> : <><Cloud className="h-3.5 w-3.5 mr-1.5" />Backup in Cloud speichern</>}
        </Button>
      </div>
    </div>
  );
}
