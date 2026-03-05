/**
 * MANUS-3: Exposé-Analyse & Deal-Scoring
 * Analyzes property data via Manus and returns a deal score with market comparison
 */
import { useState } from "react";
import { Bot, FileText, Loader2, RefreshCw, Star, ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { hasManusApiKey, runTask, buildExposeAnalysePrompt, parseManusJson, cacheResult, getCachedResult } from "@/lib/manusAgent";
import { ManusTaskStatusIndicator } from "./ManusTaskStatus";
import type { ManusTaskStatus } from "@/lib/manusAgent";

interface ExposeAnalyseResult {
  deal_score?: number;
  deal_bewertung?: string;
  marktpreis_schaetzung?: number;
  preis_differenz_prozent?: number;
  brutto_rendite?: number;
  netto_rendite_geschaetzt?: number;
  ertragswert_schaetzung?: number;
  pro?: string[];
  contra?: string[];
  risiken?: string[];
  empfehlung?: string;
  vergleichspreise_qm?: { min: number; avg: number; max: number };
  quellen?: string[];
}

interface ManusExposeAnalyseProps {
  data: {
    address: string;
    kaufpreis: number;
    wohnflaeche: number;
    baujahr: number;
    zimmer: number;
    kaltmiete: number;
    immobilientyp: string;
  };
  onResult?: (result: ExposeAnalyseResult) => void;
}

const SCORE_COLORS: Record<string, string> = {
  "10": "text-emerald-500", "9": "text-emerald-500", "8": "text-emerald-400",
  "7": "text-green-500", "6": "text-yellow-500", "5": "text-amber-500",
  "4": "text-orange-500", "3": "text-red-400", "2": "text-red-500", "1": "text-red-600",
};

export const ManusExposeAnalyse = ({ data, onResult }: ManusExposeAnalyseProps) => {
  const cacheKey = `expose_${data.address}_${data.kaufpreis}`;
  const [status, setStatus] = useState<ManusTaskStatus | "idle" | "submitting">("idle");
  const [result, setResult] = useState<ExposeAnalyseResult | null>(() =>
    getCachedResult<ExposeAnalyseResult>(cacheKey)
  );
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hasManusApiKey()) {
      toast.error("Manus API Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.");
      return;
    }
    if (!data.address || !data.kaufpreis) {
      toast.error("Adresse und Kaufpreis erforderlich");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const prompt = buildExposeAnalysePrompt(data);
      const taskResult = await runTask(
        { prompt, taskMode: "agent", agentProfile: "quality" },
        (task) => setStatus(task.status),
      );

      const parsed = parseManusJson<ExposeAnalyseResult>(taskResult.task.output || "");
      if (parsed) {
        setResult(parsed);
        cacheResult(cacheKey, parsed);
        onResult?.(parsed);
        toast.success("Exposé-Analyse abgeschlossen!");
      } else {
        toast.info("Ergebnis erhalten — Struktur unvollständig");
      }
      setStatus("completed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(msg);
      setStatus("failed");
      toast.error(`Manus Fehler: ${msg}`);
    }
  };

  const formatEuro = (n?: number) => n ? `${n.toLocaleString("de-DE")} €` : "–";

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
          <FileText className="h-3.5 w-3.5" />
          Manus: Deal-Scoring
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
        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3 animate-fade-in">
          {/* Deal Score Header */}
          {result.deal_score !== undefined && (
            <div className="flex items-center gap-3">
              <div className={`text-3xl font-bold ${SCORE_COLORS[String(result.deal_score)] || "text-foreground"}`}>
                {result.deal_score}/10
              </div>
              <div>
                <div className="text-sm font-medium">{result.deal_bewertung || "–"}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < (result.deal_score || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {result.marktpreis_schaetzung && (
              <div className="p-2 rounded-lg bg-blue-500/10">
                <div className="text-[10px] text-muted-foreground">Marktpreis (geschätzt)</div>
                <div className="font-semibold">{formatEuro(result.marktpreis_schaetzung)}</div>
              </div>
            )}
            {result.preis_differenz_prozent !== undefined && (
              <div className={`p-2 rounded-lg ${result.preis_differenz_prozent > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                <div className="text-[10px] text-muted-foreground">Preisabweichung</div>
                <div className="font-semibold">
                  {result.preis_differenz_prozent > 0 ? "+" : ""}{result.preis_differenz_prozent.toFixed(1)}%
                </div>
              </div>
            )}
            {result.brutto_rendite !== undefined && (
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <div className="text-[10px] text-muted-foreground">Brutto-Rendite</div>
                <div className="font-semibold">{result.brutto_rendite.toFixed(2)}%</div>
              </div>
            )}
            {result.ertragswert_schaetzung && (
              <div className="p-2 rounded-lg bg-violet-500/10">
                <div className="text-[10px] text-muted-foreground">Ertragswert</div>
                <div className="font-semibold">{formatEuro(result.ertragswert_schaetzung)}</div>
              </div>
            )}
          </div>

          {/* Pro / Contra */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {result.pro && result.pro.length > 0 && (
              <div>
                <div className="flex items-center gap-1 font-medium text-emerald-500 mb-1">
                  <ThumbsUp className="h-3 w-3" /> Pro
                </div>
                <ul className="space-y-0.5 text-muted-foreground">
                  {result.pro.map((p, i) => <li key={i}>+ {p}</li>)}
                </ul>
              </div>
            )}
            {result.contra && result.contra.length > 0 && (
              <div>
                <div className="flex items-center gap-1 font-medium text-red-500 mb-1">
                  <ThumbsDown className="h-3 w-3" /> Contra
                </div>
                <ul className="space-y-0.5 text-muted-foreground">
                  {result.contra.map((c, i) => <li key={i}>- {c}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Empfehlung */}
          {result.empfehlung && (
            <div className="text-xs p-2 rounded-lg bg-secondary/50 text-muted-foreground">
              <span className="font-medium text-foreground">Empfehlung:</span> {result.empfehlung}
            </div>
          )}

          {/* Vergleichspreise */}
          {result.vergleichspreise_qm && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Vergleichspreise: {formatEuro(result.vergleichspreise_qm.min)}/m² – {formatEuro(result.vergleichspreise_qm.max)}/m²
              (Ø {formatEuro(result.vergleichspreise_qm.avg)}/m²)
            </div>
          )}

          {result.quellen && result.quellen.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              Quellen: {result.quellen.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
