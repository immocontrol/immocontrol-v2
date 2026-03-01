import { useState, useCallback, useRef } from "react";
import { Upload, X, ChevronRight, Check, AlertTriangle, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileImportPicker } from "@/components/FileImportPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CONTACT_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "company", label: "Firma" },
  { key: "category", label: "Kategorie" },
  { key: "email", label: "E-Mail" },
  { key: "phone", label: "Telefon" },
  { key: "address", label: "Adresse" },
  { key: "notes", label: "Notizen" },
];

const VALID_CATEGORIES = ["Handwerker", "Hausverwaltung", "Versicherung", "Sonstiges"];
const SKIP_VALUE = "__skip__";

interface ParsedRow {
  [key: string]: string;
}

interface MappedContact {
  name: string;
  company: string | null;
  category: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) throw new Error("Datei enthält zu wenig Zeilen");

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === "," || ch === ";" || ch === "\t") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseRow(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  }).filter(row => Object.values(row).some(v => v.trim()));

  return { headers, rows };
}

function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const patterns: Record<string, string[]> = {
    name: ["name", "vollname", "fullname", "vorname", "nachname", "kontakt"],
    company: ["firma", "unternehmen", "company", "organisation", "organization", "betrieb"],
    category: ["kategorie", "category", "typ", "type", "art", "gruppe"],
    email: ["email", "mail", "emailadresse", "email"],
    phone: ["telefon", "phone", "tel", "handy", "mobil", "mobile", "nummer"],
    address: ["adresse", "address", "anschrift", "strasse", "ort", "plz", "location"],
    notes: ["notizen", "notes", "bemerkung", "anmerkung", "kommentar", "info"],
  };

  headers.forEach(header => {
    const norm = normalize(header);
    for (const [field, pats] of Object.entries(patterns)) {
      if (!mapping[field] && pats.some(p => norm.includes(p))) {
        mapping[field] = header;
      }
    }
  });

  return mapping;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Step = "upload" | "map" | "preview" | "done";

const ContactCsvImport = ({ open, onClose, onImported }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImporting(false);
    setImportedCount(0);
    setFileName("");
  };

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers: h, rows: r } = parseCSV(text);
        if (h.length === 0) throw new Error("Keine Spalten gefunden");
        setHeaders(h);
        setRows(r);
        setMapping(guessMapping(h));
        setStep("map");
      /* FIX-42: Type catch variable as `unknown` for proper error handling */
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Datei konnte nicht gelesen werden");
      }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const getMappedContacts = (): MappedContact[] => {
    return rows.map(row => {
      const get = (field: string) => {
        const col = mapping[field];
        if (!col || col === SKIP_VALUE) return null;
        return row[col]?.trim() || null;
      };

      let category = get("category") || "Sonstiges";
      if (!VALID_CATEGORIES.includes(category)) {
        const lower = category.toLowerCase();
        if (lower.includes("handwerk") || lower.includes("techniker") || lower.includes("monteur")) category = "Handwerker";
        else if (lower.includes("verwalt") || lower.includes("wohnungs")) category = "Hausverwaltung";
        else if (lower.includes("versich")) category = "Versicherung";
        else category = "Sonstiges";
      }

      return {
        name: get("name") || "Unbekannt",
        company: get("company"),
        category,
        email: get("email"),
        phone: get("phone"),
        address: get("address"),
        notes: get("notes"),
      };
    }).filter(c => c.name && c.name !== "Unbekannt");
  };

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    try {
      const contacts = getMappedContacts();
      if (contacts.length === 0) {
        toast.error("Keine gültigen Kontakte gefunden");
        return;
      }

      const payload = contacts.map(c => ({ ...c, user_id: user.id }));
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) throw error;

      setImportedCount(contacts.length);
      setStep("done");
      onImported();
    /* FIX-43: Type catch variable as `unknown` for proper error handling */
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Import fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  };

  const previewContacts = getMappedContacts().slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Kontakte importieren
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-4">
          {(["upload", "map", "preview", "done"] as Step[]).map((s, i) => {
            const labels = ["Datei", "Zuordnung", "Vorschau", "Fertig"];
            const idx = ["upload", "map", "preview", "done"].indexOf(step);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" :
                  done ? "text-profit" : "text-muted-foreground"
                }`}>
                  {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {labels[i]}
                </div>
                {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        {step === "upload" && (
          <>
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">CSV-Datei hier ablegen oder klicken</p>
              <p className="text-xs text-muted-foreground">Unterstützt: CSV, TSV (Komma, Semikolon oder Tab-getrennt)</p>
              <p className="text-xs text-muted-foreground mt-1">Erste Zeile wird als Spaltenüberschrift verwendet</p>
            </div>

            {/* BUG-12: Mobile file import picker — shows app selection on mobile */}
            <div className="sm:hidden mt-2">
              <FileImportPicker
                accept=".csv,.txt,.tsv"
                onFile={handleFile}
                label="CSV vom Handy importieren"
                variant="outline"
                size="sm"
                className="w-full"
                icon={<Upload className="h-3.5 w-3.5" />}
              />
            </div>
          </>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
              <strong>{rows.length} Zeilen</strong> in <strong>{fileName}</strong> erkannt. Weise die Spalten den Kontaktfeldern zu.
            </div>

            <div className="space-y-2">
              {CONTACT_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <div className="w-32 text-sm shrink-0">
                    {field.label}
                    {field.required && <span className="text-loss ml-0.5">*</span>}
                  </div>
                  <Select
                    value={mapping[field.key] || SKIP_VALUE}
                    onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v === SKIP_VALUE ? "" : v }))}
                  >
                    <SelectTrigger className="h-8 text-sm flex-1">
                      <SelectValue placeholder="Spalte auswählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP_VALUE}>
                        <span className="text-muted-foreground">— Überspringen —</span>
                      </SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[field.key] && mapping[field.key] !== SKIP_VALUE && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      z.B.: {rows[0]?.[mapping[field.key]] || "–"}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {!mapping["name"] && (
              <div className="flex items-center gap-2 text-xs text-gold bg-gold/10 rounded-lg p-2.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Das Feld "Name" ist Pflicht und muss zugewiesen werden.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-3.5 w-3.5 mr-1" /> Zurück
              </Button>
              <Button
                size="sm"
                onClick={() => setStep("preview")}
                disabled={!mapping["name"]}
              >
                Weiter <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
              <strong>{getMappedContacts().length} Kontakte</strong> werden importiert. Vorschau der ersten 5:
            </div>

            <div className="space-y-2">
              {previewContacts.map((c, i) => (
                <div key={i} className="border border-border rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{c.category}</span>
                    {c.company && <span className="text-xs text-muted-foreground">{c.company}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                    {c.address && <span>{c.address}</span>}
                  </div>
                </div>
              ))}
              {getMappedContacts().length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  + {getMappedContacts().length - 5} weitere Kontakte…
                </p>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("map")}>
                <X className="h-3.5 w-3.5 mr-1" /> Zurück
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importing} className="gap-1.5">
                {importing ? (
                  <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importiere…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5" /> {getMappedContacts().length} Kontakte importieren</>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 rounded-full bg-profit/10 flex items-center justify-center mx-auto">
              <Check className="h-7 w-7 text-profit" />
            </div>
            <p className="text-lg font-semibold">{importedCount} Kontakte importiert!</p>
            <p className="text-sm text-muted-foreground">Alle Kontakte wurden erfolgreich hinzugefügt.</p>
            <Button onClick={() => { reset(); onClose(); }} className="mt-4">
              Fertig
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactCsvImport;
