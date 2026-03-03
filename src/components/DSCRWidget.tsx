/**
 * #8: DSCR (Debt Service Coverage Ratio) — Kapitaldienstfähigkeit pro Objekt
 */
import { useMemo } from "react";
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, safeDivide } from "@/lib/formatters";

export function DSCRWidget() {
  const { properties } = useProperties();

  const dscrData = useMemo(() => {
    return properties
      .filter(p => p.monthlyCreditRate > 0)
      .map(p => {
        const noi = p.monthlyRent - p.monthlyExpenses; // Net Operating Income
        const debtService = p.monthlyCreditRate;
        const dscr = safeDivide(noi, debtService, 0);
        let status: "good" | "ok" | "warning" | "critical";
        if (dscr >= 1.5) status = "good";
        else if (dscr >= 1.2) status = "ok";
        else if (dscr >= 1.0) status = "warning";
        else status = "critical";

        return {
          id: p.id,
          name: p.name,
          noi,
          debtService,
          dscr,
          status,
        };
      })
      .sort((a, b) => a.dscr - b.dscr);
  }, [properties]);

  if (dscrData.length === 0) return null;

  const avgDSCR = safeDivide(
    dscrData.reduce((s, d) => s + d.dscr, 0),
    dscrData.length,
    0
  );

  const statusColors: Record<string, string> = {
    good: "text-profit bg-profit/10 border-profit/20",
    ok: "text-primary bg-primary/10 border-primary/20",
    warning: "text-gold bg-gold/10 border-gold/20",
    critical: "text-loss bg-loss/10 border-loss/20",
  };

  const statusLabels: Record<string, string> = {
    good: "Sehr gut",
    ok: "Gut",
    warning: "Knapp",
    critical: "Kritisch",
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Kapitaldienstfähigkeit (DSCR)
        </h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${avgDSCR >= 1.2 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
          Ø {avgDSCR.toFixed(2)}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground mb-3">
        DSCR = Netto-Mieteinnahmen / Kapitaldienst. Ab 1,2 gilt als tragfähig, ab 1,5 als komfortabel.
      </p>

      <div className="space-y-2">
        {dscrData.slice(0, 6).map(d => (
          <div key={d.id} className={`p-2.5 rounded-lg border ${statusColors[d.status]}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {d.status === "critical" || d.status === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="text-xs font-medium truncate">{d.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold tabular-nums">{d.dscr.toFixed(2)}</span>
                <span className="text-[10px]">{statusLabels[d.status]}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-1 text-[10px] opacity-80 ml-5.5">
              <span>NOI: {formatCurrency(d.noi)}/M</span>
              <span>Kapitaldienst: {formatCurrency(d.debtService)}/M</span>
            </div>
          </div>
        ))}
      </div>

      {dscrData.length > 6 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          +{dscrData.length - 6} weitere Objekte
        </p>
      )}
    </div>
  );
}

export default DSCRWidget;
