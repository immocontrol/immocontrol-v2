import { useState, useCallback, useEffect, useMemo } from "react";
import { Calculator, RotateCcw, Save, FolderOpen, Trash2, Copy, Target, BarChart3, TrendingUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AnalysisInputs from "@/components/analysis/AnalysisInputs";
import AnalysisResults from "@/components/analysis/AnalysisResults";
import AmortizationChart from "@/components/analysis/AmortizationChart";
import ScenarioComparison from "@/components/analysis/ScenarioComparison";
import SensitivityAnalysis from "@/components/analysis/SensitivityAnalysis";
import RatingTrafficLight from "@/components/analysis/RatingTrafficLight";
import TargetRentCalculator from "@/components/analysis/TargetRentCalculator";
import ExposeImport from "@/components/analysis/ExposeImport";
import PdfImport from "@/components/analysis/PdfImport";
import ExposeHistory from "@/components/analysis/ExposeHistory";
/* BUG-3: Import PortfolioHealthScore to integrate into Analyse section */
import PortfolioHealthScore from "@/components/PortfolioHealthScore";
import { useProperties } from "@/context/PropertyContext";
import { useAnalysisCalculations, type AnalysisInputState, DEFAULT_INPUTS } from "@/hooks/useAnalysisCalculations";

const AnalysisCalculator = () => {
  useEffect(() => { document.title = "Objektanalyse – ImmoControl"; }, []);
  /* BUG-3: Get portfolio stats for Portfolio Gesundheit integration */
  const { properties, stats } = useProperties();
  const [inputs, setInputs] = useState<AnalysisInputState>(DEFAULT_INPUTS);
  const [savedScenarios, setSavedScenarios] = useState<{ name: string; inputs: AnalysisInputState }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("immo-scenarios") || "[]");
    } catch { return []; }
  });
  const [scenarioName, setScenarioName] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "amortization" | "scenarios" | "sensitivity">("overview");

  const calc = useAnalysisCalculations(inputs);

  const updateInput = useCallback(<K extends keyof AnalysisInputState>(key: K, value: AnalysisInputState[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetInputs = useCallback(() => setInputs(DEFAULT_INPUTS), []);

  const importFromExpose = useCallback((updates: Partial<AnalysisInputState>) => {
    setInputs(prev => ({ ...prev, ...updates }));
  }, []);

  // Feature 5: Save/Load scenarios
  const saveScenario = useCallback(() => {
    const name = scenarioName.trim() || `Szenario ${savedScenarios.length + 1}`;
    const updated = [...savedScenarios, { name, inputs }];
    setSavedScenarios(updated);
    localStorage.setItem("immo-scenarios", JSON.stringify(updated));
    setScenarioName("");
    toast.success(`"${name}" gespeichert`);
  }, [inputs, savedScenarios, scenarioName]);

  const loadScenario = useCallback((idx: number) => {
    setInputs(savedScenarios[idx].inputs);
    toast.success(`"${savedScenarios[idx].name}" geladen`);
  }, [savedScenarios]);

  const deleteScenario = useCallback((idx: number) => {
    const updated = savedScenarios.filter((_, i) => i !== idx);
    setSavedScenarios(updated);
    localStorage.setItem("immo-scenarios", JSON.stringify(updated));
    toast.success("Szenario gelöscht");
  }, [savedScenarios]);

  // Feature 10: Copy results
  const copyResults = useCallback(() => {
    const text = `ImmoControl Objektanalyse
━━━━━━━━━━━━━━━━━━━━━━
Kaufpreis: ${inputs.kaufpreis.toLocaleString("de-DE")} €
Gesamtkosten: ${calc.gesamtkosten.toLocaleString("de-DE")} €
Bundesland: ${inputs.bundesland}
Wohnfläche: ${inputs.quadratmeter} m²
━━━ Rendite ━━━
Brutto-Rendite: ${calc.bruttoRendite.toFixed(2)}%
Netto-Rendite: ${calc.nettoRendite.toFixed(2)}%
Cash-on-Cash: ${calc.cashOnCash.toFixed(2)}%
Mietmultiplikator: ${calc.mietmultiplikator.toFixed(1)}x
Preis/m²: ${calc.preisProQm.toLocaleString("de-DE")} €
━━━ Cashflow ━━━
Miete/Monat: ${inputs.monatlicheMiete.toLocaleString("de-DE")} €
Cashflow/Monat: ${calc.monatsCashflow.toLocaleString("de-DE")} €
Cashflow/Jahr: ${calc.jahresCashflow.toLocaleString("de-DE")} €
CF nach Steuer/Jahr: ${calc.cashflowNachSteuer.toLocaleString("de-DE")} €
━━━ Finanzierung ━━━
Eigenkapital: ${inputs.eigenkapital.toLocaleString("de-DE")} €
Darlehen: ${calc.darlehen.toLocaleString("de-DE")} €
Zinssatz: ${inputs.zinssatz}% · Tilgung: ${inputs.tilgung}%
Rate/Monat: ${calc.monatlicheRate.toLocaleString("de-DE")} €`;
    navigator.clipboard.writeText(text);
    toast.success("Ergebnisse kopiert!");
  }, [inputs, calc]);

  // Feature 4: PDF Export
  const exportPDF = useCallback(() => {
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Objektanalyse</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:700px;margin:0 auto}
h1{font-size:22px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
.card{background:#f9f9f9;padding:14px;border-radius:8px}
.label{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px}
.value{font-size:18px;font-weight:700;margin-top:4px}
.positive{color:#2a9d6e}.negative{color:#d94040}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #eee}
th{background:#f5f5f5;font-weight:600}
.footer{margin-top:30px;font-size:10px;color:#bbb;text-align:center}</style></head><body>
<h1>📊 Objektanalyse</h1>
<p style="color:#888;font-size:13px">Erstellt am ${new Date().toLocaleDateString("de-DE")} · ${inputs.bundesland}</p>
<div class="grid">
<div class="card"><div class="label">Kaufpreis</div><div class="value">${inputs.kaufpreis.toLocaleString("de-DE")} €</div></div>
<div class="card"><div class="label">Gesamtkosten</div><div class="value">${calc.gesamtkosten.toLocaleString("de-DE")} €</div></div>
<div class="card"><div class="label">Brutto-Rendite</div><div class="value">${calc.bruttoRendite.toFixed(2)}%</div></div>
<div class="card"><div class="label">Netto-Rendite</div><div class="value">${calc.nettoRendite.toFixed(2)}%</div></div>
<div class="card"><div class="label">Cash-on-Cash</div><div class="value ${calc.cashOnCash >= 0 ? 'positive' : 'negative'}">${calc.cashOnCash.toFixed(2)}%</div></div>
<div class="card"><div class="label">Cashflow/Monat</div><div class="value ${calc.monatsCashflow >= 0 ? 'positive' : 'negative'}">${calc.monatsCashflow.toLocaleString("de-DE")} €</div></div>
<div class="card"><div class="label">CF nach Steuer/Jahr</div><div class="value ${calc.cashflowNachSteuer >= 0 ? 'positive' : 'negative'}">${calc.cashflowNachSteuer.toLocaleString("de-DE")} €</div></div>
<div class="card"><div class="label">Mietmultiplikator</div><div class="value">${calc.mietmultiplikator.toFixed(1)}x</div></div>
</div>
<div class="footer">ImmoControl · Vertraulich</div></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    toast.success("PDF-Export geöffnet");
  }, [inputs, calc]);

  const tabs = [
    { key: "overview" as const, label: "Übersicht", icon: Calculator },
    { key: "amortization" as const, label: "Tilgungsplan", icon: BarChart3 },
    { key: "scenarios" as const, label: "Szenarien", icon: TrendingUp },
    { key: "sensitivity" as const, label: "Sensitivität", icon: Target },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Objektanalyse</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={copyResults}>
            <Copy className="h-3.5 w-3.5" /> Kopieren
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPDF}>
            <BarChart3 className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={resetInputs}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === t.key
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            <t.icon className={`h-3.5 w-3.5 ${activeTab === t.key ? "text-primary" : ""}`} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <ExposeImport onImport={importFromExpose} />
            <PdfImport onImport={importFromExpose} />
            <ExposeHistory onImport={importFromExpose} />
            <AnalysisInputs inputs={inputs} updateInput={updateInput} />

            {/* Feature 5: Save/Load */}
            <div className="gradient-card rounded-xl border border-border p-5 space-y-3 animate-fade-in" style={{ animationDelay: "350ms" }}>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Save className="h-4 w-4 text-muted-foreground" /> Szenarien speichern
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Name..."
                  className="flex-1 bg-secondary text-foreground text-sm rounded-lg px-3 py-1.5 outline-none"
                />
                <Button size="sm" onClick={saveScenario} className="gap-1">
                  <Save className="h-3.5 w-3.5" /> Speichern
                </Button>
              </div>
              {savedScenarios.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {savedScenarios.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-1.5 text-sm">
                      <span className="truncate">{s.name}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => loadScenario(i)}>
                          <FolderOpen className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteScenario(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 md:sticky md:top-20 md:self-start">
            <RatingTrafficLight calc={calc} />
            <AnalysisResults inputs={inputs} calc={calc} />
            <TargetRentCalculator inputs={inputs} />
            {/* BUG-3: Portfolio Gesundheit integrated into Analyse section */}
            {properties.length > 0 && (
              <div className="animate-fade-in" style={{ animationDelay: "500ms" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio-Kontext</span>
                </div>
                <PortfolioHealthScore
                  totalValue={stats.totalValue}
                  totalDebt={stats.totalDebt}
                  totalCashflow={stats.totalCashflow}
                  totalRent={stats.totalRent}
                  totalExpenses={properties.reduce((s, p) => s + (p.monthlyExpenses || 0), 0)}
                  totalCreditRate={properties.reduce((s, p) => s + (p.monthlyCreditRate || 0), 0)}
                  vacancyRate={0}
                  propertyCount={stats.propertyCount}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "amortization" && (
        <AmortizationChart inputs={inputs} calc={calc} />
      )}

      {activeTab === "scenarios" && (
        <ScenarioComparison currentInputs={inputs} savedScenarios={savedScenarios} />
      )}

      {activeTab === "sensitivity" && (
        <SensitivityAnalysis inputs={inputs} />
      )}
    </div>
  );
};

export default AnalysisCalculator;
