import { useState, useCallback, useRef } from "react";
import { Upload, FileText, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Download, X, Loader as Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { cn } from "@/lib/utils";

interface CsvRow {
  name: string;
  address: string;
  type: string;
  ownership: string;
  units: number;
  purchase_price: number;
  purchase_date: string;
  current_value: number;
  monthly_rent: number;
  monthly_expenses: number;
  monthly_credit_rate: number;
  remaining_debt: number;
  sqm: number;
  year_built: number;
  interest_rate: number;
}

interface ParseResult {
  valid: CsvRow[];
  errors: { row: number; message: string }[];
}

const REQUIRED_COLUMNS = ["name", "address", "type", "ownership", "units", "purchase_price", "current_value", "monthly_rent", "sqm"];

const SAMPLE_CSV = `name;address;type;ownership;units;purchase_price;purchase_date;current_value;monthly_rent;monthly_expenses;monthly_credit_rate;remaining_debt;sqm;year_built;interest_rate
MFH Düsseldorf;Musterstr. 1, 40210 Düsseldorf;MFH;privat;4;450000;2020-06-15;480000;2800;400;1200;380000;280;1975;3.5
ETW Berlin;Berliner Str. 22, 10115 Berlin;ETW;egbr;1;220000;2021-03-01;235000;950;150;600;195000;68;1990;2.8`;

function parseCsv(text: string): ParseResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { valid: [], errors: [{ row: 0, message: "CSV ist leer oder hat keine Datenzeilen" }] };

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const missingCols = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missingCols.length > 0) {
    return { valid: [], errors: [{ row: 0, message: `Fehlende Pflicht-Spalten: ${missingCols.join(", ")}` }] };
  }

  const valid: CsvRow[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] || ""; });

    if (!row.name) { errors.push({ row: i + 1, message: "Name fehlt" }); continue; }
    if (!row.address) { errors.push({ row: i + 1, message: "Adresse fehlt" }); continue; }

    const validTypes = ["MFH", "ZFH", "ETW", "EFH", "Gewerbe"];
    if (!validTypes.includes(row.type)) {
      errors.push({ row: i + 1, message: `Ungültiger Typ "${row.type}" (erlaubt: ${validTypes.join(", ")})` });
      continue;
    }

    const units = parseInt(row.units) || 1;
    const purchasePrice = parseFloat(row.purchase_price?.replace(",", ".")) || 0;
    const currentValue = parseFloat(row.current_value?.replace(",", ".")) || 0;
    const monthlyRent = parseFloat(row.monthly_rent?.replace(",", ".")) || 0;
    const sqm = parseFloat(row.sqm?.replace(",", ".")) || 0;

    if (sqm <= 0) { errors.push({ row: i + 1, message: "Wohnfläche (sqm) muss > 0 sein" }); continue; }

    valid.push({
      name: row.name,
      address: row.address,
      type: row.type,
      ownership: row.ownership || "privat",
      units,
      purchase_price: purchasePrice,
      purchase_date: row.purchase_date || "",
      current_value: currentValue,
      monthly_rent: monthlyRent,
      monthly_expenses: parseFloat(row.monthly_expenses?.replace(",", ".")) || 0,
      monthly_credit_rate: parseFloat(row.monthly_credit_rate?.replace(",", ".")) || 0,
      remaining_debt: parseFloat(row.remaining_debt?.replace(",", ".")) || 0,
      sqm,
      year_built: parseInt(row.year_built) || 0,
      interest_rate: parseFloat(row.interest_rate?.replace(",", ".")) || 0,
    });
  }

  return { valid, errors };
}

export function PropertyCsvImport({ onImported }: { onImported?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Nur CSV-Dateien werden unterstützt");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setParseResult(parseCsv(text));
      setImported(0);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const downloadSample = () => {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "immocontrol_import_vorlage.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!user || !parseResult || parseResult.valid.length === 0) return;
    setImporting(true);
    let count = 0;
    try {
      for (const row of parseResult.valid) {
        const cashflow = row.monthly_rent - row.monthly_expenses - row.monthly_credit_rate;
        const { error } = await supabase.from("properties").insert({
          user_id: user.id,
          name: row.name,
          address: row.address,
          type: row.type,
          ownership: row.ownership,
          units: row.units,
          purchase_price: row.purchase_price,
          purchase_date: row.purchase_date || null,
          current_value: row.current_value,
          monthly_rent: row.monthly_rent,
          monthly_expenses: row.monthly_expenses,
          monthly_credit_rate: row.monthly_credit_rate,
          monthly_cashflow: cashflow,
          remaining_debt: row.remaining_debt,
          sqm: row.sqm,
          year_built: row.year_built || null,
          interest_rate: row.interest_rate,
          location: "",
        });
        if (!error) count++;
      }
      setImported(count);
      await qc.invalidateQueries({ queryKey: queryKeys.properties.all });
      toast.success(`${count} Objekte erfolgreich importiert`);
      onImported?.();
      if (count === parseResult.valid.length) {
        setTimeout(() => { setOpen(false); setParseResult(null); setImported(0); }, 1500);
      }
    } catch (e: unknown) {
      handleError(e, { context: "supabase", showToast: false });
      toastErrorWithRetry("Fehler beim Import", () => handleImport());
    } finally {
      setImporting(false);
    }
  };

  const reset = () => { setParseResult(null); setImported(0); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> CSV Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Objekte importieren
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Importiere mehrere Objekte auf einmal per CSV-Datei.</p>
            <Button variant="ghost" size="sm" onClick={downloadSample} className="gap-1.5 text-xs shrink-0">
              <Download className="h-3 w-3" /> Vorlage
            </Button>
          </div>

          {!parseResult ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30"
              )}
            >
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">CSV-Datei hier ablegen</p>
              <p className="text-xs text-muted-foreground mt-1">oder klicken zum Auswählen</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {parseResult.valid.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-profit font-medium">
                      <CheckCircle className="h-3.5 w-3.5" /> {parseResult.valid.length} gültig
                    </span>
                  )}
                  {parseResult.errors.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-loss font-medium">
                      <AlertCircle className="h-3.5 w-3.5" /> {parseResult.errors.length} Fehler
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={reset} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="bg-loss/5 border border-loss/20 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {parseResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-loss">Zeile {e.row}: {e.message}</p>
                  ))}
                </div>
              )}

              {parseResult.valid.length > 0 && (
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                  {parseResult.valid.map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate flex-1">{row.name}</span>
                      <span className="text-muted-foreground ml-2">{row.type} · {row.units} Einh.</span>
                    </div>
                  ))}
                </div>
              )}

              {imported > 0 && (
                <div className="flex items-center gap-2 text-sm text-profit font-medium">
                  <CheckCircle className="h-4 w-4" /> {imported} von {parseResult.valid.length} importiert
                </div>
              )}
            </div>
          )}

          {parseResult && parseResult.valid.length > 0 && imported === 0 && (
            <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Importiere..." : `${parseResult.valid.length} Objekte importieren`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
