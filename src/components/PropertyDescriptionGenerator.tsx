/**
 * Objektbeschreibung generieren — aus Stammdaten kurzen Anzeigen- oder Exposé-Text erzeugen
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { completeDeepSeekChat, isDeepSeekConfigured } from "@/integrations/ai/deepseek";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";

interface PropertyData {
  name?: string;
  address?: string;
  type?: string;
  sqm?: number;
  units?: number;
  monthlyRent?: number;
  purchasePrice?: number;
  yearBuilt?: number;
}

interface PropertyDescriptionGeneratorProps {
  property?: PropertyData;
}

export function PropertyDescriptionGenerator({ property }: PropertyDescriptionGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const [manualInput, setManualInput] = useState("");
  const inputText = property
    ? [
        property.name && `Objekt: ${property.name}`,
        property.address && `Adresse: ${property.address}`,
        property.type && `Typ: ${property.type}`,
        property.sqm && `Fläche: ${property.sqm} m²`,
        property.units && `Einheiten: ${property.units}`,
        property.monthlyRent && `Miete: ${property.monthlyRent.toLocaleString("de-DE")} €/Monat`,
        property.purchasePrice && `Kaufpreis: ${property.purchasePrice.toLocaleString("de-DE")} €`,
        property.yearBuilt && `Baujahr: ${property.yearBuilt}`,
      ]
        .filter(Boolean)
        .join("\n")
    : manualInput.trim();

  const run = async () => {
    if (!isDeepSeekConfigured()) {
      toast.error("VITE_DEEPSEEK_API_KEY ist nicht gesetzt.");
      return;
    }
    const text = inputText.trim();
    if (!text) {
      toast.error("Keine Objektdaten vorhanden.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const answer = await completeDeepSeekChat(
        [
          {
            role: "user",
            content: `Erzeuge aus diesen Objektdaten eine kurze, ansprechende Immobilienbeschreibung (3–5 Sätze) für Anzeigen oder Exposé. Professionell, sachlich, auf Deutsch:\n\n${text}`,
          },
        ],
        {
          systemPrompt: "Du bist Experte für Immobilientexte. Schreibe prägnant und verkaufsorientiert.",
          maxTokens: 512,
        }
      );
      setResult(answer.trim() || "Keine Beschreibung erhalten.");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "KI-Fehler", run);
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("In Zwischenablage kopiert");
      },
      () => toast.error("Kopieren fehlgeschlagen")
    );
  };

  if (!isDeepSeekConfigured()) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Objektbeschreibung generieren
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {property ? (
          inputText && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{inputText}</p>
        ) : (
          <Textarea
            placeholder="Objektname, Adresse, Typ, m², Miete, Kaufpreis, Baujahr… (Stichpunkte)"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            rows={4}
            className="text-sm"
          />
        )}
        <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Beschreibung erzeugen
        </Button>
        {result && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Ergebnis</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="In Zwischenablage kopieren" onClick={copyResult}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{result}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
