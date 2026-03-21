/**
 * Zinseszins-Rechner: Kapital, Zinssatz, Laufzeit → Endkapital.
 * Relevant für Kapitalanleger, Rücklagenplanung und Sparziele.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calculator, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export function ZinseszinsRechner() {
  const [capital, setCapital] = useState(100000);
  const [ratePct, setRatePct] = useState(3);
  const [years, setYears] = useState(10);

  const endCapital = useMemo(() => {
    if (capital <= 0 || years < 0) return 0;
    const r = ratePct / 100;
    return capital * Math.pow(1 + r, years);
  }, [capital, ratePct, years]);

  const gain = useMemo(() => endCapital - capital, [endCapital, capital]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Zinseszins-Rechner
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Kapital mit Zinseszins über Laufzeit – für Rücklagen, Sparziele oder Anlageplanung.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Startkapital (€)</Label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={capital}
              onChange={(e) => setCapital(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Startkapital in Euro"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Zinssatz (% p.a.)</Label>
            <Input
              type="number"
              min={0}
              max={20}
              step={0.25}
              value={ratePct}
              onChange={(e) => setRatePct(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Zinssatz in Prozent"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Laufzeit (Jahre)</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={years}
              onChange={(e) => setYears(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Laufzeit in Jahren"
            />
          </div>
        </div>
        {capital > 0 && years > 0 && (
          <div className="surface-section p-3 flex items-start gap-2">
            <Calculator className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Endkapital</p>
              <p className="text-primary font-semibold mt-0.5">{formatCurrency(endCapital)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Zinsertrag: {formatCurrency(gain)} bei {ratePct} % p.a. über {years} Jahre.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
