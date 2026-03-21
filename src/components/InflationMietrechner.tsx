/**
 * Inflation-Mietrechner: Miete in X Jahren bei angenommener Inflation.
 * Relevant für Investoren (Renditeplanung, Indexmiete-Abschätzung).
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TrendingUp, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const DEFAULT_YEARS = 5;
const DEFAULT_INFLATION = 2;

export function InflationMietrechner() {
  const [monthlyRent, setMonthlyRent] = useState(1000);
  const [years, setYears] = useState(DEFAULT_YEARS);
  const [inflationPct, setInflationPct] = useState(DEFAULT_INFLATION);

  const futureRent = useMemo(() => {
    if (monthlyRent <= 0) return 0;
    const factor = Math.pow(1 + inflationPct / 100, years);
    return monthlyRent * factor;
  }, [monthlyRent, years, inflationPct]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Miete in X Jahren (Inflation)
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Schätzung der Monatsmiete nach {years} Jahren bei {inflationPct} % p.a. Inflation – für Planung und Indexmiete.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Aktuelle Monatsmiete (€)</Label>
            <Input
              type="number"
              min={0}
              step={50}
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Monatsmiete in Euro"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Jahre</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={years}
              onChange={(e) => setYears(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Anzahl Jahre"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Inflation (% p.a.)</Label>
            <Input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={inflationPct}
              onChange={(e) => setInflationPct(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Inflation in Prozent pro Jahr"
            />
          </div>
        </div>
        {futureRent > 0 && (
          <div className="surface-section p-3 flex items-start gap-2">
            <Calculator className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Miete in {years} Jahr{years !== 1 ? "en" : ""}</p>
              <p className="text-primary font-semibold mt-0.5">{formatCurrency(futureRent)}/Monat</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ausgehend von {formatCurrency(monthlyRent)}/Monat bei {inflationPct} % p.a.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
