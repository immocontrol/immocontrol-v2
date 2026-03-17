/**
 * MANUS-2: Deep Research / Marktanalyse
 * Triggers Manus to research current market data for a given location
 */
import { useState } from "react";
import { Bot, TrendingUp, Loader2, RefreshCw, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { hasManusApiKey, runTask, buildMarktanalysePrompt, parseManusJson, cacheResult, getCachedResult } from "@/lib/manusAgent";
import { ManusTaskStatusIndicator } from "./ManusTaskStatus";
import type { ManusTaskStatus } from "@/lib/manusAgent";

interface MarktanalyseResult {
  location?: string;
  datum?: string;
  mietpreis_qm?: { min: number; avg: number; max: number };
  kaufpreis_qm?: { min: number; avg: number; max: number };
  mietrendite_avg?: number;
  preistrend_12m?: string;
  leerstandsquote?: number;
  neubauprojekte?: string[];
  infrastruktur?: string[];
  prognose?: string;
  quellen?: string[];
}

interface ManusMarktanalyseProps {
  defaultCity?: string;
  defaultDistrict?: string;
  onResult?: (result: MarktanalyseResult) => void;
}

export const ManusMarktanalyse = ({ defaultCity, defaultDistrict, onResult }: ManusMarktanalyseProps) => {
  const [city, setCity] = useState(defaultCity || "");
  const [district, setDistrict] = useState(defaultDistrict || "");
  const [propertyType, setPropertyType] = useState("Wohnimmobilien");
  const [rooms, setRooms] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<ManusTaskStatus | "idle" | "submitting">("idle");
  const [result, setResult] = useState<MarktanalyseResult | null>(() => {
    if (defaultCity) {
      return getCachedResult<MarktanalyseResult>(`markt_${defaultCity}_${defaultDistrict || ""}`);
    }
    return null;
  });
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hasManusApiKey()) {
      toast.error("Manus API Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.");
      return;
    }
    if (!city.trim()) {
      toast.error("Bitte eine Stadt eingeben");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const prompt = buildMarktanalysePrompt({
        city: city.trim(),
        district: district.trim() || undefined,
        propertyType,
        rooms,
      });

      const taskResult = await runTask(
        { prompt, taskMode: "agent", agentProfile: "quality" },
        (task) => setStatus(task.status),
      );

      const parsed = parseManusJson<MarktanalyseResult>(taskResult.task.output || "");
      if (parsed) {
        setResult(parsed);
        cacheResult(`markt_${city}_${district}`, parsed);
        onResult?.(parsed);
        toast.success("Marktanalyse abgeschlossen!");
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

  const formatEuro = (n?: number) => n != null ? formatCurrency(n) : "–";

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold">Manus AI: Deep Research / Marktanalyse</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Stadt *</Label>
          <div className="relative">
            <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="z.B. Berlin"
              className="h-8 text-xs pl-7"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stadtteil / Bezirk</Label>
          <Input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="z.B. Prenzlauer Berg"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Objektart</Label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Wohnimmobilien">Wohnimmobilien</SelectItem>
              <SelectItem value="Eigentumswohnungen">Eigentumswohnungen</SelectItem>
              <SelectItem value="Einfamilienhäuser">Einfamilienhäuser</SelectItem>
              <SelectItem value="Mehrfamilienhäuser">Mehrfamilienhäuser</SelectItem>
              <SelectItem value="Gewerbeimmobilien">Gewerbeimmobilien</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Zimmer (optional)</Label>
          <Input
            type="number"
            value={rooms ?? ""}
            onChange={(e) => setRooms(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="z.B. 3"
            className="h-8 text-xs"
            min={1}
            max={10}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleRun}
          disabled={status === "submitting" || status === "running" || status === "pending" || !city.trim()}
          className="gap-1.5"
        >
          {status === "running" || status === "submitting" || status === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Marktanalyse starten
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
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
            <TrendingUp className="h-3.5 w-3.5" />
            Marktdaten: {result.location || city}
            {result.datum && <span className="text-muted-foreground font-normal">(Stand: {result.datum})</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {result.mietpreis_qm && (
              <div className="p-2 rounded-lg bg-blue-500/10">
                <div className="text-[10px] text-muted-foreground">Mietpreis/m²</div>
                <div className="text-sm font-semibold">{formatEuro(result.mietpreis_qm.avg)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatEuro(result.mietpreis_qm.min)} – {formatEuro(result.mietpreis_qm.max)}
                </div>
              </div>
            )}
            {result.kaufpreis_qm && (
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <div className="text-[10px] text-muted-foreground">Kaufpreis/m²</div>
                <div className="text-sm font-semibold">{formatEuro(result.kaufpreis_qm.avg)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatEuro(result.kaufpreis_qm.min)} – {formatEuro(result.kaufpreis_qm.max)}
                </div>
              </div>
            )}
            {result.mietrendite_avg !== undefined && (
              <div className="p-2 rounded-lg bg-amber-500/10">
                <div className="text-[10px] text-muted-foreground">Mietrendite</div>
                <div className="text-sm font-semibold">{result.mietrendite_avg.toFixed(1)}%</div>
              </div>
            )}
            {result.preistrend_12m && (
              <div className="p-2 rounded-lg bg-violet-500/10">
                <div className="text-[10px] text-muted-foreground">12M Trend</div>
                <div className="text-sm font-semibold">{result.preistrend_12m}</div>
              </div>
            )}
          </div>

          {result.prognose && (
            <div className="text-xs text-muted-foreground p-2 rounded-lg bg-secondary/50">
              <span className="font-medium">Prognose:</span> {result.prognose}
            </div>
          )}

          {result.neubauprojekte && result.neubauprojekte.length > 0 && (
            <div className="text-xs">
              <span className="font-medium">Neubauprojekte:</span>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {result.neubauprojekte.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">•</span> {p}
                  </li>
                ))}
              </ul>
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
