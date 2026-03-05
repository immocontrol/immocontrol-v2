/**
 * MANUS-6: Newsticker Intelligence
 * Triggers Manus to create a weekly market briefing from recent news
 */
import { useState } from "react";
import { Bot, Newspaper, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { hasManusApiKey, runTask, buildNewstickerIntelligencePrompt, parseManusJson, cacheResult, getCachedResult } from "@/lib/manusAgent";
import { ManusTaskStatusIndicator } from "./ManusTaskStatus";
import type { ManusTaskStatus } from "@/lib/manusAgent";

interface Trend {
  trend: string;
  bedeutung: string;
  details: string;
}

interface PortfolioAuswirkung {
  stadt: string;
  auswirkung: string;
  details: string;
}

interface Handlungsempfehlung {
  empfehlung: string;
  prioritaet: "hoch" | "mittel" | "niedrig";
  begruendung: string;
}

interface NewstickerIntelligenceResult {
  zusammenfassung?: string;
  top_trends?: Trend[];
  portfolio_auswirkungen?: PortfolioAuswirkung[];
  handlungsempfehlungen?: Handlungsempfehlung[];
  chancen?: string[];
  risiken?: string[];
  fehlende_infos?: string[];
  stimmung_gesamt?: string;
  datum?: string;
}

interface ManusNewstickerIntelligenceProps {
  recentHeadlines: string[];
  portfolioCities: string[];
  onResult?: (result: NewstickerIntelligenceResult) => void;
}

const AUSWIRKUNG_ICONS = {
  Positiv: { icon: TrendingUp, color: "text-emerald-500" },
  Neutral: { icon: Minus, color: "text-muted-foreground" },
  Negativ: { icon: TrendingDown, color: "text-red-500" },
};

const PRIO_BADGE = {
  hoch: "bg-red-500/10 text-red-500",
  mittel: "bg-amber-500/10 text-amber-500",
  niedrig: "bg-blue-500/10 text-blue-500",
};

const STIMMUNG_COLORS: Record<string, string> = {
  Bullish: "text-emerald-500 bg-emerald-500/10",
  Neutral: "text-muted-foreground bg-secondary/50",
  Bearish: "text-red-500 bg-red-500/10",
};

export const ManusNewstickerIntelligence = ({ recentHeadlines, portfolioCities, onResult }: ManusNewstickerIntelligenceProps) => {
  const [status, setStatus] = useState<ManusTaskStatus | "idle" | "submitting">("idle");
  const [result, setResult] = useState<NewstickerIntelligenceResult | null>(() =>
    getCachedResult<NewstickerIntelligenceResult>("newsticker_intelligence", 6 * 60 * 60 * 1000)
  );
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hasManusApiKey()) {
      toast.error("Manus API Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.");
      return;
    }
    if (recentHeadlines.length === 0) {
      toast.error("Keine Nachrichten verfügbar — bitte zuerst Newsticker laden.");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const prompt = buildNewstickerIntelligencePrompt({ recentHeadlines, portfolioCities });
      const taskResult = await runTask(
        { prompt, taskMode: "agent", agentProfile: "quality" },
        (task) => setStatus(task.status),
      );

      const parsed = parseManusJson<NewstickerIntelligenceResult>(taskResult.task.output || "");
      if (parsed) {
        setResult(parsed);
        cacheResult("newsticker_intelligence", parsed);
        onResult?.(parsed);
        toast.success("Markt-Briefing erstellt!");
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

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Manus AI: Markt-Briefing</h3>
          {result?.stimmung_gesamt && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STIMMUNG_COLORS[result.stimmung_gesamt] || STIMMUNG_COLORS.Neutral}`}>
              {result.stimmung_gesamt}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={status === "submitting" || status === "running" || status === "pending" || recentHeadlines.length === 0}
          className="gap-1.5"
        >
          {status === "running" || status === "submitting" || status === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Newspaper className="h-3.5 w-3.5" />
          )}
          Briefing erstellen
        </Button>
      </div>

      {status !== "idle" && status !== "completed" && (
        <ManusTaskStatusIndicator status={status} />
      )}

      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1.5 p-2 rounded-lg bg-red-500/10">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={handleRun} className="h-6 px-2 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Erneut
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Zusammenfassung */}
          {result.zusammenfassung && (
            <div className="text-xs leading-relaxed p-3 rounded-lg bg-secondary/50">
              {result.zusammenfassung}
            </div>
          )}

          {/* Top Trends */}
          {result.top_trends && result.top_trends.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium">Top Trends</h4>
              {result.top_trends.map((t, i) => (
                <div key={i} className="text-xs p-2 rounded-lg bg-secondary/30 flex items-start gap-2">
                  <TrendingUp className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{t.trend}</span>
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${t.bedeutung === "Hoch" ? "bg-red-500/10 text-red-500" : t.bedeutung === "Mittel" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
                      {t.bedeutung}
                    </span>
                    <div className="text-muted-foreground mt-0.5">{t.details}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Portfolio Auswirkungen */}
          {result.portfolio_auswirkungen && result.portfolio_auswirkungen.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium">Portfolio-Auswirkungen</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {result.portfolio_auswirkungen.map((a, i) => {
                  const config = AUSWIRKUNG_ICONS[a.auswirkung as keyof typeof AUSWIRKUNG_ICONS] || AUSWIRKUNG_ICONS.Neutral;
                  const Icon = config.icon;
                  return (
                    <div key={i} className="text-xs p-2 rounded-lg bg-secondary/30 flex items-start gap-2">
                      <Icon className={`h-3 w-3 ${config.color} mt-0.5 shrink-0`} />
                      <div>
                        <span className="font-medium">{a.stadt}</span>
                        <div className="text-muted-foreground">{a.details}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Handlungsempfehlungen */}
          {result.handlungsempfehlungen && result.handlungsempfehlungen.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium">Handlungsempfehlungen</h4>
              {result.handlungsempfehlungen.map((h, i) => (
                <div key={i} className="text-xs p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{h.empfehlung}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIO_BADGE[h.prioritaet] || PRIO_BADGE.niedrig}`}>
                      {h.prioritaet}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{h.begruendung}</div>
                </div>
              ))}
            </div>
          )}

          {/* Risiken */}
          {result.risiken && result.risiken.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" /> Risiken
              </h4>
              <ul className="text-xs space-y-0.5 text-muted-foreground">
                {result.risiken.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5">!</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.datum && (
            <div className="text-[10px] text-muted-foreground">
              Stand: {result.datum}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
