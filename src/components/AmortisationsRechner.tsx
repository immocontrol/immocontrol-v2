/**
 * Amortisations-Rechner: Investition und jährlicher Überschuss → Jahre bis Amortisation.
 * Relevant für Sanierung, Kaufnebenkosten oder Objektbewertung.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export function AmortisationsRechner() {
  const [investment, setInvestment] = useState(50000);
  const [annualSurplus, setAnnualSurplus] = useState(6000);

  const years = useMemo(() => {
    if (investment <= 0 || annualSurplus <= 0) return null;
    const y = investment / annualSurplus;
    return y > 0 && y < 100 ? y : null;
  }, [investment, annualSurplus]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Amortisations-Rechner
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Einmalige Investition und jährlicher Überschuss (z. B. Mieteinnahmen minus Kosten) – Jahre bis die Investition sich rechnet.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Investition (€)</Label>
            <Input
              type="number"
              min={0}
              step={5000}
              value={investment}
              onChange={(e) => setInvestment(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Investition in Euro"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Jährlicher Überschuss (€)</Label>
            <Input
              type="number"
              min={0}
              step={500}
              value={annualSurplus}
              onChange={(e) => setAnnualSurplus(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Jährlicher Überschuss in Euro"
            />
          </div>
        </div>
        {years != null && (
          <div className="surface-section p-3 flex items-start gap-2">
            <TrendingUp className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Amortisation</p>
              <p className="text-primary font-semibold mt-0.5">
                ca. {years < 1 ? "< 1 Jahr" : years.toFixed(1)} Jahr{years >= 1 && years < 2 ? "" : "e"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(investment)} bei {formatCurrency(annualSurplus)}/Jahr Überschuss.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
