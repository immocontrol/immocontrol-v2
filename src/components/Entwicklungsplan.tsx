/**
 * Entwicklungsplan für unterentwickelte Objekte: Zeitstrahl mit Mietanpassungen und
 * wertsteigernden Maßnahmen (PV, Dämmung, Sanierung) — für Bankdarstellung.
 */
import { useMemo, useState } from "react";
import { TrendingUp, Sun, Home, Wrench, Calendar, Info, Sparkles, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  computeEntwicklungsplan,
  type PropertyForPlan,
  type EntwicklungsplanOptions,
  type EntwicklungsplanMassnahme,
} from "@/lib/entwicklungsplanEngine";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isDeepSeekConfigured, suggestEntwicklungsplanSummary } from "@/integrations/ai/extractors";
import { toast } from "sonner";

const HORIZON_OPTIONS = [5, 10, 15] as const;

interface EntwicklungsplanProps {
  property: PropertyForPlan;
  options?: EntwicklungsplanOptions;
  /** Optional: letzte Mieterhöhung (wenn bekannt) */
  lastRentAdjustmentDate?: string | null;
  defaultOpen?: boolean;
}

const TYP_ICON: Record<EntwicklungsplanMassnahme["typ"], typeof TrendingUp> = {
  mietanpassung: TrendingUp,
  pv_mieterstrom: Sun,
  daemmung: Home,
  wohnungssanierung: Wrench,
};

export function Entwicklungsplan({
  property,
  options,
  lastRentAdjustmentDate: lastRentAdjustmentDateProp,
  defaultOpen = true,
}: EntwicklungsplanProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [lastRentAdjustmentDate, setLastRentAdjustmentDate] = useState<string>(lastRentAdjustmentDateProp ?? property.purchaseDate ?? "");
  const [horizonYears, setHorizonYears] = useState<number>(options?.horizonYears ?? 10);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);

  const planOptions: EntwicklungsplanOptions = useMemo(
    () => ({
      ...options,
      lastRentAdjustmentDate: lastRentAdjustmentDate.trim() || undefined,
      horizonYears,
    }),
    [options, lastRentAdjustmentDate, horizonYears]
  );

  const plan = useMemo(
    () => computeEntwicklungsplan(property, planOptions),
    [property, planOptions]
  );

  const maxMiete = Math.max(
    ...plan.mieteProJahr.map((y) => y.mieteMonat),
    plan.istMieteMonat
  );
  const minMiete = Math.min(
    ...plan.mieteProJahr.map((y) => y.mieteMonat),
    plan.istMieteMonat
  );
  const range = maxMiete - minMiete || 1;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="gradient-card rounded-xl border border-border overflow-hidden animate-fade-in">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
            aria-expanded={open}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold">Entwicklungsplan</h2>
              <span className="text-xs text-muted-foreground font-normal">
                Für Bankdarstellung · Wertsteigerung
              </span>
            </div>
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground text-wrap-safe">
              Banken bewerten oft nur die Ist-Miete. Mit diesem Plan zeigst du das Entwicklungspotenzial:
              Mietanpassungen (§558 BGB), Modernisierungen (PV, Dämmung, Sanierung) und den erwarteten Mietverlauf.
            </p>

            {/* Optionen: letzte Mieterhöhung, Planungshorizont */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Letzte Mieterhöhung (leer = Kaufdatum)</Label>
                <Input
                  type="date"
                  value={lastRentAdjustmentDate}
                  onChange={(e) => setLastRentAdjustmentDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Planungshorizont</Label>
                <Select value={String(horizonYears)} onValueChange={(v) => setHorizonYears(Number(v))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORIZON_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y} Jahre</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Kurz-Kennzahlen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Ist-Miete/Monat</div>
                <div className="font-semibold">{formatCurrency(plan.istMieteMonat)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Ziel-Miete (Planende)</div>
                <div className="font-semibold text-profit">{formatCurrency(plan.zielMieteMonat)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Kappungsgrenze</div>
                <div className="font-semibold">{plan.kappungsgrenzePercent} % / 3 Jahre</div>
                {plan.angespanntMarkt && (
                  <div className="text-[10px] text-muted-foreground">angespannter Markt</div>
                )}
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Nächste Anpassung</div>
                <div className="font-semibold">
                  {plan.naechsteAnpassungInMonaten <= 0
                    ? "möglich"
                    : `in ${plan.naechsteAnpassungInMonaten} Mon.`}
                </div>
              </div>
            </div>

            {/* Zeitstrahl (Jahre + Mietverlauf) */}
            <div>
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Mietverlauf (Monatsmiete)
              </h3>
              <div className="overflow-x-auto pb-2 min-w-0">
                <div className="flex gap-1 items-end min-w-max" style={{ minHeight: 56 }}>
                  {plan.mieteProJahr.map((y) => (
                    <div
                      key={y.year}
                      className="flex flex-col items-center gap-0.5"
                      style={{ width: 28 }}
                    >
                      <div
                        className="w-4 rounded-t bg-primary/70 transition-all"
                        style={{
                          height: Math.max(8, 4 + ((y.mieteMonat - minMiete) / range) * 36),
                        }}
                        title={`Jahr ${y.year}: ${formatCurrency(y.mieteMonat)}/Monat`}
                      />
                      <span className="text-[10px] text-muted-foreground">{y.year}</span>
                      {y.label && (
                        <span className="text-[9px] text-primary font-medium">+{y.label}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>Start: {formatCurrency(plan.istMieteMonat)}</span>
                  <span>Ziel: {formatCurrency(plan.zielMieteMonat)}</span>
                </div>
              </div>
            </div>

            {/* Maßnahmen */}
            <div>
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5" /> Wertsteigernde Maßnahmen
              </h3>
              <ul className="space-y-2">
                {plan.massnahmen.map((m) => {
                  const Icon = TYP_ICON[m.typ];
                  return (
                    <li
                      key={m.id}
                      className="flex gap-3 p-3 rounded-lg border border-border bg-card text-wrap-safe"
                    >
                      <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{m.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs">
                          {m.yearSuggested > 0 && (
                            <span>Jahr {m.yearSuggested}</span>
                          )}
                          {m.costOneTime != null && m.costOneTime > 0 && (
                            <span>Kosten: {formatCurrency(m.costOneTime)}</span>
                          )}
                          {m.revenueAnnual != null && m.revenueAnnual > 0 && (
                            <span className="text-profit">+{formatCurrency(m.revenueAnnual)}/Jahr</span>
                          )}
                          {m.umlegbarPercent != null && (
                            <span className="flex items-center gap-1">
                              <Info className="h-3 w-3" /> {m.umlegbarPercent} % umlegbar
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* KI Kurztext für Bank */}
            {isDeepSeekConfigured() && (
              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <Label className="text-xs font-medium">Kurztext für Bankanschreiben (KI)</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2 gap-1.5 h-8"
                  disabled={aiLoading}
                  onClick={async () => {
                    setAiLoading(true);
                    setAiText(null);
                    try {
                      const text = await suggestEntwicklungsplanSummary({
                        istMieteMonat: plan.istMieteMonat,
                        zielMieteMonat: plan.zielMieteMonat,
                        kappungsgrenzePercent: plan.kappungsgrenzePercent,
                        angespanntMarkt: plan.angespanntMarkt,
                        massnahmenAnzahl: plan.massnahmen.length,
                      });
                      setAiText(text);
                    } catch {
                      toast.error("KI-Text konnte nicht erstellt werden.");
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiLoading ? "Wird erstellt…" : "Kurztext generieren"}
                </Button>
                {aiText && <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-background text-wrap-safe">{aiText}</p>}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
