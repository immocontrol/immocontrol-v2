/**
 * MOB6-20: Mobile Data Export Sheet
 * One-click export as PDF/CSV/Excel with preview and format selection.
 * Supports customizable columns and date range filtering.
 */
import { useState, useCallback, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Download, FileText, Table, FileSpreadsheet, Check,
  Loader2, Calendar, Columns3, Eye,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ExportFormat = "pdf" | "csv" | "excel";

export interface ExportColumn {
  key: string;
  label: string;
  selected: boolean;
  format?: (value: unknown) => string;
}

export interface ExportConfig {
  format: ExportFormat;
  columns: ExportColumn[];
  dateRange?: { from: string; to: string };
  title?: string;
  includeHeaders: boolean;
  includeSummary: boolean;
}

interface MobileDataExportSheetProps {
  /** Column definitions */
  columns: ExportColumn[];
  /** Data to export */
  data: Record<string, unknown>[];
  /** Export handler */
  onExport: (config: ExportConfig) => Promise<Blob | string>;
  /** Default file title */
  defaultTitle?: string;
  /** Available formats */
  formats?: ExportFormat[];
  /** Show preview */
  showPreview?: boolean;
  /** Additional class */
  className?: string;
}

const formatIcons: Record<ExportFormat, React.ReactNode> = {
  pdf: <FileText className="w-5 h-5" />,
  csv: <Table className="w-5 h-5" />,
  excel: <FileSpreadsheet className="w-5 h-5" />,
};

const formatLabels: Record<ExportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
  excel: "Excel",
};

const formatDescriptions: Record<ExportFormat, string> = {
  pdf: "Druckfertig mit Formatierung",
  csv: "Für weitere Verarbeitung",
  excel: "Mit Formeln & Formatierung",
};

const formatColors: Record<ExportFormat, string> = {
  pdf: "text-red-600 bg-red-50 dark:bg-red-950/20",
  csv: "text-green-600 bg-green-50 dark:bg-green-950/20",
  excel: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
};

