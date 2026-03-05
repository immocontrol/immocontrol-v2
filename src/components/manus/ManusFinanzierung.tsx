/**
 * MANUS-7: Finanzierungs-Optimierung
 * Compares current bank conditions via Manus and generates refinancing recommendations
 */
import { useState } from "react";
import { Bot, Landmark, Loader2, RefreshCw, TrendingDown, BadgePercent, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { hasManusApiKey, runTask, buildFinanzierungPrompt, parseManusJson, cacheResult, getCachedResult } from "@/lib/manusAgent";
import { ManusTaskStatusIndicator } from "./ManusTaskStatus";
import type { ManusTaskStatus } from "@/lib/manusAgent";

interface TopAnbieter {
  bank: string;
  zins_10j: number;
  besonderheiten: string;
}

interface RefinanzierungEmpfehlung {
  darlehen_nr: number;
  aktueller_zins: number;
  empfohlener_zins: number;
  monatliche_ersparnis: number;
  jaehrliche_ersparnis: number;
  empfohlene_bank: string;
  aktion: string;
  begruendung: string;
}

interface FinanzierungResult {
  aktuelle_marktzinsen?: { "5_jahre": number; "10_jahre": number; "15_jahre": number; "20_jahre": number };
  top_anbieter?: TopAnbieter[];
  refinanzierung_empfehlungen?: RefinanzierungEmpfehlung[];
  gesamt_einsparpotential_monatlich?: number;
  gesamt_einsparpotential_jaehrlich?: number;
  sondertilgung_empfehlung?: string;
  markteinschaetzung?: string;
  quellen?: string[];
  datum?: string;
}

interface ManusFinanzierungProps {
  loans: Array<{
    bank: string;
    restschuld: number;
    zinssatz: number;
    zinsbindung_bis: string;
    tilgung: number;
  }>;
  gesamtPortfolioWert?: number;
  onResult?: (result: FinanzierungResult) => void;
}

export const ManusFinanzierung = ({ loans, gesamtPortfolioWert, onResult }: ManusFinanzierungProps) => {
  const [status, setStatus] = useState<ManusTaskStatus | "idle" | "submitting">("idle");
  const [result, setResult] = useState<FinanzierungResult | null>(() =>
    getCachedResult<FinanzierungResult>("finanzierung_optimierung", 12 * 60 * 60 * 1000)
  );
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hasManusApiKey()) {
      toast.error("Manus API Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.");
      return;
    }
    if (loans.length === 0) {
      toast.error("Keine Darlehen vorhanden — bitte zuerst Darlehen anlegen.");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const prompt = buildFinanzierungPrompt({ loans, gesamtPortfolioWert });
      const taskResult = await runTask(
        { prompt, taskMode: "agent", agentProfile: "quality" },
        (task) => setStatus(task.status),
      );

      const parsed = parseManusJson<FinanzierungResult>(taskResult.task.output || "");
      if (parsed) {
        setResult(parsed);
        cacheResult("finanzierung_optimierung", parsed);
        onResult?.(parsed);
        toast.success("Finanzierungs-Analyse abgeschlossen!");
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
          <h3 className="text-sm font-semibold">Manus AI: Finanzierungs-Optimierung</h3>
        </div>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={status === "submitting" || status === "running" || status === "pending" || loans.length === 0}
          className="gap-1.5"
        >
          {status === "running" || status === "submitting" || status === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BadgePercent className="h-3.5 w-3.5" />
          )}
          Konditionen vergleichen
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
          {/* Gesamt-Einsparpotential */}
          {result.gesamt_einsparpotential_jaehrlich !== undefined && result.gesamt_einsparpotential_jaehrlich > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10">
              <TrendingDown className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-[10px] text-muted-foreground">Jährliches Einsparpotential</div>
                <div className="text-lg font-bold text-emerald-500">
                  {formatEuro(result.gesamt_einsparpotential_jaehrlich)}
                </div>
                <div className="text-xs text-muted-foreground">
                  ({formatEuro(result.gesamt_einsparpotential_monatlich)}/Monat)
                </div>
              </div>
            </div>
          )}

          {/* Aktuelle Marktzinsen */}
          {result.aktuelle_marktzinsen && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium">Aktuelle Marktzinsen</h4>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(result.aktuelle_marktzinsen).map(([key, val]) => (
                  <div key={key} className="p-2 rounded-lg bg-secondary/50 text-center">
                    <div className="text-[10px] text-muted-foreground">{key.replace("_", " ")}</div>
                    <div className="text-sm font-semibold">{val}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Anbieter */}
          {result.top_anbieter && result.top_anbieter.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium">Top Anbieter</h4>
              <div className="space-y-1">
                {result.top_anbieter.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{a.bank}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-500">{a.zins_10j}%</span>
                      <span className="text-[10px] text-muted-foreground">{a.besonderheiten}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refinanzierung Empfehlungen */}
          {result.refinanzierung_empfehlungen && result.refinanzierung_empfehlungen.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium">Refinanzierungs-Empfehlungen</h4>
              <div className="space-y-2">
                {result.refinanzierung_empfehlungen.map((r, i) => (
                  <div key={i} className="text-xs p-3 rounded-lg border border-border bg-card/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium">Darlehen #{r.darlehen_nr}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        r.aktion === "Umschulden" ? "bg-emerald-500/10 text-emerald-500" :
                        r.aktion === "Forward-Darlehen" ? "bg-blue-500/10 text-blue-500" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {r.aktion}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-400">{r.aktueller_zins}%</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-emerald-500 font-semibold">{r.empfohlener_zins}%</span>
                      <span className="text-muted-foreground">({r.empfohlene_bank})</span>
                    </div>
                    <div className="flex gap-3 text-muted-foreground">
                      <span>Ersparnis: <span className="text-emerald-500 font-medium">{formatEuro(r.monatliche_ersparnis)}/Monat</span></span>
                      <span>({formatEuro(r.jaehrliche_ersparnis)}/Jahr)</span>
                    </div>
                    <div className="mt-1 text-muted-foreground">{r.begruendung}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sondertilgung */}
          {result.sondertilgung_empfehlung && (
            <div className="text-xs p-2 rounded-lg bg-secondary/50">
              <span className="font-medium">Sondertilgung:</span> {result.sondertilgung_empfehlung}
            </div>
          )}

          {/* Markteinschätzung */}
          {result.markteinschaetzung && (
            <div className="text-xs p-2 rounded-lg bg-primary/5 border border-primary/10">
              <span className="font-medium">Zinsprognose:</span> {result.markteinschaetzung}
            </div>
          )}

          {result.quellen && result.quellen.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              Quellen: {result.quellen.join(", ")} {result.datum && `(Stand: ${result.datum})`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
