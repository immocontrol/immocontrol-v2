import { useState, useCallback, useRef } from "react";
import { FileUp, Sparkles, Loader2, Check, AlertTriangle, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileImportPicker } from "@/components/FileImportPicker";
import { toast } from "sonner";
import type { AnalysisInputState } from "@/hooks/useAnalysisCalculations";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { BUNDESLAENDER_GRUNDERWERBSTEUER } from "@/hooks/useAnalysisCalculations";
import { saveExposeHistoryEntry } from "./ExposeHistory";
import { extractPdfText } from "@/lib/exposeParser";
import { getSupabaseEnv } from "@/integrations/supabase/client";

interface Props {
  onImport: (updates: Partial<AnalysisInputState>) => void;
}

const fieldLabels: Record<string, string> = {
  kaufpreis: "Kaufpreis",
  monatlicheMiete: "Monatliche Miete",
  quadratmeter: "Wohnfläche",
  bundesland: "Bundesland",
  maklerProvision: "Maklerprovision",
  bewirtschaftungskosten: "Bewirtschaftungskosten",
  titel: "Titel",
  adresse: "Adresse",
  zimmer: "Zimmer",
  baujahr: "Baujahr",
};

/* FIX-49: Replace `any` parameter with `unknown` */
const formatValue = (key: string, value: unknown): string => {
  if (value == null) return "–";
  if (typeof value === "number") {
    if (key.includes("Provision") || key.includes("provision")) return `${value}%`;
    if (key === "kaufpreis" || key === "bewirtschaftungskosten" || key === "monatlicheMiete")
      return `${value.toLocaleString("de-DE")} €`;
    if (key === "quadratmeter") return `${value} m²`;
    return String(value);
  }
  return String(value);
};

const PdfImport = ({ onImport }: Props) => {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<"reading" | "analyzing">("reading");
  const [fileName, setFileName] = useState<string | null>(null);
  /* FIX-49b: Replace `Record<string, any>` with proper type in PdfImport state */
  const [result, setResult] = useState<{ data: Record<string, unknown>; imported: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);

  const handleFile = useCallback(async (file: File) => {
    lastFileRef.current = file;
    if (!file.type.includes("pdf")) {
      toast.error("Bitte eine PDF-Datei auswählen");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error("Datei ist zu groß (max. 30 MB)");
      return;
    }

    setFileName(file.name);
    setLoading(true);
    setLoadingStep("reading");
    setError(null);
    setResult(null);

    try {
      const pdfText = await extractPdfText(file);

      if (!pdfText.trim()) {
        setError("Kein Text im PDF gefunden. Bitte prüfe, ob das PDF lesbar ist.");
        toast.error("Kein lesbarer Text im PDF gefunden.");
        return;
      }

      setLoadingStep("analyzing");

      const { url: baseUrl, anonKey } = getSupabaseEnv();
      const resp = await fetch(
        `${baseUrl}/functions/v1/extract-pdf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: pdfText, filename: file.name }),
        }
      );

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        const errMsg = data.error || "Fehler beim Extrahieren";
        setError(errMsg);
        handleError(new Error(errMsg), { context: "network", showToast: false });
        toastErrorWithRetry(errMsg, () => lastFileRef.current && handleFile(lastFileRef.current));
        return;
      }

      setResult({ data: data.data, imported: false });
      saveExposeHistoryEntry({
        id: crypto.randomUUID(),
        data: data.data,
        source: "pdf",
        sourceLabel: file.name,
        importedAt: new Date().toISOString(),
      });
      toast.success("PDF-Daten erfolgreich extrahiert!");
    /* FIX-48: Type catch variable as `unknown` for proper error handling */
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Netzwerkfehler";
      setError(msg);
      handleError(e, { context: "network", showToast: false });
      toastErrorWithRetry(msg, () => lastFileRef.current && handleFile(lastFileRef.current));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApply = useCallback(() => {
    if (!result?.data) return;
    const d = result.data;
    const updates: Partial<AnalysisInputState> = {};

    if (d.kaufpreis && d.kaufpreis > 0) updates.kaufpreis = d.kaufpreis;
    if (d.monatlicheMiete && d.monatlicheMiete > 0) updates.monatlicheMiete = d.monatlicheMiete;
    if (d.quadratmeter && d.quadratmeter > 0) updates.quadratmeter = d.quadratmeter;
    if (d.bewirtschaftungskosten && d.bewirtschaftungskosten > 0)
      updates.bewirtschaftungskosten = d.bewirtschaftungskosten;
    if (d.maklerProvision && d.maklerProvision > 0) updates.maklerProvision = d.maklerProvision;
    if (d.bundesland && BUNDESLAENDER_GRUNDERWERBSTEUER[d.bundesland]) {
      updates.bundesland = d.bundesland;
    }

    onImport(updates);
    setResult((prev) => (prev ? { ...prev, imported: true } : null));
    toast.success("Daten in Analyse übernommen!");
  }, [result, onImport]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const reset = () => {
    setFileName(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <FileUp className="h-4 w-4 text-primary" />
        PDF-Import (AI)
      </h2>

      <p className="text-xs text-muted-foreground">
        Lade ein Exposé-PDF hoch – die KI extrahiert automatisch alle Objektdaten.
      </p>

      {!loading && !result && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-primary/40 rounded-lg p-6 text-center cursor-pointer transition-colors group"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <FileText className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-primary transition-colors mb-2" />
          <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            PDF hierher ziehen oder <span className="text-primary font-medium">klicken</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Max. 30 MB · Nur PDF</p>
        </div>
      )}

      {/* BUG-12: Mobile file import picker — shows app selection on mobile */}
      {!loading && !result && (
        <div className="sm:hidden">
          <FileImportPicker
            accept=".pdf"
            onFile={handleFile}
            label="PDF vom Handy importieren"
            variant="outline"
            size="sm"
            className="w-full"
            icon={<FileUp className="h-3.5 w-3.5" />}
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">
              {loadingStep === "reading" ? `Lese ${fileName}…` : `Analysiere ${fileName}…`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {loadingStep === "reading" ? "Text wird extrahiert" : "KI strukturiert Immobiliendaten"}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-loss bg-loss/10 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={reset} className="text-loss hover:text-loss/70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span className="truncate max-w-[200px]">{fileName}</span>
            </div>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
              Neue Datei
            </button>
          </div>

          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            {result.data.titel && (
              <div className="text-sm font-medium">{result.data.titel}</div>
            )}
            {result.data.adresse && (
              <div className="text-xs text-muted-foreground">{result.data.adresse}</div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2">
              {Object.entries(result.data)
                .filter(([k]) => k !== "titel" && k !== "adresse")
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{fieldLabels[key] || key}</span>
                    <span className="font-medium">{formatValue(key, value)}</span>
                  </div>
                ))}
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleApply}
            disabled={result.imported}
            className="w-full gap-1.5"
            variant={result.imported ? "outline" : "default"}
          >
            {result.imported ? (
              <>
                <Check className="h-3.5 w-3.5" /> Übernommen
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> In Analyse übernehmen
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PdfImport;
