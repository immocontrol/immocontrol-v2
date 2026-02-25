import { useState } from "react";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";

type CalcType = "rendite" | "tilgung" | "miete_qm" | "makler";

export function QuickCalculator() {
  const [calcType, setCalcType] = useState<CalcType>("rendite");
  const [values, setValues] = useState({ kaufpreis: 0, miete: 0, nebenkosten: 0, zinssatz: 0, tilgung: 0, qm: 0, provisionProzent: 3.57 });

  const results = (() => {
    switch (calcType) {
      case "rendite": {
        const brutto = values.kaufpreis > 0 ? (values.miete * 12 / values.kaufpreis * 100) : 0;
        const netto = values.kaufpreis > 0 ? ((values.miete - values.nebenkosten) * 12 / values.kaufpreis * 100) : 0;
        const faktor = values.miete > 0 ? values.kaufpreis / (values.miete * 12) : 0;
        return [
          { label: "Brutto-Rendite", value: `${brutto.toFixed(2)}%` },
          { label: "Netto-Rendite", value: `${netto.toFixed(2)}%` },
          { label: "Mietmultiplikator", value: faktor > 0 ? `${faktor.toFixed(1)}x` : "–" },
          { label: "Jahresmiete", value: formatCurrency(values.miete * 12) },
        ];
      }
      case "tilgung": {
        const monatszins = values.zinssatz / 100 / 12;
        const annuität = values.kaufpreis * (values.zinssatz + values.tilgung) / 100 / 12;
        const zinsenJ1 = values.kaufpreis * values.zinssatz / 100;
        const tilgungJ1 = values.kaufpreis * values.tilgung / 100;
        const laufzeit = values.tilgung > 0 ? Math.log(annuität / (annuität - values.kaufpreis * monatszins)) / Math.log(1 + monatszins) / 12 : 0;
        return [
          { label: "Monatsrate", value: formatCurrency(annuität) },
          { label: "Zinsen Jahr 1", value: formatCurrency(zinsenJ1) },
          { label: "Tilgung Jahr 1", value: formatCurrency(tilgungJ1) },
          { label: "Laufzeit ca.", value: laufzeit > 0 ? `${Math.round(laufzeit)} Jahre` : "–" },
        ];
      }
      case "miete_qm": {
        const proQm = values.qm > 0 ? values.miete / values.qm : 0;
        const jahresmiete = values.miete * 12;
        return [
          { label: "Miete/m²", value: `${proQm.toFixed(2)} €/m²` },
          { label: "Jahresmiete", value: formatCurrency(jahresmiete) },
          { label: "Kaufpreis/m²", value: values.qm > 0 ? formatCurrency(values.kaufpreis / values.qm) : "–" },
        ];
      }
      case "makler": {
        const provision = values.kaufpreis * values.provisionProzent / 100;
        const grunderwerbsteuer = values.kaufpreis * 0.065;
        const notar = values.kaufpreis * 0.02;
        const grundbuch = values.kaufpreis * 0.005;
        const gesamt = provision + grunderwerbsteuer + notar + grundbuch;
        return [
          { label: "Maklerprovision", value: formatCurrency(provision) },
          { label: "Grunderwerbsteuer (6,5%)", value: formatCurrency(grunderwerbsteuer) },
          { label: "Notar + Grundbuch", value: formatCurrency(notar + grundbuch) },
          { label: "Kaufnebenkosten gesamt", value: formatCurrency(gesamt) },
          { label: "Gesamtinvestition", value: formatCurrency(values.kaufpreis + gesamt) },
        ];
      }
    }
  })();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Calculator className="h-3.5 w-3.5" /> Rechner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Schnellrechner
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={calcType} onValueChange={v => setCalcType(v as CalcType)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rendite">Rendite-Rechner</SelectItem>
              <SelectItem value="tilgung">Tilgungsrechner</SelectItem>
              <SelectItem value="miete_qm">Miete pro m²</SelectItem>
              <SelectItem value="makler">Kaufnebenkosten</SelectItem>
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Kaufpreis €</Label>
              <Input type="number" value={values.kaufpreis || ""} onChange={e => setValues({...values, kaufpreis: Number(e.target.value)})} className="h-9 text-sm" />
            </div>
            {(calcType === "rendite" || calcType === "miete_qm") && (
              <div className="space-y-1">
                <Label className="text-xs">Kaltmiete/M €</Label>
                <Input type="number" value={values.miete || ""} onChange={e => setValues({...values, miete: Number(e.target.value)})} className="h-9 text-sm" />
              </div>
            )}
            {calcType === "rendite" && (
              <div className="space-y-1">
                <Label className="text-xs">NK/Verwaltung/M €</Label>
                <Input type="number" value={values.nebenkosten || ""} onChange={e => setValues({...values, nebenkosten: Number(e.target.value)})} className="h-9 text-sm" />
              </div>
            )}
            {calcType === "tilgung" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Zinssatz %</Label>
                  <Input type="number" step="0.01" value={values.zinssatz || ""} onChange={e => setValues({...values, zinssatz: Number(e.target.value)})} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tilgung %</Label>
                  <Input type="number" step="0.01" value={values.tilgung || ""} onChange={e => setValues({...values, tilgung: Number(e.target.value)})} className="h-9 text-sm" />
                </div>
              </>
            )}
            {calcType === "miete_qm" && (
              <div className="space-y-1">
                <Label className="text-xs">Fläche m²</Label>
                <Input type="number" value={values.qm || ""} onChange={e => setValues({...values, qm: Number(e.target.value)})} className="h-9 text-sm" />
              </div>
            )}
            {calcType === "makler" && (
              <div className="space-y-1">
                <Label className="text-xs">Provision %</Label>
                <Input type="number" step="0.01" value={values.provisionProzent || ""} onChange={e => setValues({...values, provisionProzent: Number(e.target.value)})} className="h-9 text-sm" />
              </div>
            )}
          </div>

          {/* Results */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
            {results.map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold tabular-nums">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
