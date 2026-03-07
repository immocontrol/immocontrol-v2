import { useState, useCallback, useRef } from "react";
import { FileUp, Loader2, Check, AlertTriangle, X, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileImportPicker } from "@/components/FileImportPicker";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { extractPdfText } from "@/lib/exposeParser";
import { isDeepSeekConfigured, extractLoanFromText, type ExtractedLoanFields } from "@/integrations/ai/extractors";

/** Merge AI-extracted fields into regex result (AI overwrites non-empty) */
function mergeLoanFields(
  regex: Partial<ParsedLoan>,
  ai: ExtractedLoanFields
): Partial<ParsedLoan> {
  const out = { ...regex };
  if (ai.bank_name) out.bank_name = ai.bank_name;
  if (typeof ai.loan_amount === "number" && ai.loan_amount > 0) out.loan_amount = ai.loan_amount;
  if (typeof ai.remaining_balance === "number") out.remaining_balance = ai.remaining_balance;
  if (typeof ai.interest_rate === "number" && ai.interest_rate > 0) out.interest_rate = ai.interest_rate;
  if (typeof ai.repayment_rate === "number" && ai.repayment_rate > 0) out.repayment_rate = ai.repayment_rate;
  if (typeof ai.monthly_payment === "number" && ai.monthly_payment > 0) out.monthly_payment = ai.monthly_payment;
  if (ai.fixed_interest_until) out.fixed_interest_until = ai.fixed_interest_until;
  if (ai.start_date) out.start_date = ai.start_date;
  if (ai.loan_type) out.loan_type = ai.loan_type;
  if (ai.notes) out.notes = ai.notes;
  return out;
}

interface ParsedLoan {
  bank_name: string;
  loan_amount: number;
  remaining_balance: number;
  interest_rate: number;
  repayment_rate: number;
  monthly_payment: number;
  fixed_interest_until: string;
  start_date: string;
  loan_type: string;
  notes: string;
}


