/**
 * Ertragswertverfahren — Immobilienbewertung nach Ertragswert
 * Ertragswert = Jahresnettomiete × Vervielfältiger (Restnutzungsdauer, Liegenschaftszinssatz)
 */
import { memo, useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_VERVIELF = 12; // typ. 10–15 für Wohnimmobilien
const DEFAULT_RESTNUTZUNG = 50;

const ErtragswertRechner = memo(() => {
  const { properties } = useProperties();
  const [vervielfaeltiger, setVervielfaeltiger] = useState(() => {
    try { return Number(localStorage.getItem("immo-ertragswert-vervielf")) || DEFAULT_VERVIELF; } catch { return DEFAULT_VERVIELF; }
  });
  const [restnutzung, setRestnutzung] = useState(DEFAULT_RESTNUTZUNG);

  const results = useMemo(() => {
    return properties
      .filter(p => p.monthlyRent > 0)
      .map(p => {
        const jahresBruttomiete = p.monthlyRent * 12;
        const nichtUmlagefaehig = (p.monthlyExpenses || 0) * 12 * 0.5;
        const jahresNettomiete = Math.max(0, jahresBruttomiete - nichtUmlagefaehig);
        const ertragswert = Math.round(jahresNettomiete * vervielfaeltiger);
        const purchasePrice = p.purchasePrice || 0;
        const diffPct = purchasePrice > 0 ? ((ertragswert - purchasePrice) / purchasePrice) * 100 : 0;
        return {
          id: p.id,
          name: p.name,
          jahresNettomiete,
          ertragswert,
          purchasePrice,
          diffPct,
          mietmultiplikator: jahresBruttomiete > 0 ? purchasePrice / jahresBruttomiete : 0,
        };
      });
  }, [properties, vervielfaeltiger]);

  const handleVervielfChange = (v: number) => {
    setVervielfaeltiger(v);
    try { localStorage.setItem("immo-ertragswert-vervielf", String(v)); } catch { /* ignore */ }
  };

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Ertragswertverfahren
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Ertragswert = Jahresnettomiete × Vervielfältiger. Der Vervielfältiger hängt von Restnutzungsdauer und Liegenschaftszins ab (typ. 10–15).
            </TooltipContent>
          </Tooltip>
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground">Vervielf.</label>
          <input
            type="number"
            min={5}
            max={25}
            step={0.5}
            value={vervielfaeltiger}
            onChange={e => handleVervielfChange(Number(e.target.value) || DEFAULT_VERVIELF)}
            className="w-14 h-7 text-xs text-center rounded border border-input bg-background"
          />
        </div>
      </div>
      <div className="space-y-2">
        {results.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/30">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{r.name}</p>
              <p className="text-[10px] text-muted-foreground">
                Nettomiete/J: {formatCurrency(r.jahresNettomiete)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-primary">{formatCurrency(r.ertragswert)}</p>
              {r.purchasePrice > 0 && (
                <p className={`text-[10px] ${r.diffPct >= 0 ? "text-profit" : "text-loss"}`}>
                  {r.diffPct >= 0 ? "+" : ""}{r.diffPct.toFixed(0)}% vs. Kaufpreis
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
ErtragswertRechner.displayName = "ErtragswertRechner";

export { ErtragswertRechner };
