/**
 * INHALT-18: Angebots-Generator — Kaufangebot automatisch erstellen
 * Aus den Deal-Daten ein strukturiertes Kaufangebot generieren.
 * Mit Berechnungen: Max-Gebot basierend auf Zielrendite, Finanzierbarkeit.
 */
import { memo, useState, useMemo, useCallback } from "react";
import { FileSignature, Calculator, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { toast } from "sonner";

const AngebotsGenerator = memo(() => {
  const [expanded, setExpanded] = useState(false);

  const [deal, setDeal] = useState({
    objectName: "",
    address: "",
    seller: "",
    askingPrice: 0,
    monthlyRent: 0,
    sqm: 0,
    units: 1,
    yearBuilt: 2000,
    targetRendite: 5, // %
    eigenkapital: 20, // %
    zins: 3.5, // %
    tilgung: 2, // %
    nebenkostenKauf: 12, // % (Grunderwerbsteuer + Notar + Makler)
    notes: "",
  });

  const calculation = useMemo(() => {
    if (deal.askingPrice <= 0 || deal.monthlyRent <= 0) return null;

    const annualRent = deal.monthlyRent * 12;
    const askingRendite = (annualRent / deal.askingPrice) * 100;

    // Max price for target yield
    const maxPriceForRendite = deal.targetRendite > 0 ? annualRent / (deal.targetRendite / 100) : 0;

    // Total cost including Nebenkosten
    const totalCostAsking = deal.askingPrice * (1 + deal.nebenkostenKauf / 100);
    const totalCostMax = maxPriceForRendite * (1 + deal.nebenkostenKauf / 100);

    // Eigenkapital needed
    const ekNeeded = totalCostAsking * (deal.eigenkapital / 100);
    const ekNeededMax = totalCostMax * (deal.eigenkapital / 100);

    // Financing
    const loan = totalCostAsking * (1 - deal.eigenkapital / 100);
    const monthlyRate = loan * (deal.zins + deal.tilgung) / 100 / 12;
    const monthlyCashflow = deal.monthlyRent - monthlyRate;
    const cashflowRendite = totalCostAsking > 0 ? (monthlyCashflow * 12 / totalCostAsking) * 100 : 0;

    // Suggested offer (between asking and max price)
    const suggestedOffer = Math.round(Math.min(deal.askingPrice, maxPriceForRendite * 0.95) / 1000) * 1000;
    const discount = deal.askingPrice > 0 ? ((deal.askingPrice - suggestedOffer) / deal.askingPrice) * 100 : 0;

    return {
      annualRent, askingRendite, maxPriceForRendite, totalCostAsking,
      totalCostMax, ekNeeded, ekNeededMax, loan, monthlyRate,
      monthlyCashflow, cashflowRendite, suggestedOffer, discount,
    };
  }, [deal]);

  const handleExportOffer = useCallback(() => {
    if (!calculation || !deal.objectName) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    const today = new Date().toLocaleDateString("de-DE");
    const text = [
      `KAUFANGEBOT`,
      `Datum: ${today}`,
      ``,
      `Objekt: ${deal.objectName}`,
      `Adresse: ${deal.address}`,
      `Verkäufer: ${deal.seller}`,
      ``,
      `Angebotener Kaufpreis: ${formatCurrency(calculation.suggestedOffer)}`,
      `(Listenpreis: ${formatCurrency(deal.askingPrice)}, Nachlass: ${calculation.discount.toFixed(1)}%)`,
      ``,
      `KALKULATION:`,
      `Jahresmiete: ${formatCurrency(calculation.annualRent)}`,
      `Brutto-Rendite (Angebot): ${formatPercentDE(calculation.annualRent / calculation.suggestedOffer * 100)}`,
      `Kaufnebenkosten (${deal.nebenkostenKauf}%): ${formatCurrency(calculation.suggestedOffer * deal.nebenkostenKauf / 100)}`,
      `Gesamtinvestition: ${formatCurrency(calculation.suggestedOffer * (1 + deal.nebenkostenKauf / 100))}`,
      ``,
      `FINANZIERUNG:`,
      `Eigenkapital (${deal.eigenkapital}%): ${formatCurrency(calculation.suggestedOffer * (1 + deal.nebenkostenKauf / 100) * deal.eigenkapital / 100)}`,
      `Fremdkapital: ${formatCurrency(calculation.suggestedOffer * (1 + deal.nebenkostenKauf / 100) * (1 - deal.eigenkapital / 100))}`,
      `Zinssatz: ${formatPercentDE(deal.zins)}`,
      `Tilgung: ${formatPercentDE(deal.tilgung)}`,
      `Monatliche Rate: ${formatCurrency(calculation.suggestedOffer * (1 + deal.nebenkostenKauf / 100) * (1 - deal.eigenkapital / 100) * (deal.zins + deal.tilgung) / 100 / 12)}`,
      ``,
      deal.notes ? `ANMERKUNGEN:\n${deal.notes}\n` : "",
      `---`,
      `Generiert mit ImmoControl`,
    ].filter(Boolean).join("\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaufangebot-${deal.objectName.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Kaufangebot exportiert");
  }, [deal, calculation]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Angebots-Generator</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Input fields */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Input className="h-7 text-[10px]" placeholder="Objektname" value={deal.objectName} onChange={(e) => setDeal((p) => ({ ...p, objectName: e.target.value }))} />
        <Input className="h-7 text-[10px]" placeholder="Adresse" value={deal.address} onChange={(e) => setDeal((p) => ({ ...p, address: e.target.value }))} />
        <Input className="h-7 text-[10px]" type="number" placeholder="Angebotspreis €" value={deal.askingPrice || ""} onChange={(e) => setDeal((p) => ({ ...p, askingPrice: parseFloat(e.target.value) || 0 }))} />
        <Input className="h-7 text-[10px]" type="number" placeholder="Miete/Monat €" value={deal.monthlyRent || ""} onChange={(e) => setDeal((p) => ({ ...p, monthlyRent: parseFloat(e.target.value) || 0 }))} />
      </div>

      {/* Financing params */}
      {expanded && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Zielrendite</span>
              <span className="font-bold text-profit">{formatPercentDE(deal.targetRendite)}</span>
            </div>
            <Slider value={[deal.targetRendite]} onValueChange={([v]) => setDeal((p) => ({ ...p, targetRendite: v }))} min={2} max={10} step={0.5} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">EK-Anteil</span>
              <span className="font-bold">{deal.eigenkapital}%</span>
            </div>
            <Slider value={[deal.eigenkapital]} onValueChange={([v]) => setDeal((p) => ({ ...p, eigenkapital: v }))} min={0} max={100} step={5} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Zinssatz</span>
              <span className="font-bold">{formatPercentDE(deal.zins)}</span>
            </div>
            <Slider value={[deal.zins]} onValueChange={([v]) => setDeal((p) => ({ ...p, zins: v }))} min={1} max={7} step={0.1} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Tilgung</span>
              <span className="font-bold">{formatPercentDE(deal.tilgung)}</span>
            </div>
            <Slider value={[deal.tilgung]} onValueChange={([v]) => setDeal((p) => ({ ...p, tilgung: v }))} min={1} max={5} step={0.5} />
          </div>
        </div>
      )}

      {/* Calculation results */}
      {calculation && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="text-center p-1.5 rounded bg-background/50">
              <span className="text-muted-foreground">Rendite (Listing)</span>
              <p className={`font-bold ${calculation.askingRendite >= deal.targetRendite ? "text-profit" : "text-loss"}`}>
                {formatPercentDE(calculation.askingRendite)}
              </p>
            </div>
            <div className="text-center p-1.5 rounded bg-background/50">
              <span className="text-muted-foreground">Max-Gebot</span>
              <p className="font-bold text-primary">{formatCurrency(calculation.maxPriceForRendite)}</p>
            </div>
            <div className="text-center p-1.5 rounded bg-background/50">
              <span className="text-muted-foreground">Cashflow/M</span>
              <p className={`font-bold ${calculation.monthlyCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(calculation.monthlyCashflow)}
              </p>
            </div>
          </div>

          {/* Suggested offer */}
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-center">
            <p className="text-[10px] text-muted-foreground">Empfohlenes Angebot</p>
            <p className="text-sm font-bold text-primary">{formatCurrency(calculation.suggestedOffer)}</p>
            <p className="text-[10px] text-muted-foreground">
              {calculation.discount > 0 ? `${calculation.discount.toFixed(1)}% unter Listenpreis` : "Marktgerecht"}
            </p>
          </div>

          {expanded && (
            <>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-1.5 rounded bg-background/50">
                  <span className="text-muted-foreground">EK benötigt</span>
                  <p className="font-medium">{formatCurrency(calculation.ekNeeded)}</p>
                </div>
                <div className="p-1.5 rounded bg-background/50">
                  <span className="text-muted-foreground">Monatl. Rate</span>
                  <p className="font-medium">{formatCurrency(calculation.monthlyRate)}</p>
                </div>
              </div>

              <Textarea
                className="text-[10px] min-h-[40px]"
                placeholder="Anmerkungen zum Angebot..."
                value={deal.notes}
                onChange={(e) => setDeal((p) => ({ ...p, notes: e.target.value }))}
              />

              <Button size="sm" variant="outline" className="w-full text-[10px] h-7" onClick={handleExportOffer}>
                <Download className="h-3 w-3 mr-1" />
                Kaufangebot exportieren
              </Button>
            </>
          )}
        </div>
      )}

      {!calculation && (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          Kaufpreis und Miete eingeben für automatische Berechnung
        </p>
      )}
    </div>
  );
});
AngebotsGenerator.displayName = "AngebotsGenerator";

export { AngebotsGenerator };
