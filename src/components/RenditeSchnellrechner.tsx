/**
 * Rendite-Schnellrechner: Kaufpreis + Monatsmiete → Brutto-Mietrendite % und Mietmultiplikator.
 * Für schnelle Kennzahlen-Checks ohne vollständige Objektanalyse. Relevant für Immobilieninvestoren.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Percent, Hash } from "lucide-react";

export function RenditeSchnellrechner() {
  const [purchasePrice, setPurchasePrice] = useState(300000);
  const [monthlyRent, setMonthlyRent] = useState(1500);

  const { bruttoRendite, mietmultiplikator } = useMemo(() => {
    const price = purchasePrice > 0 ? purchasePrice : 0;
    const rent = monthlyRent > 0 ? monthlyRent : 0;
    const annualRent = rent * 12;
    const rendite = price > 0 && annualRent > 0 ? (annualRent / price) * 100 : 0;
    const multi = annualRent > 0 ? price / annualRent : 0;
    return { bruttoRendite: rendite, mietmultiplikator: multi };
  }, [purchasePrice, monthlyRent]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="h-4 w-4" /> Rendite-Schnellrechner
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Kaufpreis und Monatsmiete eingeben → Brutto-Mietrendite und Mietmultiplikator (Jahresmiete).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        {(purchasePrice > 0 || monthlyRent > 0) && (
          <div className="surface-section p-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Brutto-Mietrendite</p>
                <p className="text-lg font-semibold text-foreground">{bruttoRendite.toFixed(2)} %</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Mietmultiplikator</p>
                <p className="text-lg font-semibold text-foreground">{mietmultiplikator > 0 ? mietmultiplikator.toFixed(1) : "–"} Jahre</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
