/**
 * AfA-Schnellrechner (Absetzung für Abnutzung): Jährliche Abschreibung für Immobilien.
 * Gebäudeanteil wird linear über Nutzungsdauer abgeschrieben. Relevant für Steuerplanung (Anlage V).
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calculator, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export function AfASchnellrechner() {
  const [purchasePrice, setPurchasePrice] = useState(300000);
  const [buildingSharePct, setBuildingSharePct] = useState(80);
  const [usefulLife, setUsefulLife] = useState(50);

  const annualAfA = useMemo(() => {
    if (purchasePrice <= 0 || buildingSharePct <= 0 || buildingSharePct > 100 || usefulLife < 1) return 0;
    const buildingValue = (purchasePrice * buildingSharePct) / 100;
    return buildingValue / usefulLife;
  }, [purchasePrice, buildingSharePct, usefulLife]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" /> AfA-Schnellrechner
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Jährliche Abschreibung (AfA) für Immobilien – Gebäudeanteil linear über Nutzungsdauer. Typisch: 50 Jahre Wohnimmobilie, 70–80 % Gebäudeanteil.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Kaufpreis (€)</Label>
            <Input
              type="number"
              min={0}
              step={10000}
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Kaufpreis in Euro"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Gebäudeanteil (%)</Label>
            <Input
              type="number"
              min={50}
              max={100}
              value={buildingSharePct}
              onChange={(e) => setBuildingSharePct(Math.max(50, Math.min(100, Number(e.target.value) || 70)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Gebäudeanteil in Prozent"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Nutzungsdauer (Jahre)</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={usefulLife}
              onChange={(e) => setUsefulLife(Math.max(1, Math.min(50, Number(e.target.value) || 50)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Nutzungsdauer in Jahren"
            />
          </div>
        </div>
        {annualAfA > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-start gap-2">
            <Calculator className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Jährliche AfA</p>
              <p className="text-primary font-semibold mt-0.5">{formatCurrency(annualAfA)}/Jahr</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gebäudewert {formatCurrency((purchasePrice * buildingSharePct) / 100)} über {usefulLife} Jahre.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
