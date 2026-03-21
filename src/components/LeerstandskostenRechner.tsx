/**
 * Leerstands-Kosten-Rechner: Zeigt entgangene Miete bei Leerstand.
 * Eingabe: Tage Leerstand, Monatsmiete (Kaltmiete). Ausgabe: entgangene Miete.
 * Relevant für Immobilieninvestoren zur Planung und Kennzahl.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Home, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export function LeerstandskostenRechner() {
  const [daysVacant, setDaysVacant] = useState(30);
  const [monthlyRent, setMonthlyRent] = useState(800);

  const lostRent = useMemo(() => {
    if (daysVacant <= 0 || monthlyRent <= 0) return 0;
    return (monthlyRent / 30) * Math.min(daysVacant, 365);
  }, [daysVacant, monthlyRent]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Leerstands-Kosten
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Entgangene Miete bei Leerstand – für Kennzahlen und Planung.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Tage Leerstand</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={daysVacant}
              onChange={(e) => setDaysVacant(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Tage Leerstand"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Monatsmiete (€)</Label>
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
        </div>
        {lostRent > 0 && (
          <div className="surface-section p-3 flex items-start gap-2">
            <Home className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Entgangene Miete</p>
              <p className="text-primary font-semibold mt-0.5">{formatCurrency(lostRent)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {daysVacant} Tag{daysVacant !== 1 ? "e" : ""} × {formatCurrency(monthlyRent / 30)}/Tag (bei {formatCurrency(monthlyRent)}/Monat).
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
