/**
 * #18: Automatisches Daten-Backup als JSON — Wöchentliches Backup aller Daten als Download
 */
import { useState, useCallback } from "react";
import { Download, Database, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { downloadBlob } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TABLES = [
  "properties",
  "tenants",
  "loans",
  "contacts",
  "todos",
  "tickets",
  "property_documents",
  "property_notes",
  "rent_payments",
  "invoices",
  "contracts",
  "service_contracts",
  "utility_billings",
  "utility_billing_items",
  "maintenance_items",
  "property_insurances",
  "owner_meetings",
  "deals",
  "crm_leads",
  "messages",
] as const;

const BACKUP_TIMESTAMP_KEY = "immo-last-backup";

export function DataBackup() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastBackup = localStorage.getItem(BACKUP_TIMESTAMP_KEY);

  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const exportAll = useCallback(async () => {
    if (!user) return;
    setIsExporting(true);
    setProgress(0);

    try {
      const backup: Record<string, unknown[]> = {};
      let completed = 0;

      for (const table of TABLES) {
        try {
          const { data } = await supabase.from(table as never).select("*");
          backup[table] = (data || []) as unknown[];
        } catch {
          backup[table] = [];
        }
        completed++;
        setProgress(Math.round((completed / TABLES.length) * 100));
      }

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId: user.id,
        tables: backup,
        metadata: {
          tableCount: TABLES.length,
          totalRecords: Object.values(backup).reduce((s, arr) => s + arr.length, 0),
        },
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const date = new Date().toISOString().split("T")[0];
      downloadBlob(blob, `ImmoControl_Backup_${date}.json`);

      localStorage.setItem(BACKUP_TIMESTAMP_KEY, new Date().toISOString());
      toast.success(`Backup erstellt: ${exportData.metadata.totalRecords} Datensätze aus ${TABLES.length} Tabellen`);
    } catch {
      toast.error("Fehler beim Erstellen des Backups");
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  }, [user]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          Daten-Backup
        </h3>
        {daysSinceBackup !== null && daysSinceBackup <= 7 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-profit/10 text-profit flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Aktuell
          </span>
        )}
      </div>

      {/* Last backup info */}
      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Letztes Backup
          </span>
          <span className="text-xs font-medium">
            {lastBackup
              ? new Date(lastBackup).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
              : "Noch keins"}
          </span>
        </div>
        {daysSinceBackup !== null && daysSinceBackup > 7 && (
          <p className="text-[10px] text-gold mt-1">
            {daysSinceBackup} Tage seit letztem Backup — Empfehlung: wöchentlich
          </p>
        )}
        {daysSinceBackup === null && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Empfehlung: Wöchentliches Backup Ihrer Daten
          </p>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mb-3">
        Exportiert alle {TABLES.length} Tabellen als JSON-Datei inkl. Immobilien, Mieter, Kredite, Kontakte, Aufgaben, Dokumente und mehr.
      </p>

      {/* Progress bar */}
      {isExporting && (
        <div className="mb-3">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">{progress}% — Exportiere Daten...</p>
        </div>
      )}

      <Button
        size="sm"
        className="w-full text-xs"
        onClick={exportAll}
        disabled={isExporting}
      >
        {isExporting ? (
          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Exportiere...</>
        ) : (
          <><Download className="h-3.5 w-3.5 mr-1.5" />Vollständiges Backup herunterladen</>
        )}
      </Button>
    </div>
  );
}

export default DataBackup;
