import { useState, useMemo, useCallback, useRef } from "react";
import { TrendingUp, Sliders, RotateCcw, Download, Save, Upload, Bookmark, Target, Zap, BarChart3, PieChart, Table, Copy, Share2, Euro, Building2, Calculator, AlertTriangle, Check, Sparkles, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, CartesianGrid, Line, ComposedChart } from "recharts";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  type SimParams, type DataPoint, type ChartView, type SavedProfile, type Scenario,
  DEFAULT_PARAMS, SCENARIOS, simulate, sensitivityAnalysis,
  loadProfiles, saveProfilesStore,
} from "@/lib/hockeyStickEngine";
import { parseAiPrompt } from "@/lib/hockeyStickAiParser";

/* IMP-3: Types, simulation engine, scenarios, and profile persistence
   extracted to @/lib/hockeyStickEngine.ts for modularity & testability */
/* AI parser extracted to @/lib/hockeyStickAiParser.ts */

export function HockeyStickSimulator({ embedded = false }: { embedded?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [chartView, setChartView] = useState<ChartView>("growth");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(loadProfiles);
  const [profileName, setProfileName] = useState("");
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [sensitivityKey, setSensitivityKey] = useState<keyof SimParams>("annualAppreciation");
  const [compareParams, setCompareParams] = useState<SimParams | null>(null);
  /* FEAT-39: Toggle between nominal and inflation-adjusted (real) net worth */
  const [showRealValues, setShowRealValues] = useState(false);
  /* FEAT-40: Net worth goal line (used in chart + milestone) */
  const [netWorthGoal, setNetWorthGoal] = useState<number>(1_000_000);
  const chartRef = useRef<HTMLDivElement>(null);
  /* Item 3: AI text field for natural language parameter input */
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  /* Fix 17: Generated scenario description with assumptions */
  const [scenarioDescription, setScenarioDescription] = useState<string>("");

  /* Item 3: Parse natural language into simulation parameters
     Logic extracted to @/lib/hockeyStickAiParser.ts for modularity */
  const handleAiPrompt = useCallback(() => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    const result = parseAiPrompt(aiPrompt);
    setParams(prev => ({ ...prev, ...result.updates }));
    setScenarioDescription(result.description);
    toast.success(`Szenario erstellt — ${result.parsed.length} erkannt, ${result.assumed.length} marktüblich angenommen`);
    setAiPrompt("");
    setAiLoading(false);
  }, [aiPrompt]);

  const data = useMemo(() => simulate(params), [params]);
  const compareData = useMemo(() => compareParams ? simulate(compareParams) : null, [compareParams]);

  const updateParam = useCallback(<K extends keyof SimParams>(key: K, value: SimParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setParams(DEFAULT_PARAMS), []);
  const last = data[data.length - 1];
  const first = data[0];

  const primaryNetWorth = showRealValues ? last.realNetWorth : last.netWorth;
  const secondaryNetWorth = showRealValues ? last.netWorth : last.realNetWorth;
  const primaryNetWorthLabel = showRealValues ? "Real" : "Nominal";
  const secondaryNetWorthLabel = showRealValues ? "Nominal" : "Real";
  /* STRONG-15: NaN/Infinity guard on totalReturn — prevents broken display if totalInvested is 0 or corrupt */
  const rawTotalReturn = first.totalInvested > 0
    ? ((last.netWorth - first.totalInvested) / first.totalInvested * 100)
    : 0;
  const totalReturn = Number.isFinite(rawTotalReturn) ? rawTotalReturn : 0;

  /* FEAT-17: Hockey Stick inflection point detection */
  const inflectionYear = useMemo(() => {
    for (let i = 2; i < data.length; i++) {
      const pg = data[i - 1].netWorth - data[i - 2].netWorth;
      const cg = data[i].netWorth - data[i - 1].netWorth;
      if (cg > pg * 1.5 && cg > 10000) return data[i].year;
    }
    return null;
  }, [data]);

  /* FEAT-18: Break-even milestone */
  const breakEvenYear = useMemo(() => {
    for (const d of data) {
      if (d.netWorth > d.totalInvested && d.year > 0) return d.year;
    }
    return null;
  }, [data]);

  /* FEAT-19: Debt-free milestone */
  const debtFreeYear = useMemo(() => {
    for (const d of data) {
      if (d.debtRemaining <= 0 && d.year > 0) return d.year;
    }
    return null;
  }, [data]);

  /* FEAT-20: Financial freedom milestone — only meaningful when monthlyInvestment > 0 */
  const financialFreedomYear = useMemo(() => {
    if (params.monthlyInvestment <= 0) return null;
    const threshold = params.monthlyInvestment * 3;
    for (const d of data) {
      if (d.monthlyNetRent >= threshold && d.year > 0) return d.year;
    }
    return null;
  }, [data, params.monthlyInvestment]);

  /* FEAT-21: CAGR calculation */
  const cagr = useMemo(() => {
    if (params.years <= 0 || first.totalInvested <= 0) return 0;
    const r = last.netWorth / first.totalInvested;
    return r > 0 ? (Math.pow(r, 1 / params.years) - 1) * 100 : 0;
  }, [last, first, params.years]);

  /* FEAT-22: Max drawdown calculation */
  const maxDrawdown = useMemo(() => {
    let peak = data[0].netWorth;
    let maxDd = 0;
    for (const d of data) {
      if (d.netWorth > peak) peak = d.netWorth;
      const dd = peak > 0 ? ((peak - d.netWorth) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }
    return Math.round(maxDd * 10) / 10;
  }, [data]);

  /* FEAT-41: Net worth goal year (real/nominal depending on toggle) */
  const goalYear = useMemo(() => {
    if (!netWorthGoal || netWorthGoal <= 0) return null;
    for (const d of data) {
      const v = showRealValues ? d.realNetWorth : d.netWorth;
      if (v >= netWorthGoal && d.year > 0) return d.year;
    }
    return null;
  }, [data, netWorthGoal, showRealValues]);

  /* FEAT-23: Sensitivity analysis data */
  const sensitivityData = useMemo(() => {
    if (!showSensitivity) return [];
    const base = params[sensitivityKey] as number;
    const step = base * 0.1 || 0.5;
    const vars = Array.from({ length: 9 }, (_, i) =>
      Math.round(Math.max(0, base - 4 * step + i * step) * 100) / 100
    );
    return sensitivityAnalysis(params, sensitivityKey, vars);
  }, [showSensitivity, sensitivityKey, params]);

  /* FEAT-24: Profile save */
  const saveProfile = useCallback(() => {
    if (!profileName.trim()) { toast.error("Bitte einen Namen eingeben"); return; }
    const p: SavedProfile = { name: profileName.trim(), params, savedAt: new Date().toISOString() };
    const u = [...savedProfiles.filter(x => x.name !== p.name), p];
    setSavedProfiles(u);
    saveProfilesStore(u);
    setProfileName("");
    toast.success(`Profil "${p.name}" gespeichert`);
  }, [profileName, params, savedProfiles]);

  /* FEAT-25: Profile load — merge with defaults to handle profiles saved before new fields were added */
  const loadProfile = useCallback((p: SavedProfile) => {
    setParams({ ...DEFAULT_PARAMS, ...p.params });
    toast.success(`Profil "${p.name}" geladen`);
  }, []);

  /* FEAT-26: Profile delete */
  const deleteProfile = useCallback((name: string) => {
    const u = savedProfiles.filter(p => p.name !== name);
    setSavedProfiles(u);
    saveProfilesStore(u);
    toast.success("Profil gel\u00f6scht");
  }, [savedProfiles]);

  /* FEAT-27: Scenario quick-apply */
  const applyScenario = useCallback((s: Scenario) => {
    setParams(prev => ({ ...prev, ...s.params }));
    toast.success(`Szenario "${s.name}" angewendet`);
  }, []);

  /* FEAT-28: Comparison mode */
  const setAsComparison = useCallback(() => {
    setCompareParams({ ...params });
    setChartView("comparison");
    toast.success("Als Vergleich gespeichert");
  }, [params]);

  /* FEAT-29: CSV export */
  const exportCSV = useCallback(() => {
    const h = "Jahr;Portfoliowert;EK;Investiert;Miete;Netto;Schulden;LTV;CoC;Immobilien;Monatl.Miete;Instandhaltung;Real\n";
    const r = data.map(d =>
      `${d.year};${d.portfolioValue};${d.equity};${d.totalInvested};${d.rentalIncome};${d.netWorth};${d.debtRemaining};${d.ltv};${d.cashOnCash};${d.numberOfProperties};${d.monthlyNetRent};${d.cumulativeMaintenance};${d.realNetWorth}`
    ).join("\n");
    const b = new Blob(["\uFEFF" + h + r], { type: "text/csv;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = `hockey-stick-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
    toast.success("CSV exportiert");
  }, [data]);

  /* FEAT-30: PDF export */
  const exportPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(18);
    doc.text("Hockey Stick Simulator \u2014 Bericht", 14, 15);
    doc.setFontSize(9);
    doc.text(`Erstellt: ${new Date().toLocaleString("de-DE")}`, 14, 22);
    doc.setFontSize(12);
    doc.text("Zusammenfassung", 14, 32);
    doc.setFontSize(9);
    const summaryLines = [
      `Nettoverm\u00f6gen nach ${params.years} Jahren: ${formatCurrency(last.netWorth)}`,
      `Real (inflationsbereinigt): ${formatCurrency(last.realNetWorth)}`,
      `Portfoliowert: ${formatCurrency(last.portfolioValue)}`,
      `Gesamtrendite: ${totalReturn.toFixed(1)}% | CAGR: ${cagr.toFixed(1)}%`,
      `Kum. Mieteinnahmen: ${formatCurrency(last.rentalIncome)}`,
      `Restschuld: ${formatCurrency(last.debtRemaining)}`,
      `Immobilien: ${last.numberOfProperties} | LTV: ${last.ltv}%`,
      netWorthGoal > 0 ? `Ziel: ${formatCurrency(netWorthGoal)}${goalYear !== null ? ` (Jahr ${goalYear})` : ""}` : "",
      inflectionYear !== null ? `Hockey Stick ab Jahr ${inflectionYear}` : "",
      breakEvenYear !== null ? `Break-Even: Jahr ${breakEvenYear}` : "",
      debtFreeYear !== null ? `Schuldenfrei: Jahr ${debtFreeYear}` : "",
    ].filter(Boolean);
    summaryLines.forEach((l, i) => doc.text(l, 14, 38 + i * 5));
    let ty = 38 + summaryLines.length * 5 + 12;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    ["Jahr", "Portfolio", "EK", "Investiert", "Miete", "Netto", "Schulden", "LTV"].forEach((c, i) =>
      doc.text(c, 14 + i * 30, ty)
    );
    ty += 4;
    doc.setFont("helvetica", "normal");
    for (const d of data) {
      if (ty > 190) { doc.addPage(); ty = 15; }
      [String(d.year), formatCurrencyCompact(d.portfolioValue), formatCurrencyCompact(d.equity),
        formatCurrencyCompact(d.totalInvested), formatCurrencyCompact(d.rentalIncome),
        formatCurrencyCompact(d.netWorth), formatCurrencyCompact(d.debtRemaining), `${d.ltv}%`
      ].forEach((v, i) => doc.text(v, 14 + i * 30, ty));
      ty += 4;
    }
    doc.save(`hockey-stick-bericht-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exportiert");
  }, [data, params, last, totalReturn, cagr, netWorthGoal, goalYear, inflectionYear, breakEvenYear, debtFreeYear]);

  /* FEAT-31: Copy summary to clipboard */
  const copySummary = useCallback(() => {
    const lines = [
      `Hockey Stick \u2014 ${params.years} Jahre`,
      `Nettoverm\u00f6gen: ${formatCurrency(last.netWorth)}`,
      `Real (inflationsbereinigt): ${formatCurrency(last.realNetWorth)}`,
      `Portfoliowert: ${formatCurrency(last.portfolioValue)}`,
      `Rendite: ${totalReturn.toFixed(1)}% | CAGR: ${cagr.toFixed(1)}%`,
      `Mieteinnahmen: ${formatCurrency(last.rentalIncome)}`,
      netWorthGoal > 0 ? `Ziel: ${formatCurrency(netWorthGoal)}${goalYear !== null ? ` (Jahr ${goalYear})` : ""}` : "",
      inflectionYear !== null ? `Hockey Stick ab Jahr ${inflectionYear}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines).then(
      () => toast.success("Kopiert"),
      () => toast.error("Kopieren fehlgeschlagen — kein Clipboard-Zugriff")
    );
  }, [params.years, last, totalReturn, cagr, netWorthGoal, goalYear, inflectionYear]);

  /* FEAT-32: Share simulation link */
  const shareSimulation = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}?sim=${btoa(JSON.stringify(params))}`).then(
      () => toast.success("Link kopiert"),
      () => toast.error("Kopieren fehlgeschlagen — kein Clipboard-Zugriff")
    );
  }, [params]);

  /* FEAT-33: Export profiles as JSON */
  const exportProfilesJSON = useCallback(() => {
    const b = new Blob([JSON.stringify(savedProfiles, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = "hockey-stick-profiles.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
    toast.success("Profile exportiert");
  }, [savedProfiles]);

  /* FEAT-34: Annual cashflow chart data */
  const annualCFData = useMemo(() => data.filter(d => d.year > 0).map(d => ({
    year: d.label,
    cashflow: d.annualCashflow,
    maintenance: d.year > 0
      ? Math.round(d.cumulativeMaintenance - (data[d.year - 1]?.cumulativeMaintenance || 0))
      : 0,
  })), [data]);

  /* FEAT-35: Debt/equity chart data */
  const debtData = useMemo(() => data.map(d => ({
    year: d.label, debt: d.debtRemaining, equity: d.equity, ltv: d.ltv,
  })), [data]);

  /* FEAT-36: Basic parameter sliders */
  const basicSliders: { key: keyof SimParams; label: string; min: number; max: number; step: number; unit: string; fmt?: (v: number) => string }[] = [
    { key: "startCapital", label: "Startkapital", min: 10000, max: 1000000, step: 5000, unit: "\u20ac", fmt: v => formatCurrency(v) },
    { key: "monthlyInvestment", label: "Monatliche Investition", min: 100, max: 10000, step: 100, unit: "\u20ac", fmt: v => formatCurrency(v) },
    { key: "annualAppreciation", label: "Wertsteigerung p.a.", min: 0, max: 10, step: 0.5, unit: "%" },
    { key: "rentYield", label: "Mietrendite p.a.", min: 1, max: 12, step: 0.5, unit: "%" },
    { key: "annualReturn", label: "Zinssatz (Darlehen)", min: 1, max: 10, step: 0.25, unit: "%" },
    { key: "leverageRatio", label: "Fremdkapitalquote", min: 0, max: 90, step: 5, unit: "%" },
    { key: "taxRate", label: "Steuersatz", min: 0, max: 45, step: 1, unit: "%" },
    { key: "inflationRate", label: "Inflation", min: 0, max: 8, step: 0.5, unit: "%" },
    { key: "maintenancePct", label: "Instandhaltung p.a.", min: 0, max: 5, step: 0.5, unit: "%" },
    { key: "years", label: "Simulationsdauer", min: 5, max: 50, step: 1, unit: " Jahre" },
  ];

  /* FEAT-37: Advanced parameter sliders */
  const advSliders: typeof basicSliders = [
    { key: "vacancyRate", label: "Leerstandsquote", min: 0, max: 15, step: 0.5, unit: "%" },
    { key: "rentGrowthRate", label: "Mietsteigerung p.a.", min: 0, max: 5, step: 0.25, unit: "%" },
    { key: "managementFee", label: "Verwaltungskosten", min: 0, max: 15, step: 0.5, unit: "%" },
    { key: "insurancePct", label: "Versicherung p.a.", min: 0, max: 2, step: 0.1, unit: "%" },
    { key: "additionalProperties", label: "Zus\u00e4tzliche Immobilien", min: 0, max: 10, step: 1, unit: "" },
    { key: "propertyPurchaseInterval", label: "Kaufintervall (Jahre)", min: 1, max: 10, step: 1, unit: " J." },
    { key: "renovationBudgetPct", label: "Renovierungsbudget p.a.", min: 0, max: 5, step: 0.25, unit: "%" },
  ];

  const sensKeys: { key: keyof SimParams; label: string }[] = [
    { key: "annualAppreciation", label: "Wertsteigerung" },
    { key: "rentYield", label: "Mietrendite" },
    { key: "annualReturn", label: "Zinssatz" },
    { key: "leverageRatio", label: "FK-Quote" },
    { key: "inflationRate", label: "Inflation" },
    { key: "vacancyRate", label: "Leerstand" },
  ];

  const renderSlider = (s: typeof basicSliders[0]) => {
    const val = params[s.key] as number;
    return (
      <div key={s.key} className="space-y-1.5">
        <div className="flex justify-between">
          <Label className="text-xs">{s.label}</Label>
          <span className="text-xs font-medium">{s.fmt ? s.fmt(val) : `${val}${s.unit}`}</span>
        </div>
        <Slider value={[val]} min={s.min} max={s.max} step={s.step} onValueChange={v => updateParam(s.key, v[0])} />
      </div>
    );
  };

  const simulatorContent = (
    <div className="space-y-4">
          {/* Item 3: AI-Textfeld for natural language parameter input */}
          <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> KI-Assistent
            </div>
            <div className="flex gap-2">
              <Textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder='Beschreibe dein Szenario, z.B. "50k Eigenkapital, 1000€ monatlich, 4% Rendite, 20 Jahre, konservativ"'
                className="min-h-[40px] max-h-[80px] text-xs resize-none flex-1"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiPrompt(); } }}
              />
              <Button
                variant="default"
                size="sm"
                className="h-10 px-3 shrink-0"
                onClick={handleAiPrompt}
                disabled={aiLoading || !aiPrompt.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Fix 17: Scenario description generated by AI — replaces preset scenario buttons */}
          {scenarioDescription && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-line">
              {scenarioDescription}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nettovermögen ({primaryNetWorthLabel})</p>
              <p className="text-sm font-bold text-profit mt-1">{formatCurrencyCompact(primaryNetWorth)}</p>
              <p className="text-[9px] text-muted-foreground">{secondaryNetWorthLabel}: {formatCurrencyCompact(secondaryNetWorth)}</p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Portfoliowert</p>
              <p className="text-sm font-bold mt-1">{formatCurrencyCompact(last.portfolioValue)}</p>
              <p className="text-[9px] text-muted-foreground">
                {last.numberOfProperties} Immobilie{last.numberOfProperties > 1 ? "n" : ""}
              </p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gesamtrendite</p>
              <p className={`text-sm font-bold mt-1 ${totalReturn >= 0 ? "text-profit" : "text-loss"}`}>
                {totalReturn.toFixed(0)}%
              </p>
              <p className="text-[9px] text-muted-foreground">CAGR: {cagr.toFixed(1)}%</p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monatl. Cashflow</p>
              <p className={`text-sm font-bold mt-1 ${last.monthlyNetRent >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(last.monthlyNetRent)}
              </p>
              <p className="text-[9px] text-muted-foreground">Cash-on-Cash: {last.cashOnCash}%</p>
            </div>
          </div>

          {/* Fix 17: Removed Nominalwerte toggle and Ziel field — user controls everything via sliders/AI */}

          {/* Milestone badges */}
          <div className="flex gap-2 flex-wrap">
            {inflectionYear !== null && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 border-primary/20 text-primary">
                <Zap className="h-3 w-3" /> Hockey Stick ab Jahr {inflectionYear}
              </Badge>
            )}
            {breakEvenYear !== null && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-profit/10 border-profit/20 text-profit">
                <Target className="h-3 w-3" /> Break-Even: Jahr {breakEvenYear}
              </Badge>
            )}
            {debtFreeYear !== null && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-profit/10 border-profit/20 text-profit">
                <Check className="h-3 w-3" /> Schuldenfrei: Jahr {debtFreeYear}
              </Badge>
            )}
            {financialFreedomYear !== null && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Euro className="h-3 w-3" /> Fin. Freiheit: Jahr {financialFreedomYear}
              </Badge>
            )}
            {maxDrawdown > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <AlertTriangle className="h-3 w-3" /> Max. Drawdown: {maxDrawdown}%
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] gap-1">
              <Building2 className="h-3 w-3" /> LTV: {last.ltv}%
            </Badge>
          </div>

          {/* Chart view selector */}
          <div className="flex gap-1 border-b border-border pb-2 overflow-x-auto">
            {([
              { id: "growth" as ChartView, label: "Wachstum", Ic: TrendingUp },
              { id: "cashflow" as ChartView, label: "Cashflow", Ic: BarChart3 },
              { id: "debt" as ChartView, label: "Schulden/EK", Ic: PieChart },
              { id: "comparison" as ChartView, label: "Vergleich", Ic: BarChart3 },
              { id: "table" as ChartView, label: "Tabelle", Ic: Table },
            ]).map(v => (
              <Button
                key={v.id}
                variant={chartView === v.id ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[10px] gap-1 px-2 shrink-0"
                onClick={() => setChartView(v.id)}
              >
                <v.Ic className="h-3 w-3" /> {v.label}
              </Button>
            ))}
          </div>

          {/* Charts */}
          <div ref={chartRef} className="h-56 sm:h-64">
            {chartView === "growth" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="hsNW" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--profit))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="hsPV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={55} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    formatter={(v: number, name: string) => {
                      const labels: Record<string, string> = {
                        netWorth: "Nettoverm\u00f6gen",
                        portfolioValue: "Portfoliowert",
                        totalInvested: "Investiert",
                        realNetWorth: "Real (inflationsber.)",
                      };
                      return [formatCurrency(v), labels[name] || name];
                    }}
                  />
                  {inflectionYear !== null && (
                    <ReferenceLine
                      x={`Jahr ${inflectionYear}`}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="3 3"
                      label={{ value: "Hockey Stick", fontSize: 10, fill: "hsl(var(--primary))" }}
                    />
                  )}
                  <Area type="monotone" dataKey="totalInvested" stroke="hsl(var(--muted-foreground))" fill="none" strokeWidth={1} strokeDasharray="4 4" name="totalInvested" />
                  <Area type="monotone" dataKey="portfolioValue" stroke="hsl(var(--primary))" fill="url(#hsPV)" strokeWidth={1.5} name="portfolioValue" />

                  {netWorthGoal > 0 && (
                    <ReferenceLine
                      y={netWorthGoal}
                      stroke="hsl(45, 93%, 47%)"
                      strokeDasharray="3 3"
                      label={{ value: "Ziel", fontSize: 10, fill: "hsl(45, 93%, 47%)" }}
                    />
                  )}

                  {showRealValues ? (
                    <>
                      <Area type="monotone" dataKey="netWorth" stroke="hsl(var(--muted-foreground))" fill="none" strokeWidth={1} strokeDasharray="2 2" opacity={0.35} name="netWorth" />
                      <Area type="monotone" dataKey="realNetWorth" stroke="hsl(var(--profit))" fill="url(#hsNW)" strokeWidth={2} name="realNetWorth" />
                    </>
                  ) : (
                    <>
                      <Area type="monotone" dataKey="realNetWorth" stroke="hsl(45, 93%, 47%)" fill="none" strokeWidth={1} strokeDasharray="2 2" name="realNetWorth" />
                      <Area type="monotone" dataKey="netWorth" stroke="hsl(var(--profit))" fill="url(#hsNW)" strokeWidth={2} name="netWorth" />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}

            {chartView === "cashflow" && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualCFData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={55} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    formatter={(v: number, name: string) => [formatCurrency(v), name === "cashflow" ? "Netto-Cashflow" : "Instandhaltung"]}
                  />
                  <Bar dataKey="cashflow" fill="hsl(var(--profit))" radius={[4, 4, 0, 0]} name="cashflow" />
                  <Bar dataKey="maintenance" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.5} name="maintenance" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartView === "debt" && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={debtData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={55} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} tickLine={false} axisLine={false} width={40} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
                  <Area yAxisId="left" type="monotone" dataKey="equity" fill="hsl(var(--profit))" fillOpacity={0.2} stroke="hsl(var(--profit))" strokeWidth={2} name="Eigenkapital" />
                  <Area yAxisId="left" type="monotone" dataKey="debt" fill="hsl(var(--destructive))" fillOpacity={0.1} stroke="hsl(var(--destructive))" strokeWidth={1.5} name="Restschuld" />
                  <Line yAxisId="right" type="monotone" dataKey="ltv" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="LTV %" />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {chartView === "comparison" && compareData && (() => {
              const mergedData = data.map((d, i) => ({
                ...d,
                compareNetWorth: compareData[i]?.netWorth ?? null,
              }));
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mergedData}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={55} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                      formatter={(v: number, name: string) => {
                        const labels: Record<string, string> = { netWorth: "Aktuell", compareNetWorth: "Vergleich" };
                        return [formatCurrency(v), labels[name] || name];
                      }}
                    />
                    <Area type="monotone" dataKey="compareNetWorth" stroke="hsl(var(--muted-foreground))" fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="compareNetWorth" />
                    <Area type="monotone" dataKey="netWorth" stroke="hsl(var(--profit))" fill="none" strokeWidth={2} name="netWorth" />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })()}

            {chartView === "comparison" && !compareData && (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-8 w-8 mx-auto opacity-30" />
                  <p>Klicke "Als Vergleich" um Szenarien zu vergleichen</p>
                </div>
              </div>
            )}

            {chartView === "table" && (
              <div className="h-full overflow-auto">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left p-1 font-medium">Jahr</th>
                      <th className="text-right p-1 font-medium">Portfolio</th>
                      <th className="text-right p-1 font-medium">EK</th>
                      <th className="text-right p-1 font-medium">Investiert</th>
                      <th className="text-right p-1 font-medium">Netto</th>
                      <th className="text-right p-1 font-medium">Real</th>
                      <th className="text-right p-1 font-medium">Schulden</th>
                      <th className="text-right p-1 font-medium">LTV</th>
                      <th className="text-right p-1 font-medium">CoC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(d => (
                      <tr key={d.year} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="p-1 font-medium">{d.year}</td>
                        <td className="p-1 text-right">{formatCurrencyCompact(d.portfolioValue)}</td>
                        <td className="p-1 text-right">{formatCurrencyCompact(d.equity)}</td>
                        <td className="p-1 text-right">{formatCurrencyCompact(d.totalInvested)}</td>
                        <td className={`p-1 text-right ${d.netWorth >= d.totalInvested ? "text-profit" : "text-loss"}`}>
                          {formatCurrencyCompact(d.netWorth)}
                        </td>
                        <td className="p-1 text-right text-muted-foreground">{formatCurrencyCompact(d.realNetWorth)}</td>
                        <td className="p-1 text-right">{formatCurrencyCompact(d.debtRemaining)}</td>
                        <td className="p-1 text-right">{d.ltv}%</td>
                        <td className="p-1 text-right">{d.cashOnCash}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sensitivity analysis */}
          {showSensitivity && (
            <div className="space-y-2 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold">Sensitivit&#228;tsanalyse</h4>
                <Select value={sensitivityKey} onValueChange={v => setSensitivityKey(v as keyof SimParams)}>
                  <SelectTrigger className="h-7 w-32 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sensKeys.map(o => (
                      <SelectItem key={o.key} value={o.key} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sensitivityData}>
                    <XAxis dataKey="variation" tick={{ fontSize: 9 }} tickFormatter={v => `${Number(v).toFixed(1)}%`} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={50} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [formatCurrency(v), "Nettoverm\u00f6gen"]} />
                    <Bar dataKey="netWorth" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sliders */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" /> Parameter anpassen
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {basicSliders.map(renderSlider)}
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] w-full" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? "Erweiterte Parameter ausblenden" : "Erweiterte Parameter anzeigen"} ({advSliders.length})
            </Button>
            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                {advSliders.map(renderSlider)}
              </div>
            )}
          </div>

          {/* Save/Load profiles */}
          <div className="space-y-2 border-t border-border pt-3">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5" /> Profile speichern &amp; laden
            </h4>
            <div className="flex gap-2">
              <Input
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Profilname..."
                className="h-8 text-xs flex-1"
              />
              <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px]" onClick={saveProfile}>
                <Save className="h-3 w-3" /> Speichern
              </Button>
            </div>
            {savedProfiles.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {savedProfiles.map(p => (
                  <div key={p.name} className="flex items-center gap-1 bg-secondary/30 rounded px-2 py-1">
                    <button className="text-[10px] font-medium hover:text-primary" onClick={() => loadProfile(p)}>
                      {p.name}
                    </button>
                    <button className="text-[10px] text-muted-foreground hover:text-destructive" onClick={() => deleteProfile(p.name)}>
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-[10px]">
              <RotateCcw className="h-3.5 w-3.5" /> Zur&#252;cksetzen
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-[10px]">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5 text-[10px]">
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={copySummary} className="gap-1.5 text-[10px]">
              <Copy className="h-3.5 w-3.5" /> Kopieren
            </Button>
            <Button variant="outline" size="sm" onClick={shareSimulation} className="gap-1.5 text-[10px]">
              <Share2 className="h-3.5 w-3.5" /> Teilen
            </Button>
            <Button variant="outline" size="sm" onClick={setAsComparison} className="gap-1.5 text-[10px]">
              <BarChart3 className="h-3.5 w-3.5" /> Als Vergleich
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSensitivity(!showSensitivity)} className="gap-1.5 text-[10px]">
              <Calculator className="h-3.5 w-3.5" /> Sensitivit&#228;t
            </Button>
            {savedProfiles.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportProfilesJSON} className="gap-1.5 text-[10px]">
                <Upload className="h-3.5 w-3.5" /> Profile exportieren
              </Button>
            )}
          </div>
        </div>
  );

  /* Embedded mode — render inline without Dialog wrapper */
  if (embedded) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hockey Stick Simulator</h1>
            <p className="text-sm text-muted-foreground">Simuliere den exponentiellen Verm\u00f6gensaufbau deines Immobilienportfolios</p>
          </div>
        </div>
        {simulatorContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Hockey Stick Simulator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Hockey Stick Simulator
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Simuliere den exponentiellen Verm\u00f6gensaufbau deines Immobilienportfolios
          </p>
        </DialogHeader>
        {simulatorContent}
      </DialogContent>
    </Dialog>
  );
}

export default HockeyStickSimulator;
