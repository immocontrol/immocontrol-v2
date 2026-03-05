/**
 * MANUS-1: S-ImmoPreisfinder Browser Automation
 * Button component that triggers Manus to fill the Sparkasse form automatically
 */
import { useState } from "react";
import { Bot, Landmark, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { hasManusApiKey, runTask, buildSparkassePrompt, parseManusJson, cacheResult, getCachedResult } from "@/lib/manusAgent";
import { ManusTaskStatusIndicator } from "./ManusTaskStatus";
import type { ManusTaskStatus } from "@/lib/manusAgent";

interface SparkasseResult {
  marktwert?: number;
  preis_pro_qm?: number;
  preisrange_min?: number;
  preisrange_max?: number;
  bewertungsdatum?: string;
  quelle?: string;
  details?: string;
}

interface ManusSparkasseProps {
  data: {
    address: string;
    plz: string;
    ort: string;
    wohnflaeche: number;
    grundstueckFlaeche: number;
    baujahr: number;
    zimmer: number;
    immobilientyp: string;
    zustand: string;
    ausstattung: string;
  };
  onResult?: (result: SparkasseResult) => void;
}

export const ManusSparkasse = ({ data, onResult }: ManusSparkasseProps) => {
  const [status, setStatus] = useState<ManusTaskStatus | "idle" | "submitting">("idle");
  const [result, setResult] = useState<SparkasseResult | null>(() => {
    const cached = getCachedResult<SparkasseResult>(`sparkasse_${data.address}`);
    return cached;
  });
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hasManusApiKey()) {
      toast.error("Manus API Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.");
      return;
    }
    if (!data.address) {
      toast.error("Bitte zuerst eine Adresse eingeben");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const prompt = buildSparkassePrompt(data);
      const taskResult = await runTask(
        { prompt, taskMode: "agent", agentProfile: "quality" },
        (task) => setStatus(task.status),
      );

      const parsed = parseManusJson<SparkasseResult>(taskResult.task.output || "");
      if (parsed) {
        setResult(parsed);
        cacheResult(`sparkasse_${data.address}`, parsed);
        onResult?.(parsed);
        toast.success("S-ImmoPreisfinder Bewertung erhalten!");
      } else {
        setResult({ details: taskResult.task.output || "Keine strukturierten Daten erhalten" });
        toast.info("Ergebnis erhalten — konnte nicht vollständig geparst werden");
      }
      setStatus("completed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(msg);
      setStatus("failed");
      toast.error(`Manus Fehler: ${msg}`);
    }
  };

  const formatEuro = (n?: number) => n != null ? `${n.toLocaleString("de-DE")} €` : "–";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRun}
          disabled={status === "submitting" || status === "running" || status === "pending"}
          className="gap-1.5"
        >
          {status === "running" || status === "submitting" || status === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
          <Landmark className="h-3.5 w-3.5" />
          Manus: S-ImmoPreisfinder
        </Button>

        {status !== "idle" && status !== "completed" && (
          <ManusTaskStatusIndicator status={status} />
        )}
      </div>

      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1.5 p-2 rounded-lg bg-red-500/10">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={handleRun} className="h-6 px-2 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Erneut
          </Button>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
            <Landmark className="h-3.5 w-3.5" />
            S-ImmoPreisfinder Ergebnis
            {result.quelle && <span className="text-muted-foreground font-normal">({result.quelle})</span>}
          </div>

          {result.marktwert ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Marktwert</span>
                <div className="font-semibold text-sm">{formatEuro(result.marktwert)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Preis/m²</span>
                <div className="font-semibold text-sm">{formatEuro(result.preis_pro_qm)}</div>
              </div>
              {result.preisrange_min && result.preisrange_max && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Preisspanne</span>
                  <div className="font-medium">{formatEuro(result.preisrange_min)} – {formatEuro(result.preisrange_max)}</div>
                </div>
              )}
              {result.bewertungsdatum && (
                <div className="col-span-2 text-muted-foreground">
                  Stand: {result.bewertungsdatum}
                </div>
              )}
            </div>
          ) : result.details ? (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{result.details}</p>
          ) : null}
        </div>
      )}
    </div>
  );
};
