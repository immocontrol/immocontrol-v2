/**
 * INHALT-10: Mietpreisspiegel-Integration — Automatischer Mietpreis-Check
 * Für jede Wohnung prüfen: Liegt die Miete unter/über dem Mietspiegel?
 * Mieterhöhungspotenzial berechnen nach §558 BGB mit Kappungsgrenze.
 */
import { memo, useMemo, useState } from "react";
import { BarChart3, TrendingUp, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { isAngespanntMarkt, getKappungsgrenzePercent } from "@/lib/mietrechtConstants";

// Simplified Mietspiegel data (real app would fetch from API/DB)
const MIETSPIEGEL_RANGES: Record<string, { min: number; mid: number; max: number }> = {
  "Berlin": { min: 7.5, mid: 10.5, max: 14.0 },
  "München": { min: 12.0, mid: 18.0, max: 24.0 },
  "Hamburg": { min: 9.0, mid: 13.0, max: 17.0 },
  "Frankfurt": { min: 10.0, mid: 15.0, max: 20.0 },
  "Köln": { min: 8.5, mid: 12.0, max: 16.0 },
  "Stuttgart": { min: 9.5, mid: 13.5, max: 18.0 },
  "Düsseldorf": { min: 9.0, mid: 12.5, max: 16.5 },
  "Leipzig": { min: 6.0, mid: 8.0, max: 11.0 },
  "Dresden": { min: 6.5, mid: 8.5, max: 11.5 },
  "Potsdam": { min: 7.5, mid: 10.0, max: 13.5 },
  "default": { min: 6.0, mid: 9.0, max: 13.0 },
};

interface RentCheck {
  propertyId: string;
  name: string;
  location: string;
  currentRentPerSqm: number;
  mietspiegelMin: number;
  mietspiegelMid: number;
  mietspiegelMax: number;
  position: "unter" | "mittel" | "ueber";
  potentialMonthly: number;
  potentialPercent: number;
  kappungsgrenzeOk: boolean;
  maxIncrease558: number;
}

const MietpreisCheck = memo(() => {
  const { properties } = useProperties();
  const [expanded, setExpanded] = useState(false);

  const checks = useMemo((): RentCheck[] => {
    return properties.map((p) => {
      const sqm = p.sqm || 1;
      const currentRentPerSqm = p.monthlyRent / sqm;

      // Find matching Mietspiegel (p.location can be null/undefined)
      const locationStr = p.location ?? "";
      const locationKey = Object.keys(MIETSPIEGEL_RANGES).find((k) =>
        locationStr.toLowerCase().includes(k.toLowerCase())
      ) || "default";
      const range = MIETSPIEGEL_RANGES[locationKey];

      const position: RentCheck["position"] =
        currentRentPerSqm < range.min ? "unter" :
        currentRentPerSqm > range.max ? "ueber" : "mittel";

      // Potential: difference to Mietspiegel midpoint
      const potentialPerSqm = Math.max(0, range.mid - currentRentPerSqm);
      const potentialMonthly = potentialPerSqm * sqm;
      const potentialPercent = currentRentPerSqm > 0 ? (potentialPerSqm / currentRentPerSqm) * 100 : 0;

      // Kappungsgrenze §558: 15% oder 20% in 3 Jahren je nach Standort
      const kappungPct = getKappungsgrenzePercent(isAngespanntMarkt(p.location || ""));
      const maxIncrease558 = p.monthlyRent * (kappungPct / 100);
      const kappungsgrenzeOk = potentialMonthly <= maxIncrease558;

      return {
        propertyId: p.id, name: p.name, location: p.location,
        currentRentPerSqm, mietspiegelMin: range.min, mietspiegelMid: range.mid, mietspiegelMax: range.max,
        position, potentialMonthly, potentialPercent, kappungsgrenzeOk,
        maxIncrease558: Math.min(potentialMonthly, maxIncrease558),
      };
    }).sort((a, b) => b.potentialMonthly - a.potentialMonthly);
  }, [properties]);

  if (properties.length === 0) return null;

  const totalPotential = checks.reduce((s, c) => s + c.maxIncrease558, 0);
  const underpriced = checks.filter((c) => c.position === "unter").length;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Mietpreis-Check</h3>
          {underpriced > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 text-profit">
              {underpriced} unter Spiegel
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Potential highlight */}
      {totalPotential > 0 && (
        <div className="text-center p-2 rounded-lg bg-profit/5 border border-profit/20 mb-3">
          <p className="text-[10px] text-muted-foreground">Mieterhöhungspotenzial (§558 BGB)</p>
          <p className="text-lg font-bold text-profit">+{formatCurrency(totalPotential)}/Monat</p>
          <p className="text-[10px] text-muted-foreground">= +{formatCurrency(totalPotential * 12)}/Jahr</p>
        </div>
      )}

      {/* Per-property check */}
      <div className="space-y-1.5">
        {checks.slice(0, expanded ? undefined : 3).map((c) => (
          <div key={c.propertyId} className="p-2 rounded-lg bg-background/50 border border-border/50 text-[10px]">
            <div className="flex justify-between items-start mb-1">
              <div>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground ml-1">{c.location}</span>
              </div>
              <div className="flex items-center gap-1">
                {c.position === "unter" ? (
                  <><ArrowUp className="h-3 w-3 text-profit" /><span className="text-profit">Potenzial</span></>
                ) : c.position === "ueber" ? (
                  <><ArrowDown className="h-3 w-3 text-loss" /><span className="text-loss">Über Spiegel</span></>
                ) : (
                  <><Minus className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">Marktgerecht</span></>
                )}
              </div>
            </div>

            {/* Rent bar visualization */}
            <div className="relative h-3 rounded-full bg-muted overflow-hidden mb-1">
              <div className="absolute inset-y-0 bg-profit/20 rounded-full" style={{
                left: `${(c.mietspiegelMin / (c.mietspiegelMax * 1.2)) * 100}%`,
                width: `${((c.mietspiegelMax - c.mietspiegelMin) / (c.mietspiegelMax * 1.2)) * 100}%`,
              }} />
              <div className="absolute inset-y-0 w-1 bg-primary rounded-full" style={{
                left: `${Math.min(100, (c.currentRentPerSqm / (c.mietspiegelMax * 1.2)) * 100)}%`,
              }} />
            </div>

            <div className="grid grid-cols-4 gap-1">
              <div>
                <span className="text-muted-foreground">Ist/m²</span>
                <p className="font-medium">{c.currentRentPerSqm.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground">Spiegel</span>
                <p className="font-medium">{c.mietspiegelMid.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground">Potenzial</span>
                <p className="font-medium text-profit">+{formatCurrency(c.maxIncrease558)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">§558</span>
                <p className={`font-medium ${c.kappungsgrenzeOk ? "text-profit" : "text-gold"}`}>
                  {c.kappungsgrenzeOk ? "OK" : "Kappung"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
MietpreisCheck.displayName = "MietpreisCheck";

export { MietpreisCheck };
