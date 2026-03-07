/**
 * PDF mit KI auswerten — Text aus PDF extrahieren und mit DeepSeek analysieren.
 * Nutzt VITE_DEEPSEEK_API_KEY. PDF-Text wird mit pdfjs (exposeParser) extrahiert.
 */
import { useState, useCallback } from "react";
import { FileText, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { extractPdfText } from "@/lib/exposeParser";
import { completeDeepSeekChat, isDeepSeekConfigured } from "@/integrations/ai/deepseek";

const MAX_TEXT_LENGTH = 12000; // Zeichen für API (ca. 3k Tokens Eingabe)

const PRESET_PROMPTS = [
  { label: "Kurz zusammenfassen", value: "Fasse den folgenden Text in 3–5 Sätzen zusammen. Behalte die wichtigsten Fakten bei." },
  { label: "Vertrag: Fristen & Kernpunkte", value: "Analysiere den Text als Vertrag (z.B. Mietvertrag, Darlehen). Extrahiere: Vertragsparteien, Laufzeit, Kündigungsfristen, Beträge/Miete, Besondere Klauseln. Formatiere als Stichpunkte." },
  { label: "Exposé: Stichpunkte", value: "Der Text ist ein Immobilien-Exposé. Extrahiere: Objektart, Adresse/Lage, Preis, Fläche, Miete/Kosten, Besonderheiten. Formatiere als kurze Stichpunkte." },
  { label: "Exposé: Analyse + Bewertung", value: "Der Text ist ein Immobilien-Exposé. Analysiere: Objektart, Lage, Preis, Fläche, Miete, Kaufnebenkosten. Gib eine kurze Einschätzung: Chancen, Risiken, grobe Rendite-Einschätzung. Formatiere als Stichpunkte mit Fazit am Ende." },
  { label: "Rechnung/Gutachten: Kerninfos", value: "Extrahiere aus dem Dokument: Art (Rechnung/Gutachten/Bescheid), Beträge, Datum, Fristen, Zahlungsempfänger/Aussteller. Kurz in Stichpunkten." },
];

export function PdfWithAI() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Bitte eine PDF-Datei wählen.");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error("PDF max. 15 MB.");
      return;
    }
    setFile(f);
    setResult("");
    setExtracting(true);
    setExtractedText("");
    try {
      const text = await extractPdfText(f);
      const truncated = text.length > MAX_TEXT_LENGTH
        ? text.slice(0, MAX_TEXT_LENGTH) + "\n\n[… Dokument gekürzt …]"
        : text;
      setExtractedText(truncated);
      if (!text.trim()) toast.error("Kein Text im PDF gefunden (evtl. Scan/Bild-PDF).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF konnte nicht gelesen werden.");
      setExtractedText("");
    } finally {
      setExtracting(false);
    }
  }, []);

  const runAnalysis = useCallback(async (promptText: string) => {
    if (!extractedText.trim()) {
      toast.error("Zuerst eine PDF auswählen und Text extrahieren.");
      return;
    }
    if (!isDeepSeekConfigured()) {
      toast.error("DeepSeek API-Key (VITE_DEEPSEEK_API_KEY) ist nicht gesetzt.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const systemPrompt = "Du bist ein Assistent für die Auswertung von Dokumenten (Verträge, Exposés, Rechnungen). Antworte auf Deutsch, sachlich und strukturiert.";
      const content = `${promptText}\n\n---\n\nDokumentinhalt:\n\n${extractedText}`;
      const answer = await completeDeepSeekChat(
        [{ role: "user", content }],
        { systemPrompt, maxTokens: 2048 }
      );
      setResult(answer.trim() || "Keine Antwort erhalten.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KI-Auswertung fehlgeschlagen.");
      setResult("");
    } finally {
      setLoading(false);
    }
  }, [extractedText]);

  const copyResult = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  if (!isDeepSeekConfigured()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            PDF mit KI auswerten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Setze <code className="text-xs bg-muted px-1 rounded">VITE_DEEPSEEK_API_KEY</code> in .env, um PDFs mit DeepSeek zu analysieren.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          PDF mit KI auswerten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">PDF auswählen</Label>
          <div className="mt-1 flex gap-2 items-center">
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {file && <span className="text-sm text-muted-foreground truncate max-w-[180px]">{file.name}</span>}
            {extracting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {extractedText && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">Was soll die KI tun?</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PRESET_PROMPTS.map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => runAnalysis(p.value)}
                    disabled={loading}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Oder eigene Frage / Anweisung</Label>
              <div className="mt-1 flex gap-2">
                <Textarea
                  placeholder="z.B. Welche Mietanpassung ist vereinbart?"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="min-h-[60px] text-sm"
                  rows={2}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => runAnalysis(customPrompt.trim() || "Fasse den Inhalt kurz zusammen.")}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}

        {result && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">KI-Auswertung</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyResult}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">{result}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
