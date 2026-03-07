import { useState, useCallback } from "react";
import { Link2, Sparkles, Loader2, ExternalLink, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AnalysisInputState } from "@/hooks/useAnalysisCalculations";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { BUNDESLAENDER_GRUNDERWERBSTEUER } from "@/hooks/useAnalysisCalculations";
import { saveExposeHistoryEntry } from "./ExposeHistory";

interface Props {
  onImport: (updates: Partial<AnalysisInputState>) => void;
}

const SUPPORTED_HOSTS = [
  { name: "ImmoScout24", host: "immobilienscout24.de" },
  { name: "Immowelt", host: "immowelt.de" },
  { name: "Kleinanzeigen", host: "kleinanzeigen.de" },
  { name: "Immonet", host: "immonet.de" },
];

const ExposeImport = ({ onImport }: Props) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  /* FIX-46: Replace `Record<string, any>` with proper type */
  const [result, setResult] = useState<{
    data: Record<string, unknown>;
    imported: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = useCallback(async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-expose`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ url: url.trim() }),
        }
      );

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        const errMsg = data.error || "Fehler beim Extrahieren";
        setError(errMsg);
        handleError(new Error(errMsg), { context: "network", showToast: false });
        toastErrorWithRetry(errMsg, handleExtract);
        return;
      }

      setResult({ data: data.data, imported: false });
      saveExposeHistoryEntry({
        id: crypto.randomUUID(),
        data: data.data,
        source: "url",
        sourceLabel: url.trim(),
        importedAt: new Date().toISOString(),
      });
      toast.success("Exposé-Daten erfolgreich extrahiert!");
    /* FIX-45: Type catch variable as `unknown` for proper error handling */
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Netzwerkfehler";
      setError(msg);
      handleError(e, { context: "network", showToast: false });
      toastErrorWithRetry(msg, handleExtract);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleApply = useCallback(() => {
    if (!result?.data) return;

    const d = result.data;
    const updates: Partial<AnalysisInputState> = {};

    if (d.kaufpreis && d.kaufpreis > 0) updates.kaufpreis = d.kaufpreis;
    if (d.monatlicheMiete && d.monatlicheMiete > 0) updates.monatlicheMiete = d.monatlicheMiete;
    if (d.quadratmeter && d.quadratmeter > 0) updates.quadratmeter = d.quadratmeter;
    if (d.bewirtschaftungskosten && d.bewirtschaftungskosten > 0)
      updates.bewirtschaftungskosten = d.bewirtschaftungskosten;
    if (d.maklerProvision && d.maklerProvision > 0) updates.maklerProvision = d.maklerProvision;
    if (d.bundesland && BUNDESLAENDER_GRUNDERWERBSTEUER[d.bundesland]) {
      updates.bundesland = d.bundesland;
    }

    onImport(updates);
    setResult((prev) => (prev ? { ...prev, imported: true } : null));
    toast.success("Daten in Analyse übernommen!");
  }, [result, onImport]);

  /* FIX-47: Replace `any` parameter with `unknown` */
  const formatValue = (key: string, value: unknown): string => {
    if (value == null) return "–";
    if (typeof value === "number") {
      if (key.includes("Provision") || key.includes("provision")) return `${value}%`;
      if (key === "kaufpreis" || key === "bewirtschaftungskosten" || key === "monatlicheMiete")
        return `${value.toLocaleString("de-DE")} €`;
      if (key === "quadratmeter") return `${value} m²`;
      return String(value);
    }
    return String(value);
  };

  const fieldLabels: Record<string, string> = {
    kaufpreis: "Kaufpreis",
    monatlicheMiete: "Monatliche Miete",
    quadratmeter: "Wohnfläche",
    bundesland: "Bundesland",
    maklerProvision: "Maklerprovision",
    bewirtschaftungskosten: "Bewirtschaftungskosten",
    titel: "Titel",
    adresse: "Adresse",
    zimmer: "Zimmer",
    baujahr: "Baujahr",
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        Exposé-Import (AI)
      </h2>

      <p className="text-xs text-muted-foreground">
        Füge einen Link von ImmoScout24, Immowelt, Kleinanzeigen oder Immonet ein – die KI
        extrahiert automatisch die Objektdaten.
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
              setResult(null);
            }}
            placeholder="https://www.immobilienscout24.de/expose/..."
            className="w-full bg-secondary text-foreground text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            disabled={loading}
          />
        </div>
        <Button
          size="sm"
          onClick={handleExtract}
          disabled={loading || !url.trim()}
          className="gap-1.5 shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysiere…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> Extrahieren
            </>
          )}
        </Button>
      </div>

      {/* Supported platforms */}
      <div className="flex gap-1.5 flex-wrap">
        {SUPPORTED_HOSTS.map((h) => (
          <span
            key={h.host}
            className="text-[10px] bg-secondary px-2 py-0.5 rounded-md text-muted-foreground"
          >
            {h.name}
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-loss bg-loss/10 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            {result.data.titel && (
              <div className="text-sm font-medium">{result.data.titel}</div>
            )}
            {result.data.adresse && (
              <div className="text-xs text-muted-foreground">{result.data.adresse}</div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2">
              {Object.entries(result.data)
                .filter(([k]) => k !== "titel" && k !== "adresse")
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{fieldLabels[key] || key}</span>
                    <span className="font-medium">{formatValue(key, value)}</span>
                  </div>
                ))}
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleApply}
            disabled={result.imported}
            className="w-full gap-1.5"
            variant={result.imported ? "outline" : "default"}
          >
            {result.imported ? (
              <>
                <Check className="h-3.5 w-3.5" /> Übernommen
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" /> In Analyse übernehmen
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ExposeImport;
