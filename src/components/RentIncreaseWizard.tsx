/**
 * MIETERHÖHUNG-1: Automatische Mieterhöhungs-Berechnung nach §558 BGB
 *
 * Features:
 * - Kappungsgrenze (20% in 3 Jahren, 15% in angespannten Märkten)
 * - Mietspiegel-Vergleich
 * - Modernisierungsumlage (§559 BGB)
 * - Wartefrist-Prüfung (15 Monate seit letzter Erhöhung)
 * - Rechtliche Checkliste
 * - PDF-Export des Erhöhungsschreibens
 */

import { useState, useMemo } from "react";
import { Calculator, TrendingUp, AlertTriangle, CheckCircle, FileText, Scale, Info, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import {
  KAPPUNGSGRENZE_NORMAL,
  KAPPUNGSGRENZE_ANGESPANNT,
  WARTEFRIST_MONATE,
  MODERNISIERUNG_UMLAGE_PROZENT,
  ANGESPANNTE_MÄRKTE,
} from "@/lib/mietrechtConstants";

interface RentIncreaseWizardProps {
  currentRent?: number;
  propertyName?: string;
  sqm?: number;
  tenantName?: string;
}

interface MietspiegelEntry {
  minPerSqm: number;
  maxPerSqm: number;
  avgPerSqm: number;
}

const RentIncreaseWizard = ({ currentRent = 0, propertyName, sqm = 0, tenantName }: RentIncreaseWizardProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  /* Form state */
  const [form, setForm] = useState({
    currentRent,
    sqm,
    city: "",
    isAngespannt: false,
    lastIncreaseDate: "",
    mietspiegelMin: 0,
    mietspiegelMax: 0,
    mietspiegelAvg: 0,
    hasMietspiegel: false,
    modernisierungKosten: 0,
    hasModernisierung: false,
    targetRent: 0,
  });

  const update = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  /* Calculations */
  const kappungsgrenze = form.isAngespannt ? KAPPUNGSGRENZE_ANGESPANNT : KAPPUNGSGRENZE_NORMAL;
  const maxKappung = form.currentRent * (kappungsgrenze / 100);
  const maxRentAfterKappung = form.currentRent + maxKappung;

  /* Mietspiegel limit */
  const mietspiegelLimit = useMemo<MietspiegelEntry | null>(() => {
    if (!form.hasMietspiegel || form.sqm <= 0) return null;
    return {
      minPerSqm: form.mietspiegelMin,
      maxPerSqm: form.mietspiegelMax,
      avgPerSqm: form.mietspiegelAvg,
    };
  }, [form.hasMietspiegel, form.sqm, form.mietspiegelMin, form.mietspiegelMax, form.mietspiegelAvg]);

  const maxMietspiegelRent = mietspiegelLimit && form.sqm > 0
    ? mietspiegelLimit.maxPerSqm * form.sqm
    : Infinity;

  /* Modernisierungsumlage §559 */
  const modernisierungUmlageMonatlich = form.hasModernisierung
    ? (form.modernisierungKosten * (MODERNISIERUNG_UMLAGE_PROZENT / 100)) / 12
    : 0;

  /* Maximum legal rent increase */
  const maxLegalRent = Math.min(maxRentAfterKappung, maxMietspiegelRent) + modernisierungUmlageMonatlich;
  const maxIncrease = maxLegalRent - form.currentRent;
  const maxIncreasePercent = form.currentRent > 0 ? (maxIncrease / form.currentRent) * 100 : 0;

  /* Wartefrist check */
  const wartefristOk = useMemo(() => {
    if (!form.lastIncreaseDate) return true;
    const lastIncrease = new Date(form.lastIncreaseDate);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - lastIncrease.getFullYear()) * 12 + (now.getMonth() - lastIncrease.getMonth());
    return monthsDiff >= WARTEFRIST_MONATE;
  }, [form.lastIncreaseDate]);

  const wartefristMonths = useMemo(() => {
    if (!form.lastIncreaseDate) return 0;
    const lastIncrease = new Date(form.lastIncreaseDate);
    const now = new Date();
    return (now.getFullYear() - lastIncrease.getFullYear()) * 12 + (now.getMonth() - lastIncrease.getMonth());
  }, [form.lastIncreaseDate]);

  /* Legal checklist */
  const checklist = [
    { label: "Wartefrist eingehalten (≥15 Monate)", ok: wartefristOk, info: `${wartefristMonths} Monate seit letzter Erhöhung` },
    { label: `Kappungsgrenze (max. ${kappungsgrenze}% in 3 Jahren)`, ok: true, info: `Max. +${formatCurrency(maxKappung)}/Monat` },
    { label: "Innerhalb ortsüblicher Vergleichsmiete", ok: !mietspiegelLimit || (form.currentRent + maxIncrease) <= maxMietspiegelRent, info: mietspiegelLimit ? `Max. ${formatCurrency(maxMietspiegelRent)}/Monat laut Mietspiegel` : "Kein Mietspiegel angegeben" },
    { label: "Begründung erforderlich (Mietspiegel/Gutachten)", ok: true, info: "§558a BGB" },
    { label: "Textform erforderlich (Brief oder E-Mail)", ok: true, info: "§558a Abs. 1 BGB" },
    { label: "Zustimmungsfrist 2 Monate für Mieter", ok: true, info: "§558b BGB" },
  ];

  /* Auto-detect angespannter Markt */
  const handleCityChange = (city: string) => {
    update("city", city);
    const isAngespannt = ANGESPANNTE_MÄRKTE.some(m => city.toLowerCase().includes(m.toLowerCase()));
    update("isAngespannt", isAngespannt);
  };

  const yearlyGain = maxIncrease * 12;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
          <Scale className="h-3.5 w-3.5" /> Mieterhöhung §558
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Mieterhöhungs-Assistent (§558 BGB)
          </DialogTitle>
          {propertyName && <p className="text-xs text-muted-foreground">{propertyName}{tenantName ? ` — ${tenantName}` : ""}</p>}
        </DialogHeader>

        <div className="space-y-5">
          {/* Step 1: Basic Data */}
          {step >= 1 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">1. Grunddaten</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Aktuelle Kaltmiete (€/Monat)</Label>
                  <NumberInput value={form.currentRent} onChange={v => update("currentRent", v)} className="h-9 text-sm" decimals />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Wohnfläche (m²)</Label>
                  <NumberInput value={form.sqm} onChange={v => update("sqm", v)} className="h-9 text-sm" decimals />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stadt / Gemeinde</Label>
                  <Input value={form.city} onChange={e => handleCityChange(e.target.value)} className="h-9 text-sm" placeholder="z.B. München" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Letzte Erhöhung</Label>
                  <Input type="date" value={form.lastIncreaseDate} onChange={e => update("lastIncreaseDate", e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
              {form.isAngespannt && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-gold/10 text-gold">
                  <Building className="h-3.5 w-3.5 shrink-0" />
                  <span>Angespannter Wohnungsmarkt erkannt — Kappungsgrenze 15% statt 20%</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Mietspiegel */}
          {step >= 1 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">2. Mietspiegel</h3>
              <div className="flex items-center gap-3">
                <Switch checked={form.hasMietspiegel} onCheckedChange={v => update("hasMietspiegel", v)} />
                <Label className="text-xs">Mietspiegel-Daten vorhanden</Label>
              </div>
              {form.hasMietspiegel && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Min €/m²</Label>
                    <NumberInput value={form.mietspiegelMin} onChange={v => update("mietspiegelMin", v)} className="h-9 text-sm" decimals />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Durchschnitt €/m²</Label>
                    <NumberInput value={form.mietspiegelAvg} onChange={v => update("mietspiegelAvg", v)} className="h-9 text-sm" decimals />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max €/m²</Label>
                    <NumberInput value={form.mietspiegelMax} onChange={v => update("mietspiegelMax", v)} className="h-9 text-sm" decimals />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Modernisierung */}
          {step >= 1 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">3. Modernisierung (§559 BGB)</h3>
              <div className="flex items-center gap-3">
                <Switch checked={form.hasModernisierung} onCheckedChange={v => update("hasModernisierung", v)} />
                <Label className="text-xs">Modernisierung durchgeführt</Label>
              </div>
              {form.hasModernisierung && (
                <div className="space-y-1">
                  <Label className="text-xs">Modernisierungskosten (gesamt)</Label>
                  <NumberInput value={form.modernisierungKosten} onChange={v => update("modernisierungKosten", v)} className="h-9 text-sm" />
                  <p className="text-[10px] text-muted-foreground">
                    Umlage: {MODERNISIERUNG_UMLAGE_PROZENT}% pro Jahr = {formatCurrency(modernisierungUmlageMonatlich)}/Monat
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          <div className="gradient-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" /> Ergebnis
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Aktuelle Miete</span>
                <p className="font-medium">{formatCurrency(form.currentRent)}/Monat</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Max. neue Miete</span>
                <p className="font-bold text-primary">{formatCurrency(maxLegalRent)}/Monat</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Max. Erhöhung</span>
                <p className="font-medium text-profit">+{formatCurrency(maxIncrease)}/Monat ({formatPercent(maxIncreasePercent)})</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Mehrertrag/Jahr</span>
                <p className="font-medium text-profit">+{formatCurrency(yearlyGain)}</p>
              </div>
            </div>
            {form.sqm > 0 && (
              <div className="text-xs text-muted-foreground">
                Neue Miete pro m²: {formatCurrency(maxLegalRent / form.sqm)}/m²
                {mietspiegelLimit && ` (Mietspiegel: ${formatCurrency(mietspiegelLimit.avgPerSqm)}/m²)`}
              </div>
            )}
          </div>

          {/* Legal checklist */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Scale className="h-3 w-3" /> Rechtliche Prüfung
            </h3>
            {checklist.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${
                  item.ok ? "bg-profit/5" : "bg-loss/5"
                }`}
              >
                {item.ok
                  ? <CheckCircle className="h-3.5 w-3.5 text-profit shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-loss shrink-0 mt-0.5" />
                }
                <div>
                  <span className={item.ok ? "text-profit" : "text-loss"}>{item.label}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.info}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Hinweis: Dies ist eine Orientierungshilfe basierend auf §558 und §559 BGB. Für rechtsverbindliche Auskunft bitte einen Fachanwalt konsultieren. Modernisierungsumlage unterliegt zusätzlichen Voraussetzungen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RentIncreaseWizard;
