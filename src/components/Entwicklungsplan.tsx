/**
 * Entwicklungsplan für unterentwickelte Objekte: Zeitstrahl mit Mietanpassungen und
 * wertsteigernden Maßnahmen (PV, Dämmung, Sanierung) — für Bankdarstellung.
 */
import { useMemo, useState, useCallback } from "react";
import { TrendingUp, Sun, Home, Wrench, Calendar, Info, Sparkles, Loader2, FileDown, MessageCircle, BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { loadJsPDF } from "@/lib/lazyImports";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
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
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
  sofagespraeche: MessageCircle,
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
  const [sofagespraecheMieteVorher, setSofagespraecheMieteVorher] = useState<string>(
    options?.sofagespraecheMieteVorher != null ? String(options.sofagespraecheMieteVorher) : ""
  );
  const [instandhaltungProQm, setInstandhaltungProQm] = useState<number>(20);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const planOptions: EntwicklungsplanOptions = useMemo(() => {
    const vorher = sofagespraecheMieteVorher.trim();
    return {
      ...options,
      lastRentAdjustmentDate: lastRentAdjustmentDate.trim() || undefined,
      horizonYears,
      sofagespraecheMieteVorher: vorher ? parseFloat(vorher) || undefined : undefined,
    };
  }, [options, lastRentAdjustmentDate, horizonYears, sofagespraecheMieteVorher]);

  const plan = useMemo(
    () => computeEntwicklungsplan(property, planOptions),
    [property, planOptions]
  );

  /* Chart: Mieteinnahmen, Kreditrate, Instandhaltung pro Jahr */
  const chartData = useMemo(() => {
    const kreditrateJahr = (property.monthlyCreditRate || 0) * 12;
    const instandhaltungJahr = (property.sqm || 0) * instandhaltungProQm;
    return plan.mieteProJahr.map((y) => ({
      year: `Jahr ${y.year}`,
      mieteinnahmen: y.mieteJahr,
      kreditrate: kreditrateJahr,
      instandhaltung: instandhaltungJahr,
      cashflow: y.mieteJahr - kreditrateJahr - instandhaltungJahr,
    }));
  }, [plan.mieteProJahr, property.monthlyCreditRate, property.sqm, instandhaltungProQm]);

  const maxMiete = Math.max(
    ...plan.mieteProJahr.map((y) => y.mieteMonat),
    plan.istMieteMonat
  );
  const minMiete = Math.min(
    ...plan.mieteProJahr.map((y) => y.mieteMonat),
    plan.istMieteMonat
  );
  const range = maxMiete - minMiete || 1;

  const exportEntwicklungsplanPDF = useCallback(async () => {
    const title = `Entwicklungsplan_${property.name}`.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_");
    try {
      setPdfLoading(true);
      const JsPDF = await loadJsPDF();
      const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 20;

      const checkPage = (need: number) => {
        if (y + need > 270) { doc.addPage(); y = 20; }
      };

      /* Header */
      doc.setFontSize(18);
      doc.setTextColor(42, 157, 110);
      doc.text("Entwicklungsplan", margin, y);
      y += 5;
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text(property.name, margin, y);
      if (property.address) { y += 5; doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.text(property.address, margin, y); y += 4; }
      y += 4;
      doc.setDrawColor(42, 157, 110);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      /* Kennzahlen */
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 34, 34);
      doc.text("Kernkennzahlen", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const kennzahlen: [string, string][] = plan.sofagespraeche
        ? [
            ["Sofagespräche (bereits umgesetzt)", `${formatCurrency(plan.sofagespraeche.mieteVorher)} → ${formatCurrency(plan.sofagespraeche.mieteNachher)} (+${plan.sofagespraeche.increasePercent} %)`],
            ["Ist-Miete/Monat", formatCurrency(plan.istMieteMonat)],
            ["Ziel-Miete (Planende)", formatCurrency(plan.zielMieteMonat)],
        ["Kappungsgrenze", `${plan.kappungsgrenzePercent} % / 3 Jahre${plan.angespanntMarkt ? " (angespannter Markt)" : ""}`],
        ["Nächste Anpassung", plan.naechsteAnpassungInMonaten <= 0 ? "möglich" : `in ${plan.naechsteAnpassungInMonaten} Mon.`],
      ]
        : [
            ["Ist-Miete/Monat", formatCurrency(plan.istMieteMonat)],
            ["Ziel-Miete (Planende)", formatCurrency(plan.zielMieteMonat)],
            ["Kappungsgrenze", `${plan.kappungsgrenzePercent} % / 3 Jahre${plan.angespanntMarkt ? " (angespannter Markt)" : ""}`],
            ["Nächste Anpassung", plan.naechsteAnpassungInMonaten <= 0 ? "möglich" : `in ${plan.naechsteAnpassungInMonaten} Mon.`],
          ];
      for (const [k, v] of kennzahlen) {
        checkPage(6);
        doc.text(k, margin, y);
        doc.text(v, pageW - margin, y, { align: "right" });
        y += 5.5;
      }
      y += 4;

      /* Mietverlauf */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Mietverlauf (Monatsmiete)", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      checkPage(plan.mieteProJahr.length * 5 + 8);
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 4, pageW - 2 * margin, 6, "F");
      doc.text("Jahr", margin + 2, y + 0.5);
      doc.text("Miete/Monat", pageW - margin - 2, y + 0.5, { align: "right" });
      y += 7;
      for (const yr of plan.mieteProJahr) {
        doc.text(`Jahr ${yr.year}`, margin + 2, y);
        doc.text(formatCurrency(yr.mieteMonat), pageW - margin - 2, y, { align: "right" });
        if (yr.label) doc.text(`+${yr.label}`, pageW - margin - 40, y);
        y += 5;
      }
      y += 6;

      /* Einnahmen/Ausgaben pro Jahr */
      if (chartData.length > 0) {
        checkPage(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Einnahmen & Ausgaben pro Jahr", margin, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y - 4, pageW - 2 * margin, 6, "F");
        doc.text("Jahr", margin + 2, y + 0.5);
        doc.text("Mieteinnahmen", margin + 35, y + 0.5);
        doc.text("Kreditrate", margin + 80, y + 0.5);
        doc.text("Instandhaltung", margin + 115, y + 0.5);
        doc.text("Cashflow", pageW - margin - 25, y + 0.5, { align: "right" });
        y += 6;
        for (const row of chartData) {
          checkPage(5);
          doc.text(row.year, margin + 2, y);
          doc.text(formatCurrency(row.mieteinnahmen), margin + 35, y);
          doc.text(formatCurrency(row.kreditrate), margin + 80, y);
          doc.text(formatCurrency(row.instandhaltung), margin + 115, y);
          doc.text(formatCurrency(row.cashflow), pageW - margin - 2, y, { align: "right" });
          y += 5;
        }
        y += 4;
      }

      /* Maßnahmen */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Wertsteigernde Maßnahmen", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const m of plan.massnahmen) {
        checkPage(18);
        doc.setFont("helvetica", "bold");
        doc.text(m.title, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(m.description, pageW - 2 * margin - 4);
        doc.text(descLines, margin + 2, y);
        y += descLines.length * 4.5 + 2;
        const details: string[] = [];
        if (m.yearSuggested > 0) details.push(`Jahr ${m.yearSuggested}`);
        if (m.costOneTime != null && m.costOneTime > 0) details.push(`Kosten: ${formatCurrency(m.costOneTime)}`);
        if (m.revenueAnnual != null && m.revenueAnnual > 0) details.push(`+${formatCurrency(m.revenueAnnual)}/Jahr`);
        if (m.umlegbarPercent != null) details.push(`${m.umlegbarPercent} % umlegbar`);
        if (details.length > 0) {
          doc.text(details.join(" · "), margin + 2, y);
          y += 5;
        }
        y += 3;
      }
      y += 4;

      /* KI-Kurztext */
      if (aiText) {
        checkPage(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Kurztext für Bankanschreiben", margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(aiText, pageW - 2 * margin - 4);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 4;
      }

      /* Footer */
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(170, 170, 170);
        doc.text(`ImmoControl · Entwicklungsplan · ${new Date().toLocaleDateString("de-DE")} · Seite ${i}/${pageCount}`, pageW / 2, 287, { align: "center" });
      }

      doc.save(`${title}.pdf`);
      toast.success("Entwicklungsplan als PDF gespeichert!");
    } catch (e) {
      handleError(e, { context: "pdf", details: "exportEntwicklungsplanPDF", showToast: false });
      toastErrorWithRetry("PDF konnte nicht erstellt werden", exportEntwicklungsplanPDF);
    } finally {
      setPdfLoading(false);
    }
  }, [property, plan, aiText, chartData, instandhaltungProQm]);

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

            {/* PDF herunterladen */}
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2"
              disabled={pdfLoading}
              onClick={exportEntwicklungsplanPDF}
            >
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {pdfLoading ? "PDF wird erstellt…" : "Entwicklungsplan als PDF"}
            </Button>

            {/* Optionen: letzte Mieterhöhung, Planungshorizont, Sofagespräche, Instandhaltung */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div className="space-y-1">
                <Label className="text-xs">Miete vor Sofagespräch (€/Monat)</Label>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  placeholder="z. B. 800"
                  value={sofagespraecheMieteVorher}
                  onChange={(e) => setSofagespraecheMieteVorher(e.target.value)}
                  className="h-9 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Optional: einvernehmliche Mieterhöhung bereits umgesetzt</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instandhaltung (€/m² · Jahr)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={instandhaltungProQm}
                  onChange={(e) => setInstandhaltungProQm(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Standard ~15–25 €/m²</p>
              </div>
            </div>

            {/* Kurz-Kennzahlen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {plan.sofagespraeche && (
                <div className="col-span-2 sm:col-span-4 rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> Sofagespräche (bereits umgesetzt)
                  </div>
                  <div className="font-semibold text-profit">
                    {formatCurrency(plan.sofagespraeche.mieteVorher)} → {formatCurrency(plan.sofagespraeche.mieteNachher)} (+{plan.sofagespraeche.increasePercent} %)
                  </div>
                </div>
              )}
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

            {/* Graph: Mieteinnahmen, Kreditrate, Instandhaltung pro Jahr */}
            {chartData.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <BarChart2 className="h-3.5 w-3.5" /> Einnahmen & Ausgaben pro Jahr
                </h3>
                <div className="h-52 min-w-0" role="img" aria-label="Verlauf Mieteinnahmen, Kreditrate und Instandhaltung pro Jahr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--background))",
                        }}
                        formatter={(v: number, name: string) => [
                          formatCurrency(v),
                          name === "mieteinnahmen"
                            ? "Mieteinnahmen"
                            : name === "kreditrate"
                              ? "Kreditrate"
                              : name === "instandhaltung"
                                ? "Instandhaltung"
                                : name === "cashflow"
                                  ? "Cashflow"
                                  : name,
                        ]}
                        labelFormatter={(label) => label}
                      />
                      <Legend formatter={(v) => (v === "mieteinnahmen" ? "Mieteinnahmen" : v === "kreditrate" ? "Kreditrate" : v === "instandhaltung" ? "Instandhaltung" : v === "cashflow" ? "Cashflow" : v)} wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="mieteinnahmen" fill="hsl(var(--profit))" radius={[4, 4, 0, 0]} name="mieteinnahmen" />
                      <Line type="monotone" dataKey="kreditrate" stroke="hsl(var(--loss))" strokeWidth={2} dot={false} name="kreditrate" />
                      <Line type="monotone" dataKey="instandhaltung" stroke="hsl(var(--gold))" strokeWidth={2} strokeDasharray="4 2" dot={false} name="instandhaltung" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

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
                        sofagespraeche: plan.sofagespraeche ?? undefined,
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
