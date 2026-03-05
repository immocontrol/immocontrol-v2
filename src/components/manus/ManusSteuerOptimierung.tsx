/**
 * MANUS-4: Steuer-Optimierung & Anlage V
 * Analyzes portfolio tax strategy via Manus AI
 */
import { useState } from "react";
import { Bot, Calculator, Loader2, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { hasManusApiKey, runTask, buildSteuerOptimierungPrompt, parseManusJson, cacheResult, getCachedResult } from "@/lib/manusAgent";
import { ManusTaskStatusIndicator } from "./ManusTaskStatus";
import type { ManusTaskStatus } from "@/lib/manusAgent";

interface AfaStatus {
  immobilie: string;
  aktueller_satz: number;
  empfohlen: number;
  sonder_afa_moeglich: boolean;
}

interface Empfehlung {
  titel: string;
  beschreibung: string;
  potenzial_euro: number;
  prioritaet: "hoch" | "mittel" | "niedrig";
}

interface Urteil {
  gericht: string;
  datum: string;
  az: string;
  relevanz: string;
}

interface SteuerResult {
  optimierungspotential_jaehrlich?: number;
  afa_status?: AfaStatus[];
  empfehlungen?: Empfehlung[];
  aktuelle_urteile?: Urteil[];
  warnungen?: string[];
  quellen?: string[];
}

interface ManusSteuerOptimierungProps {
  properties: Array<{
    name: string;
    kaufpreis: number;
    baujahr: number;
    kaufdatum: string;
    jahresmiete: number;
    wohnflaeche: number;
  }>;
  ownership?: string;
  onResult?: (result: SteuerResult) => void;
}

const PRIO_COLORS = {
  hoch: "bg-red-500/10 text-red-500 border-red-500/20",
  mittel: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  niedrig: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

export const ManusSteuerOptimierung = ({ properties, ownership = "privat", onResult }: ManusSteuerOptimierungProps) => {
  const [status, setStatus] = useState<ManusTaskStatus | "idle" | "submitting">("idle");
  const [result, setResult] = useState<SteuerResult | null>(() =>
    getCachedResult<SteuerResult>("steuer_optimierung")
  );
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hasManusApiKey()) {
      toast.error("Manus API Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.");
      return;
    }
    if (properties.length === 0) {
      toast.error("Keine Immobilien im Portfolio — bitte zuerst Immobilien anlegen.");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const prompt = buildSteuerOptimierungPrompt({ properties, ownership });
      const taskResult = await runTask(
        { prompt, taskMode: "agent", agentProfile: "quality" },
        (task) => setStatus(task.status),
      );

      const parsed = parseManusJson<SteuerResult>(taskResult.task.output || "");
      if (parsed) {
        setResult(parsed);
        cacheResult("steuer_optimierung", parsed);
        onResult?.(parsed);
        toast.success("Steuer-Optimierung abgeschlossen!");
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

  const formatEuro = (n?: number) => n != null ? `${n.toLocaleString("de-DE")} €` : "–";

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Manus AI: Steuer-Optimierung</h3>
        </div>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={status === "submitting" || status === "running" || status === "pending" || properties.length === 0}
          className="gap-1.5"
        >
          {status === "running" || status === "submitting" || status === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Calculator className="h-3.5 w-3.5" />
          )}
          Analyse starten
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
          {/* Optimierungspotential */}
          {result.optimierungspotential_jaehrlich !== undefined && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-[10px] text-muted-foreground">Jährliches Optimierungspotential</div>
                <div className="text-lg font-bold text-emerald-500">
                  {formatEuro(result.optimierungspotential_jaehrlich)}
                </div>
              </div>
            </div>
          )}

          {/* AfA Status */}
          {result.afa_status && result.afa_status.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">AfA-Übersicht</h4>
              <div className="space-y-1">
                {result.afa_status.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/50">
                    <span className="font-medium">{a.immobilie}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">Aktuell: {a.aktueller_satz}%</span>
                      <span className="font-medium text-emerald-500">Empfohlen: {a.empfohlen}%</span>
                      {a.sonder_afa_moeglich && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">Sonder-AfA</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empfehlungen */}
          {result.empfehlungen && result.empfehlungen.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Empfehlungen</h4>
              <div className="space-y-1.5">
                {result.empfehlungen.map((e, i) => (
                  <div key={i} className={`text-xs p-2.5 rounded-lg border ${PRIO_COLORS[e.prioritaet] || PRIO_COLORS.niedrig}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{e.titel}</span>
                      <span className="font-semibold">{formatEuro(e.potenzial_euro)}/Jahr</span>
                    </div>
                    <p className="text-muted-foreground">{e.beschreibung}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aktuelle Urteile */}
          {result.aktuelle_urteile && result.aktuelle_urteile.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Relevante Urteile</h4>
              <div className="space-y-1">
                {result.aktuelle_urteile.map((u, i) => (
                  <div key={i} className="text-xs p-2 rounded-lg bg-secondary/50">
                    <div className="font-medium">{u.gericht} — {u.az} ({u.datum})</div>
                    <div className="text-muted-foreground mt-0.5">{u.relevanz}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnungen */}
          {result.warnungen && result.warnungen.length > 0 && (
            <div className="space-y-1">
              {result.warnungen.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-500 p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  {w}
                </div>
              ))}
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