export const MobileDataExportSheet = memo(function MobileDataExportSheet({
  columns: initialColumns,
  data,
  onExport,
  defaultTitle = "Export",
  formats = ["pdf", "csv", "excel"],
  showPreview = true,
  className,
}: MobileDataExportSheetProps) {
  const isMobile = useIsMobile();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(formats[0] || "pdf");
  const [columns, setColumns] = useState(initialColumns);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);

  const selectedColumns = useMemo(
    () => columns.filter(c => c.selected),
    [columns]
  );

  const toggleColumn = useCallback((key: string) => {
    setColumns(prev => prev.map(c =>
      c.key === key ? { ...c, selected: !c.selected } : c
    ));
  }, []);

  const toggleAllColumns = useCallback((selected: boolean) => {
    setColumns(prev => prev.map(c => ({ ...c, selected })));
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const config: ExportConfig = {
        format: selectedFormat,
        columns: selectedColumns,
        dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
        title,
        includeHeaders,
        includeSummary,
      };

      const result = await onExport(config);

      // Trigger download
      if (result instanceof Blob) {
        const url = URL.createObjectURL(result);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}_${new Date().toISOString().split("T")[0]}.${selectedFormat === "excel" ? "xlsx" : selectedFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      const { handleError } = await import("@/lib/handleError");
      handleError(err, { context: "export", toastMessage: "Export fehlgeschlagen" });
    } finally {
      setIsExporting(false);
    }
  }, [selectedFormat, selectedColumns, dateFrom, dateTo, title, includeHeaders, includeSummary, onExport]);

  // Preview data (first 5 rows)
  const previewData = useMemo(() => {
    return data.slice(0, 5).map(row => {
      const mapped: Record<string, string> = {};
      for (const col of selectedColumns) {
        const value = row[col.key];
        mapped[col.key] = col.format ? col.format(value) : String(value ?? "");
      }
      return mapped;
    });
  }, [data, selectedColumns]);

  return (
    <div className={cn("w-full", className)}>
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Download className="w-4 h-4" />
          Daten exportieren
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {data.length} {data.length === 1 ? "Datensatz" : "Datensätze"}
        </span>
      </div>

      {/* Format selector */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {formats.map(format => (
          <button
            key={format}
            onClick={() => setSelectedFormat(format)}
            className={cn(
              "rounded-xl border p-3 text-center transition-all",
              selectedFormat === format
                ? "border-primary ring-2 ring-primary/20"
                : "hover:border-primary/40",
              isMobile && "min-h-[72px]"
            )}
          >
            <div className={cn("w-10 h-10 rounded-lg mx-auto flex items-center justify-center mb-1", formatColors[format])}>
              {formatIcons[format]}
            </div>
            <p className="text-xs font-medium">{formatLabels[format]}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{formatDescriptions[format]}</p>
          </button>
        ))}
      </div>

      {/* Export title */}
      <div className="mb-3">
        <label className="text-[10px] text-muted-foreground block mb-1">Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(
            "w-full px-3 py-2 rounded-lg border text-xs bg-background",
            isMobile && "min-h-[44px]"
          )}
        />
      </div>

      {/* Date range */}
      <div className="mb-3">
        <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Zeitraum (optional)
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border text-[10px] bg-background"
            placeholder="Von"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border text-[10px] bg-background"
            placeholder="Bis"
          />
        </div>
      </div>

      {/* Column selector */}
      <div className="mb-3">
        <button
          onClick={() => setShowColumnSelector(prev => !prev)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg border text-xs hover:bg-muted transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Columns3 className="w-3.5 h-3.5" />
            Spalten ({selectedColumns.length}/{columns.length})
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showColumnSelector && "rotate-180")} />
        </button>

        {showColumnSelector && (
          <div className="mt-1 border rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto animate-in slide-in-from-top-1 duration-200">
            <div className="flex gap-2 mb-1.5">
              <button onClick={() => toggleAllColumns(true)} className="text-[10px] text-primary hover:underline">
                Alle auswählen
              </button>
              <button onClick={() => toggleAllColumns(false)} className="text-[10px] text-muted-foreground hover:underline">
                Keine
              </button>
            </div>
            {columns.map(col => (
              <label
                key={col.key}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer",
                  isMobile && "min-h-[36px]"
                )}
              >
                <input
                  type="checkbox"
                  checked={col.selected}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-muted-foreground/30 accent-primary"
                />
                <span className="text-[10px]">{col.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex gap-3 mb-3 text-[10px]">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeHeaders}
            onChange={(e) => setIncludeHeaders(e.target.checked)}
            className="rounded accent-primary"
          />
          Spaltenüberschriften
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSummary}
            onChange={(e) => setIncludeSummary(e.target.checked)}
            className="rounded accent-primary"
          />
          Zusammenfassung
        </label>
      </div>

      {/* Preview */}
      {showPreview && selectedColumns.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowPreviewPanel(prev => !prev)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <Eye className="w-3 h-3" />
            Vorschau {showPreviewPanel ? "ausblenden" : "anzeigen"}
          </button>

          {showPreviewPanel && (
            <div className="overflow-x-auto border rounded-lg animate-in slide-in-from-top-1 duration-200">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-muted/50">
                    {selectedColumns.map(col => (
                      <th key={col.key} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-t">
                      {selectedColumns.map(col => (
                        <td key={col.key} className="px-2 py-1 whitespace-nowrap">
                          {row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 5 && (
                <div className="px-2 py-1 text-center text-[9px] text-muted-foreground border-t bg-muted/30">
                  ... und {data.length - 5} weitere Zeilen
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={isExporting || selectedColumns.length === 0}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm",
          "transition-all",
          exportSuccess
            ? "bg-green-500 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
          "disabled:opacity-50",
          isMobile && "min-h-[48px]"
        )}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Wird exportiert...
          </>
        ) : exportSuccess ? (
          <>
            <Check className="w-4 h-4" />
            Export erfolgreich!
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Als {formatLabels[selectedFormat]} exportieren
          </>
        )}
      </button>
    </div>
  );
});
