/**
 * Mietspiegel- und Markt-Check — Ist-Miete vs. Mietspiegel,
 * Marktgerechtigkeit, Umsetzungspotenzial bei Mieterhöhung.
 */
import { useMemo, useState } from "react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { Info, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { isDeepSeekConfigured, suggestMietspiegelInterpretation } from "@/integrations/ai/extractors";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface MietspiegelCheckProps {
  /** Manuell gepflegte Mietspiegel pro Objekt (EUR/m² kalt), oder globaler Durchschnitt */
  mietspiegelPerSqm?: Record<string, number>;
  /** Globaler Mietspiegel EUR/m² falls kein Objekt-spezifischer Wert */
  defaultMietspiegelPerSqm?: number;
}

export function MietspiegelCheck({
  mietspiegelPerSqm = {},
  defaultMietspiegelPerSqm = 12,
}: MietspiegelCheckProps) {
  const { properties } = useProperties();
  const [overridePerSqm, setOverridePerSqm] = useState<Record<string, number>>({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);

  const analysis = useMemo(() => {
    if (properties.length === 0) return [];
    return properties.map((p) => {
      const sqm = p.sqm || 1;
      const coldRentPerSqm = (p.monthlyRent || 0) / sqm;
      const spiegel = overridePerSqm[p.id] ?? mietspiegelPerSqm[p.id] ?? defaultMietspiegelPerSqm;
      const diffPercent = spiegel > 0 ? ((coldRentPerSqm - spiegel) / spiegel) * 100 : 0;
      const potentialMonthly = Math.max(0, (spiegel - coldRentPerSqm) * sqm);
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        coldRent: p.monthlyRent,
        sqm,
        coldRentPerSqm,
        spiegel,
        diffPercent,
        potentialMonthly,
        status: diffPercent < -10 ? "unter" : diffPercent > 10 ? "über" : "marktgerecht",
      };
    });
  }, [properties, mietspiegelPerSqm, defaultMietspiegelPerSqm, overridePerSqm]);

  if (properties.length === 0) return null;

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        Mietspiegel-Check
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Vergleicht deine Ist-Miete (kalt/m²) mit dem Mietspiegel. Werte aus Mietspiegel-Datenbank
                oder manuell hinterlegen. §558 BGB Mieterhöhung prüfen.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h3>

      <div className="space-y-3">
        {analysis.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-secondary/30"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" title={a.name}>
                {a.name}
              </p>
              <p className="text-xs text-muted-foreground truncate" title={a.address}>
                {a.address}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span>
                {formatCurrency(a.coldRentPerSqm)}/m²
                <span className="text-muted-foreground ml-1">vs. ~{formatCurrency(a.spiegel)}/m²</span>
              </span>
              <span
                className={
                  a.status === "unter"
                    ? "text-amber-600"
                    : a.status === "über"
                      ? "text-blue-600"
                      : "text-profit"
                }
              >
                {a.status === "unter" && "unter Markt"}
                {a.status === "über" && "über Markt"}
                {a.status === "marktgerecht" && "marktgerecht"}
              </span>
              {a.potentialMonthly > 50 && (
                <span className="text-profit">+{formatCurrency(a.potentialMonthly)}/M Potenzial</span>
              )}
              {isDeepSeekConfigured() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 gap-1 text-xs"
                  disabled={aiLoadingId === a.id}
                  onClick={async () => {
                    setAiLoadingId(a.id);
                    try {
                      const text = await suggestMietspiegelInterpretation({
                        propertyName: a.name,
                        currentRentPerSqm: a.coldRentPerSqm,
                        mietspiegelPerSqm: a.spiegel,
                        status: a.status,
                        potentialMonthly: a.potentialMonthly > 50 ? a.potentialMonthly : undefined,
                      });
                      if (text) toast.info(text, { duration: 6000 });
                    } catch (e) {
                      handleError(e, { context: "ai", details: "mietspiegel", showToast: true });
                    } finally {
                      setAiLoadingId(null);
                    }
                  }}
                  aria-label="KI-Einschätzung zu Mietspiegel"
                >
                  {aiLoadingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  KI
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