/** Parse German currency string like "150.000,00" or "150000" to number */
function parseGermanNumber(str: string): number {
  // Remove currency symbols and whitespace
  let clean = str.replace(/[€\s]/g, "").trim();
  // German format: 150.000,00 → remove dots, replace comma with dot
  if (clean.includes(",")) {
    /* FIX-1: Use global /,/g to replace ALL commas */
    clean = clean.replace(/\./g, "").replace(/,/g, ".");
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/** Parse percentage like "2,50 %" or "2.50%" to number */
function parsePercent(str: string): number {
  let clean = str.replace(/%/g, "").trim();
  if (clean.includes(",")) {
    /* FIX-1: Use global /,/g to replace ALL commas */
    clean = clean.replace(/,/g, ".");
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/** Parse a date string from various German formats */
function parseGermanDate(str: string): string {
  // DD.MM.YYYY
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY-MM-DD already
  const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return "";
}

/** Try to extract loan data from PDF text using regex patterns */
function parseLoanFromText(text: string): Partial<ParsedLoan> {
  const result: Partial<ParsedLoan> = {};
  const lower = text.toLowerCase();

  // Bank name detection
  const bankPatterns = [
    /(?:sparkasse|volksbank|commerzbank|deutsche\s*bank|ing[\s-]*diba|postbank|hypovereinsbank|dkb|lbbw|helaba|berliner\s*sparkasse|hamburger\s*sparkasse|kfw|psd\s*bank|sparda[\s-]*bank|targobank|santander|unicredit|aareal|berlin\s*hyp|m[uü]nchener\s*hyp|w[uü]stenrot|bausparkasse|landesbank|nord[\s/]*lb|bay[\s]*lb|sz[\s]*bank)/i,
  ];
  for (const pat of bankPatterns) {
    const m = text.match(pat);
    if (m) {
      result.bank_name = m[0].trim();
      break;
    }
  }

  // Darlehensbetrag / Kreditbetrag / Nennbetrag
  const amountPatterns = [
    /(?:darlehensbetrag|kreditbetrag|nennbetrag|darlehenssumme|urspr[uü]nglicher?\s*betrag|auszahlungsbetrag|finanzierungsbetrag|nettodarlehensbetrag|bruttobetrag|kreditsumme|gesamtbetrag\s*des?\s*darlehens)[:\s]*([0-9.,]+)\s*(?:eur|€)?/i,
    /(?:darlehen|kredit)\s*(?:in\s*h[oö]he\s*von|[uü]ber|:)\s*([0-9.,]+)\s*(?:eur|€)?/i,
    /(?:EUR|€)\s*([0-9.,]{5,})\s*(?:darlehen|kredit)/i,
    /(?:betrag|summe)[:\s]*(?:EUR|€)?\s*([0-9.,]{5,})/i,
  ];
  for (const pat of amountPatterns) {
    const m = text.match(pat);
    if (m) {
      result.loan_amount = parseGermanNumber(m[1]);
      break;
    }
  }

  // Restschuld / Saldo
  const balancePatterns = [
    /(?:restschuld|restsaldo|aktueller?\s*saldo|restvaluta|offener?\s*betrag|ausstehender?\s*betrag|restdarlehen|restkapital|kapitalstand)[:\s]*([0-9.,]+)\s*(?:eur|€)?/i,
    /(?:saldo|stand)\s*(?:per|zum|am)\s*[0-9.]+\s*[:\s]*([0-9.,]+)\s*(?:eur|€)?/i,
  ];
  for (const pat of balancePatterns) {
    const m = text.match(pat);
    if (m) {
      result.remaining_balance = parseGermanNumber(m[1]);
      break;
    }
  }

  // Zinssatz / Sollzins / Nominalzins
  const interestPatterns = [
    /(?:sollzins(?:satz)?|nominalzins(?:satz)?|zinssatz|jahreszins|fester?\s*zins(?:satz)?|debit\s*interest)[:\s]*([0-9.,]+)\s*%/i,
    /(?:gebundener?\s*sollzins(?:satz)?)[:\s]*([0-9.,]+)\s*%/i,
    /([0-9.,]+)\s*%\s*(?:p\.?\s*a\.?|pro\s*jahr|jahreszins|sollzins|nominalzins)/i,
    /(?:zins|interest)[:\s]*([0-9]+[,.][0-9]{1,3})\s*%/i,
  ];
  for (const pat of interestPatterns) {
    const m = text.match(pat);
    if (m) {
      result.interest_rate = parsePercent(m[1]);
      break;
    }
  }

  // Tilgung / Tilgungssatz
  const repaymentPatterns = [
    /(?:tilgung(?:ssatz)?|anf[aä]ngliche\s*tilgung|j[aä]hrliche\s*tilgung|tilgungsleistung)[:\s]*([0-9.,]+)\s*%/i,
    /([0-9.,]+)\s*%\s*(?:tilgung|repayment)/i,
  ];
  for (const pat of repaymentPatterns) {
    const m = text.match(pat);
    if (m) {
      result.repayment_rate = parsePercent(m[1]);
      break;
    }
  }

  // Monatliche Rate / Annuität
  const ratePatterns = [
    /(?:monatliche?\s*rate|annuit[aä]t|monatliche?\s*zahlung|rate\s*monatlich|monatsrate|mtl\.?\s*rate|monatliche?\s*belastung|monatliche?\s*leistung)[:\s]*([0-9.,]+)\s*(?:eur|€)?/i,
    /(?:rate|zahlung)\s*(?:je|pro)\s*monat[:\s]*([0-9.,]+)\s*(?:eur|€)?/i,
  ];
  for (const pat of ratePatterns) {
    const m = text.match(pat);
    if (m) {
      result.monthly_payment = parseGermanNumber(m[1]);
      break;
    }
  }

  // Zinsbindung bis
  let fixedYears: number | null = null;
  const fixedPatterns = [
    /(?:zinsbindung(?:\s*bis)?|zinsfestschreibung(?:\s*bis)?|festzins(?:\s*bis)?|ende\s*der\s*zinsbindung|zinsbindungsende)[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i,
    /(?:zinsbindung|zinsfestschreibung)[:\s]*(?:bis\s+)?(?:zum\s+)?(\d{1,2}\.\d{1,2}\.\d{4})/i,
    /(?:zinsbindung|festschreibung)[:\s]*(\d+)\s*(?:jahre|j\.)/i,
  ];
  for (const pat of fixedPatterns) {
    const m = text.match(pat);
    if (m) {
      if (m[1].includes(".")) {
        result.fixed_interest_until = parseGermanDate(m[1]);
      } else {
        const years = parseInt(m[1], 10);
        if (!isNaN(years) && years > 0) fixedYears = years;
      }
      break;
    }
  }

  // Vertragsbeginn / Auszahlungsdatum
  const startPatterns = [
    /(?:vertragsbeginn|auszahlungsdatum|darlehensbeginn|beginn|valutierung|auszahlung\s*am|datum\s*der\s*auszahlung|laufzeitbeginn)[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i,
    /(?:vertrag|darlehen)\s*(?:vom|ab|seit)\s*(\d{1,2}\.\d{1,2}\.\d{4})/i,
  ];
  for (const pat of startPatterns) {
    const m = text.match(pat);
    if (m) {
      result.start_date = parseGermanDate(m[1]);
      break;
    }
  }

  // If we only have "Zinsbindung 10 Jahre", approximate end date based on start_date
  if (!result.fixed_interest_until && fixedYears && result.start_date) {
    const start = new Date(`${result.start_date}T00:00:00`);
    if (!isNaN(start.getTime())) {
      start.setFullYear(start.getFullYear() + fixedYears);
      result.fixed_interest_until = start.toISOString().slice(0, 10);
    }
  }

  // Loan type detection
  if (lower.includes("kfw")) result.loan_type = "kfw";
  else if (lower.includes("endf") || lower.includes("bullet")) result.loan_type = "bullet";
  else if (lower.includes("variab")) result.loan_type = "variable";
  else result.loan_type = "annuity";

  // If we have loan_amount and interest_rate but no monthly payment, calculate it
  if (result.loan_amount && result.interest_rate && !result.monthly_payment) {
    const repRate = result.repayment_rate || 2;
    result.monthly_payment = Math.round(result.loan_amount * (result.interest_rate + repRate) / 100 / 12 * 100) / 100;
  }

  // If no remaining balance, assume same as loan amount
  if (!result.remaining_balance && result.loan_amount) {
    result.remaining_balance = result.loan_amount;
  }

  return result;
}

interface LoanPdfImportProps {
  onImport: (loan: Partial<ParsedLoan>) => void;
}

export function LoanPdfImport({ onImport }: LoanPdfImportProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Partial<ParsedLoan> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      toast.error("Bitte eine PDF-Datei auswählen");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error("Datei ist zu groß (max. 30 MB)");
      return;
    }

    setFileName(file.name);
    setLoading(true);
    setError(null);
    setParsed(null);
    setRawText("");

    try {
      const text = await extractPdfText(file);
      setRawText(text);

      if (!text.trim()) {
        setError("Kein Text im PDF gefunden. Bitte prüfe, ob das PDF lesbar ist (kein Scan/Bild-PDF).");
        setLoading(false);
        return;
      }

      let result = parseLoanFromText(text);
      const regexFieldCount = Object.values(result).filter(v => v && v !== "annuity").length;

      if (isDeepSeekConfigured() && regexFieldCount < 4 && text.trim().length > 200) {
        try {
          const aiExtracted = await extractLoanFromText(text);
          result = mergeLoanFields(result, aiExtracted);
        } catch {
          /* Fallback: use regex-only result */
        }
      }

      const fieldCount = Object.values(result).filter(v => v && v !== "annuity").length;

      if (fieldCount < 2) {
        setError("Keine Darlehensdaten erkannt. Das PDF enthält möglicherweise keine typischen Kreditvertrags-Informationen.");
        setLoading(false);
        return;
      }

      setParsed(result);
      toast.success(`${fieldCount} Felder aus PDF extrahiert`);
    /* FIX-44: Type catch variable as `unknown` for proper error handling */
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Fehler beim Lesen der PDF";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApply = useCallback(() => {
    if (!parsed) return;
    onImport(parsed);
    toast.success("Darlehensdaten übernommen!");
    setOpen(false);
    setParsed(null);
    setFileName(null);
    setError(null);
    setRawText("");
  }, [parsed, onImport]);

  const reset = () => {
    setFileName(null);
    setParsed(null);
    setError(null);
    setRawText("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const fields: { key: keyof ParsedLoan; label: string; format: (v: unknown) => string }[] = [
    { key: "bank_name", label: "Bank", format: (v) => String(v || "-") },
    { key: "loan_amount", label: "Darlehensbetrag", format: (v) => typeof v === "number" && v > 0 ? formatCurrency(v) : "-" },
    { key: "remaining_balance", label: "Restschuld", format: (v) => typeof v === "number" && v > 0 ? formatCurrency(v) : "-" },
    { key: "interest_rate", label: "Zinssatz", format: (v) => typeof v === "number" && v > 0 ? `${v.toFixed(2)}%` : "-" },
    { key: "repayment_rate", label: "Tilgung", format: (v) => typeof v === "number" && v > 0 ? `${v.toFixed(2)}%` : "-" },
    { key: "monthly_payment", label: "Monatl. Rate", format: (v) => typeof v === "number" && v > 0 ? formatCurrency(v) : "-" },
    { key: "fixed_interest_until", label: "Zinsbindung bis", format: (v) => v ? new Date(String(v)).toLocaleDateString("de-DE") : "-" },
    { key: "start_date", label: "Vertragsbeginn", format: (v) => v ? new Date(String(v)).toLocaleDateString("de-DE") : "-" },
    { key: "loan_type", label: "Typ", format: (v) => ({ annuity: "Annuität", bullet: "Endfällig", variable: "Variabel", kfw: "KfW" }[String(v)] || String(v)) },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileUp className="h-3.5 w-3.5" /> PDF Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Darlehen aus PDF importieren
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Lade einen Kreditvertrag, Darlehensangebot oder Kontoauszug als PDF hoch. Die Daten werden lokal
          extrahiert (kein Upload an externe Server).
        </p>

        {!loading && !parsed && !error && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/40 rounded-lg p-8 text-center cursor-pointer transition-colors group"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <FileText className="h-10 w-10 mx-auto text-muted-foreground group-hover:text-primary transition-colors mb-3" />
            <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              PDF hierher ziehen oder <span className="text-primary font-medium">klicken</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5">Max. 30 MB · Kreditvertrag, Angebot, Kontoauszug</p>
          </div>
        )}

        {/* BUG-12: Mobile file import picker — shows app selection on mobile */}
        {!loading && !parsed && !error && (
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
              <p className="text-sm font-medium">Lese {fileName}...</p>
              <p className="text-[10px] text-muted-foreground">Text wird extrahiert und analysiert</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-loss bg-loss/10 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={reset} className="text-loss hover:text-loss/70"><X className="h-4 w-4" /></button>
          </div>
        )}

        {parsed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span className="truncate max-w-[250px]">{fileName}</span>
              </div>
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
                Neue Datei
              </button>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3 space-y-1.5">
              {fields.map(({ key, label, format }) => {
                const val = parsed[key];
                const hasValue = val !== undefined && val !== null && val !== "" && val !== 0;
                return (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${hasValue ? "" : "text-muted-foreground/50"}`}>
                      {hasValue ? format(val) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleApply} className="flex-1 gap-1.5">
                <Check className="h-3.5 w-3.5" /> Übernehmen
              </Button>
              <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Abbrechen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
