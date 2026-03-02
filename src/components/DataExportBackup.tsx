import { useState, useCallback } from "react";
import { Download, FileJson, FileSpreadsheet, Database, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";

/**
 * EXPORT-1: Data Export/Backup — JSON & Excel/CSV export for portfolio data
 *
 * Exports all user data from Supabase tables into downloadable files.
 * Supports JSON (full backup) and CSV (Excel-compatible) formats.
 */

interface ExportTable {
  name: string;
  label: string;
  columns: string[];
}

const EXPORT_TABLES: ExportTable[] = [
  {
    name: "properties",
    label: "Objekte",
    columns: ["name", "address", "location", "type", "units", "purchase_price", "purchase_date", "current_value", "monthly_rent", "monthly_expenses", "monthly_credit_rate", "monthly_cashflow", "remaining_debt", "interest_rate", "sqm", "year_built", "ownership"],
  },
  {
    name: "tenants",
    label: "Mieter",
    columns: ["first_name", "last_name", "email", "phone", "rent_amount", "deposit_amount", "move_in_date", "move_out_date", "is_active", "unit_number"],
  },
  {
    name: "loans",
    label: "Darlehen",
    columns: ["bank_name", "loan_amount", "remaining_balance", "interest_rate", "monthly_payment", "start_date", "end_date", "loan_type"],
  },
  {
    name: "deals",
    label: "Deals",
    columns: ["title", "address", "stage", "purchase_price", "expected_rent", "sqm", "units", "property_type", "source", "notes"],
  },
  {
    name: "contacts",
    label: "Kontakte",
    columns: ["name", "email", "phone", "company", "role", "category", "notes"],
  },
  {
    name: "todos",
    label: "Aufgaben",
    columns: ["title", "description", "priority", "status", "due_date", "completed_at"],
  },
  {
    name: "tickets",
    label: "Tickets",
    columns: ["title", "description", "status", "priority", "category", "created_at"],
  },
  {
    name: "rent_payments",
    label: "Mietzahlungen",
    columns: ["tenant_id", "amount", "due_date", "paid_date", "status", "payment_method"],
  },
];

/** EXPORT-2: Escape CSV value (handle commas, quotes, newlines) */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** EXPORT-3: Convert array of objects to CSV string with BOM for Excel */
function toCSV(data: Record<string, unknown>[], columns: string[]): string {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const header = columns.map(c => escapeCSV(c)).join(";");
  const rows = data.map(row =>
    columns.map(col => escapeCSV(row[col])).join(";")
  );
  return BOM + [header, ...rows].join("\n");
}

/** EXPORT-4: Trigger browser download of a file */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DataExportBackup = () => {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportedTables, setExportedTables] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  /** EXPORT-5: Fetch all data from a Supabase table */
  const fetchTableData = useCallback(async (tableName: string): Promise<Record<string, unknown>[]> => {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Record<string, unknown>[];
  }, []);

  /** EXPORT-6: Export all data as JSON backup */
  const exportJSON = useCallback(async () => {
    if (!user) return;
    setExporting(true);
    setExportedTables([]);

    try {
      const backup: Record<string, unknown> = {
        exportDate: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email,
        version: "1.0",
        tables: {},
      };

      for (const table of EXPORT_TABLES) {
        try {
          const data = await fetchTableData(table.name);
          (backup.tables as Record<string, unknown>)[table.name] = data;
          setExportedTables(prev => [...prev, table.name]);
        } catch {
          (backup.tables as Record<string, unknown>)[table.name] = [];
        }
      }

      const json = JSON.stringify(backup, null, 2);
      const date = new Date().toISOString().split("T")[0];
      downloadFile(json, `immocontrol-backup-${date}.json`, "application/json");
      toast.success("JSON-Backup heruntergeladen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  }, [user, fetchTableData]);

  /** EXPORT-7: Export all data as CSV files (one per table, zipped conceptually) */
  const exportCSV = useCallback(async () => {
    if (!user) return;
    setExporting(true);
    setExportedTables([]);

    try {
      for (const table of EXPORT_TABLES) {
        try {
          const data = await fetchTableData(table.name);
          if (data.length === 0) {
            setExportedTables(prev => [...prev, table.name]);
            continue;
          }
          const csv = toCSV(data, table.columns);
          const date = new Date().toISOString().split("T")[0];
          downloadFile(csv, `immocontrol-${table.name}-${date}.csv`, "text/csv;charset=utf-8");
          setExportedTables(prev => [...prev, table.name]);
        } catch {
          /* Skip tables that fail */
        }
      }
      toast.success("CSV-Dateien heruntergeladen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  }, [user, fetchTableData]);

  /** EXPORT-8: Export single table as CSV */
  const exportSingleCSV = useCallback(async (table: ExportTable) => {
    if (!user) return;
    try {
      const data = await fetchTableData(table.name);
      if (data.length === 0) {
        toast.info(`Keine Daten in ${table.label}`);
        return;
      }
      const csv = toCSV(data, table.columns);
      const date = new Date().toISOString().split("T")[0];
      downloadFile(csv, `immocontrol-${table.name}-${date}.csv`, "text/csv;charset=utf-8");
      toast.success(`${table.label} exportiert (${data.length} Einträge)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export fehlgeschlagen");
    }
  }, [user, fetchTableData]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Daten exportieren</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Daten-Export & Backup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Exportiere alle deine Daten als Backup oder zur Weiterverarbeitung in Excel.
          </p>

          {/* Full export buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={exportJSON}
              disabled={exporting}
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
            >
              {exporting ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileJson className="h-6 w-6" />}
              <div className="text-center">
                <div className="font-medium text-sm">JSON-Backup</div>
                <div className="text-xs text-muted-foreground">Komplettes Backup</div>
              </div>
            </Button>
            <Button
              onClick={exportCSV}
              disabled={exporting}
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
            >
              {exporting ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6" />}
              <div className="text-center">
                <div className="font-medium text-sm">CSV-Export</div>
                <div className="text-xs text-muted-foreground">Für Excel (alle Tabellen)</div>
              </div>
            </Button>
          </div>

          {/* Export progress */}
          {exporting && exportedTables.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {exportedTables.length} / {EXPORT_TABLES.length} Tabellen exportiert...
              </p>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                  className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${(exportedTables.length / EXPORT_TABLES.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Individual table exports */}
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Einzelne Tabellen exportieren:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_TABLES.map(table => (
                <Badge
                  key={table.name}
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary transition-colors gap-1"
                  onClick={() => exportSingleCSV(table)}
                >
                  {exportedTables.includes(table.name) && <CheckCircle className="h-3 w-3 text-profit" />}
                  {table.label}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Letzte Sicherung: {formatDate(new Date().toISOString())} • CSV-Dateien nutzen Semikolon als Trennzeichen für Excel-Kompatibilität
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DataExportBackup;
