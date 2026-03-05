/**
 * MANUS-5: Due Diligence Automatisierung
 * Researches property details via Manus AI and generates a report
 */
import { useState } from "react";
import { Bot, Search, Loader2, RefreshCw, MapPin, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { hasManusApiKey, runTask, buildDueDiligencePrompt, parseManusJson, cacheResult, getCachedResult } from "@/lib/manusAgent";
import { ManusTaskStatusIndicator } from "./ManusTaskStatus";
import type { ManusTaskStatus } from "@/lib/manusAgent";

interface Risiko {
  kategorie: string;
  schwere: "niedrig" | "mittel" | "hoch";
  beschreibung: string;
}

interface DueDiligenceResult {
  adresse?: string;
  gesamtbewertung?: string;
  score?: number;
  lage?: { mikro: string; makro: string; oepnv: string; infrastruktur: string };
  bebauungsplan?: { nutzungsart: string; grz: number; gfz: number; potential: string };
  altlasten?: { status: string; details: string };
  denkmalschutz?: { status: string; details: string };
  hochwasser?: { risiko: string; zone: string };
  bodenrichtwert?: number;
  mietspiegel?: { min: number; avg: number; max: number };
  marktvergleich?: { preis_qm_min: number; preis_qm_avg: number; preis_qm_max: number };
  risiken?: Risiko[];
  chancen?: string[];
  empfehlung?: string;
  quellen?: string[];
}

interface ManusDueDiligenceProps {
  defaultAddress?: string;
  defaultPlz?: string;
  defaultOrt?: string;
  kaufpreis?: number;
  immobilientyp?: string;
  onResult?: (result: DueDiligenceResult) => void;
}

const SCHWERE_COLORS = {
  niedrig: "bg-blue-500/10 text-blue-500",
  mittel: "bg-amber-500/10 text-amber-500",
  hoch: "bg-red-500/10 text-red-500",
};

export const ManusDueDiligence = ({ defaultAddress, defaultPlz, defaultOrt, kaufpreis, immobilientyp, onResult }: ManusDueDiligenceProps) => {
  const [address, setAddress] = useState(defaultAddress || "");
  const [plz, setPlz] = useState(defaultPlz || "");
  const [ort, setOrt] = useState(defaultOrt || "");
  const [status, setStatus] = useState<ManusTaskStatus | "idle" | "submitting">("idle");
  const [result, setResult] = useState<DueDiligenceResult | null>(() => {
    if (defaultAddress) return getCachedResult<DueDiligenceResult>(`dd_${defaultAddress}`);
    return null;
  });
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hasManusApiKey()) {
      toast.error("Manus API Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.");
      return;
    }
    if (!address.trim()) {
      toast.error("Bitte eine Adresse eingeben");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const prompt = buildDueDiligencePrompt({
        address: address.trim(),
        plz: plz.trim(),
        ort: ort.trim(),
        kaufpreis,
        immobilientyp,
      });
      const taskResult = await runTask(
        { prompt, taskMode: "agent", agentProfile: "quality" },
        (task) => setStatus(task.status),
      );

      const parsed = parseManusJson<DueDiligenceResult>(taskResult.task.output || "");
      if (parsed) {
        setResult(parsed);
        cacheResult(`dd_${address}`, parsed);
        onResult?.(parsed);
        toast.success("Due Diligence Report erstellt!");
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
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold">Manus AI: Due Diligence</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 sm:col-span-1 space-y-1">
          <Label className="text-xs">Adresse *</Label>
          <div className="relative">
            <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Musterstraße 1" className="h-8 text-xs pl-7" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">PLZ</Label>
          <Input value={plz} onChange={(e) => setPlz(e.target.value)} placeholder="10115" className="h-8 text-xs" maxLength={5} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ort</Label>
          <Input value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="Berlin" className="h-8 text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleRun}
          disabled={status === "submitting" || status === "running" || status === "pending" || !address.trim()}
          className="gap-1.5"
        >
          {status === "running" || status === "submitting" || status === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Due Diligence starten
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
        <div className="space-y-4 animate-fade-in">
          {/* Score + Overall */}
          {result.score !== undefined && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className={`text-2xl font-bold ${(result.score || 0) >= 70 ? "text-emerald-500" : (result.score || 0) >= 40 ? "text-amber-500" : "text-red-500"}`}>
                {result.score}/100
              </div>
              <div>
                <div className="text-sm font-medium">{result.gesamtbewertung || "–"}</div>
                <div className="text-xs text-muted-foreground">{result.adresse}</div>
              </div>
            </div>
          )}

          {/* Key Checks */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {result.altlasten && (
              <div className="p-2 rounded-lg bg-secondary/50 space-y-0.5">
                <div className="font-medium flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Altlasten
                </div>
                <div className={result.altlasten.status.toLowerCase().includes("keine") ? "text-emerald-500" : "text-amber-500"}>
                  {result.altlasten.status}
                </div>
              </div>
            )}
            {result.denkmalschutz && (
              <div className="p-2 rounded-lg bg-secondary/50 space-y-0.5">
                <div className="font-medium">Denkmalschutz</div>
                <div>{result.denkmalschutz.status}</div>
              </div>
            )}
            {result.hochwasser && (
              <div className="p-2 rounded-lg bg-secondary/50 space-y-0.5">
                <div className="font-medium">Hochwasser</div>
                <div className={result.hochwasser.risiko.toLowerCase().includes("kein") ? "text-emerald-500" : "text-amber-500"}>
                  {result.hochwasser.risiko}
                </div>
              </div>
            )}
            {result.bodenrichtwert !== undefined && (
              <div className="p-2 rounded-lg bg-secondary/50 space-y-0.5">
                <div className="font-medium">Bodenrichtwert</div>
                <div className="font-semibold">{formatEuro(result.bodenrichtwert)}/m²</div>
              </div>
            )}
            {result.bebauungsplan && (
              <div className="p-2 rounded-lg bg-secondary/50 space-y-0.5">
                <div className="font-medium">B-Plan</div>
                <div>{result.bebauungsplan.nutzungsart}</div>
                {result.bebauungsplan.potential && (
                  <div className="text-[10px] text-muted-foreground">{result.bebauungsplan.potential}</div>
                )}
              </div>
            )}
            {result.mietspiegel && (
              <div className="p-2 rounded-lg bg-secondary/50 space-y-0.5">
                <div className="font-medium">Mietspiegel</div>
                <div>{formatEuro(result.mietspiegel.avg)}/m²</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatEuro(result.mietspiegel.min)} – {formatEuro(result.mietspiegel.max)}
                </div>
              </div>
            )}
          </div>

          {/* Risiken */}
          {result.risiken && result.risiken.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" /> Risiken
              </h4>
              {result.risiken.map((r, i) => (
                <div key={i} className={`text-xs p-2 rounded-lg ${SCHWERE_COLORS[r.schwere] || SCHWERE_COLORS.niedrig}`}>
                  <span className="font-medium">{r.kategorie}:</span> {r.beschreibung}
                </div>
              ))}
            </div>
          )}

          {/* Chancen */}
          {result.chancen && result.chancen.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Chancen
              </h4>
              <ul className="text-xs space-y-0.5 text-muted-foreground">
                {result.chancen.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">+</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empfehlung */}
          {result.empfehlung && (
            <div className="text-xs p-2 rounded-lg bg-primary/5 border border-primary/10">
              <span className="font-medium">Empfehlung:</span> {result.empfehlung}
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
