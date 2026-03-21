/**
 * Kaufpreisfaktor-Rechner: Jahresmiete × Faktor = maximaler Kaufpreis.
 * Typischer Faktor: 12–25 (Bestandsimmobilien). Für Investoren zur Preisbewertung.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Calculator, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const MIN_FACTOR = 8;
const MAX_FACTOR = 35;
const DEFAULT_FACTOR = 18;

export function KaufpreisfaktorRechner() {
  const [annualRent, setAnnualRent] = useState(18000);
  const [factor, setFactor] = useState(DEFAULT_FACTOR);

  const maxPurchasePrice = useMemo(() => {
    if (annualRent <= 0 || factor < MIN_FACTOR) return 0;
    return Math.round(annualRent * factor);
  }, [annualRent, factor]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Kaufpreisfaktor-Rechner
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Jahreskaltmiete × Faktor = maximaler Kaufpreis. Typisch: 12–25 für Bestandsimmobilien; 8–12 für Sanierungsprojekte.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Jahreskaltmiete (€)</Label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={annualRent}
              onChange={(e) => setAnnualRent(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Jahreskaltmiete in Euro"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Kaufpreisfaktor ({factor}×)</Label>
            <div className="flex items-center gap-3 pt-2">
              <Slider
                value={[factor]}
                min={MIN_FACTOR}
                max={MAX_FACTOR}
                step={0.5}
                onValueChange={([v]) => setFactor(v)}
                className="flex-1 touch-target min-h-[44px] sm:min-h-[36px]"
                aria-label="Kaufpreisfaktor"
              />
              <span className="text-sm font-medium w-10 shrink-0">{factor}×</span>
            </div>
          </div>
        </div>
        {annualRent > 0 && factor >= MIN_FACTOR && (
          <div className="surface-section p-3 flex items-start gap-2">
            <Calculator className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Max. Kaufpreis</p>
              <p className="text-primary font-semibold mt-0.5">{formatCurrency(maxPurchasePrice)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Bei {formatCurrency(annualRent)}/Jahr und Faktor {factor}× entspricht das diesem rechnerischen Höchstpreis.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
