/**
 * Berichte in Prosa — KI generiert kurzen Monats-/Jahresüberblick aus Portfolio-Kennzahlen.
 * Nutzt DeepSeek (VITE_DEEPSEEK_API_KEY).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { completeDeepSeekChat, isDeepSeekConfigured } from "@/integrations/ai/deepseek";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { useProperties } from "@/context/PropertyContext";

export function BerichteInProsa() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const { properties, stats } = useProperties();

  const context = (() => {
    if (!properties?.length) return "";
    const totalValue = properties.reduce((s, p) => s + (p.currentValue || 0), 0);
    const totalRent = properties.reduce((s, p) => s + (p.monthlyRent || 0), 0);
    const totalDebt = properties.reduce((s, p) => s + (p.remainingDebt || 0), 0);
    const brutto = stats?.avgRendite ?? 0;
    const avg = typeof brutto === "number" ? brutto : 0;
    return `Portfolio: ${properties.length} Objekte. Gesamtwert: ${totalValue.toLocaleString("de-DE")} €. Mieteinnahmen/Monat: ${totalRent.toLocaleString("de-DE")} €. Restschuld: ${totalDebt.toLocaleString("de-DE")} €. Durchschn. Rendite: ${avg.toFixed(1)}%.`;
  })();

  const run = async (type: "monat" | "jahr") => {
    if (!isDeepSeekConfigured()) {
      toast.error("VITE_DEEPSEEK_API_KEY ist nicht gesetzt.");
      return;
    }
    if (!context.trim()) {
      toast.error("Keine Portfoliodaten vorhanden.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const label = type === "monat" ? "Monatsbericht" : "Jahresüberblick";
      const answer = await completeDeepSeekChat(
        [
          {
            role: "user",
            content: `Erstelle einen kurzen ${label} (3–5 Sätze) in Prosa für einen deutschen Immobilien-Investor auf Basis folgender Daten:\n\n${context}`,
          },
        ],
        {
          systemPrompt: "Du bist Experte für Immobilien-Investments. Schreibe prägnant, sachlich, auf Deutsch.",
          maxTokens: 512,
        }
      );
      setResult(answer.trim() || "Keine Antwort erhalten.");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      const msg = e instanceof Error ? e.message : "KI-Fehler";
      toastErrorWithRetry(msg, () => run(type));
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
          <FileText className="h-4 w-4" />
          Berichte in Prosa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => run("monat")} disabled={loading} className="gap-2 touch-target min-h-[44px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Monatsbericht
          </Button>
          <Button variant="outline" size="sm" onClick={() => run("jahr")} disabled={loading} className="gap-2 touch-target min-h-[44px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Jahresüberblick
          </Button>
        </div>
        {result && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Ergebnis</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyResult}>
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
