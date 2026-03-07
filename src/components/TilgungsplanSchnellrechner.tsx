/**
 * Tilgungsplan-Schnellrechner: Darlehenssumme, Zinssatz, Laufzeit → monatliche Rate.
 * Annuitätendarlehen (Monatsrate konstant, Zins- und Tilgungsanteil ändern sich).
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Landmark, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

function monthlyRate(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function TilgungsplanSchnellrechner() {
  const [principal, setPrincipal] = useState(300000);
  const [ratePct, setRatePct] = useState(3.5);
  const [years, setYears] = useState(25);

  const rate = useMemo(() => monthlyRate(principal, ratePct, years), [principal, ratePct, years]);
  const totalPayment = useMemo(() => rate * years * 12, [rate, years]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-4 w-4" /> Tilgungsplan-Schnellrechner
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Darlehenssumme, Zinssatz und Laufzeit → monatliche Annuitätenrate. Für erste Abschätzungen.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Darlehenssumme (€)</Label>
            <Input
              type="number"
              min={0}
              step={10000}
              value={principal}
              onChange={(e) => setPrincipal(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Darlehenssumme in Euro"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Zinssatz (% p.a.)</Label>
            <Input
              type="number"
              min={0}
              max={15}
              step={0.1}
              value={ratePct}
              onChange={(e) => setRatePct(Math.max(0, Math.min(15, Number(e.target.value) || 0)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Zinssatz in Prozent"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Laufzeit (Jahre)</Label>
            <Input
              type="number"
              min={1}
              max={35}
              value={years}
              onChange={(e) => setYears(Math.max(1, Math.min(35, Number(e.target.value) || 1)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Laufzeit in Jahren"
            />
          </div>
        </div>
        {principal > 0 && years > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-start gap-2">
            <TrendingDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Monatliche Rate</p>
              <p className="text-primary font-semibold mt-0.5">{formatCurrency(rate)}/Monat</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gesamtzahlung: {formatCurrency(totalPayment)} über {years} Jahre.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
