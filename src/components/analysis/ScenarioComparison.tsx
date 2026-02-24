import { useMemo } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useAnalysisCalculations, type AnalysisInputState } from "@/hooks/useAnalysisCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

interface Props {
  currentInputs: AnalysisInputState;
  savedScenarios: { name: string; inputs: AnalysisInputState }[];
}

const DeltaIcon = ({ current, value }: { current: number; value: number }) => {
  const diff = value - current;
  if (Math.abs(diff) < 0.01) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return diff > 0 ? <ArrowUp className="h-3 w-3 text-profit" /> : <ArrowDown className="h-3 w-3 text-loss" />;
};

const ScenarioRow = ({ label, values, currentValue, format, colorize, higherIsBetter = true }: {
  label: string; values: (string | number)[]; currentValue?: number; format?: "currency" | "percent"; colorize?: boolean; higherIsBetter?: boolean;
}) => (
  <tr className="border-b border-border/50 last:border-0">
    <td className="py-2 pr-4 text-muted-foreground text-xs">{label}</td>
    {values.map((v, i) => (
      <td key={i} className={`py-2 px-2 text-right text-sm font-medium ${colorize && typeof v === "number" ? (v >= 0 ? "text-profit" : "text-loss") : ""}`}>
        <div className="flex items-center justify-end gap-1">
          {typeof v === "number" && i > 0 && currentValue !== undefined && (
            <DeltaIcon current={currentValue} value={v} />
          )}
          {typeof v === "number"
            ? format === "currency" ? formatCurrency(v) : format === "percent" ? `${v.toFixed(2)}%` : v.toFixed(1)
            : v}
        </div>
      </td>
    ))}
  </tr>
);

const ScenarioComparison = ({ currentInputs, savedScenarios }: Props) => {
  const currentCalc = useAnalysisCalculations(currentInputs);

  const optimisticInputs = useMemo(() => ({
    ...currentInputs,
    monatlicheMiete: currentInputs.monatlicheMiete * 1.15,
    zinssatz: Math.max(0.5, currentInputs.zinssatz - 0.5),
  }), [currentInputs]);
  const optimisticCalc = useAnalysisCalculations(optimisticInputs);

  const pessimisticInputs = useMemo(() => ({
    ...currentInputs,
    monatlicheMiete: currentInputs.monatlicheMiete * 0.85,
    zinssatz: currentInputs.zinssatz + 1.0,
    bewirtschaftungskosten: currentInputs.bewirtschaftungskosten * 1.2,
  }), [currentInputs]);
  const pessimisticCalc = useAnalysisCalculations(pessimisticInputs);

  const scenarios = [
    { name: "Aktuell", calc: currentCalc, inputs: currentInputs },
    { name: "Best Case", calc: optimisticCalc, inputs: optimisticInputs },
    { name: "Worst Case", calc: pessimisticCalc, inputs: pessimisticInputs },
  ];

  return (
    <div className="space-y-4">
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in overflow-x-auto">
        <h2 className="text-sm font-semibold mb-2">Szenario-Vergleich</h2>
        <p className="text-xs text-muted-foreground mb-4">Best Case: +15% Miete, -0.5% Zins · Worst Case: -15% Miete, +1% Zins, +20% Kosten</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-xs text-muted-foreground">Kennzahl</th>
              {scenarios.map((s, i) => (
                <th key={i} className={`text-right py-2 px-2 text-xs font-semibold ${
                  i === 1 ? "text-profit" : i === 2 ? "text-loss" : ""
                }`}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ScenarioRow label="Brutto-Rendite" values={scenarios.map(s => s.calc.bruttoRendite)} currentValue={currentCalc.bruttoRendite} format="percent" />
            <ScenarioRow label="Netto-Rendite" values={scenarios.map(s => s.calc.nettoRendite)} currentValue={currentCalc.nettoRendite} format="percent" />
            <ScenarioRow label="Cash-on-Cash" values={scenarios.map(s => s.calc.cashOnCash)} currentValue={currentCalc.cashOnCash} format="percent" colorize />
            <ScenarioRow label="Cashflow / Monat" values={scenarios.map(s => s.calc.monatsCashflow)} currentValue={currentCalc.monatsCashflow} format="currency" colorize />
            <ScenarioRow label="Cashflow / Jahr" values={scenarios.map(s => s.calc.jahresCashflow)} currentValue={currentCalc.jahresCashflow} format="currency" colorize />
            <ScenarioRow label="CF nach Steuer / Jahr" values={scenarios.map(s => s.calc.cashflowNachSteuer)} currentValue={currentCalc.cashflowNachSteuer} format="currency" colorize />
            <ScenarioRow label="Mietmultiplikator" values={scenarios.map(s => s.calc.mietmultiplikator)} currentValue={currentCalc.mietmultiplikator} higherIsBetter={false} />
            <ScenarioRow label="Monatl. Rate" values={scenarios.map(s => s.calc.monatlicheRate)} currentValue={currentCalc.monatlicheRate} format="currency" />
          </tbody>
        </table>
      </div>

      {savedScenarios.length > 0 && (
        <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in overflow-x-auto">
          <h2 className="text-sm font-semibold mb-4">Gespeicherte Szenarien</h2>
          <div className="grid gap-3">
            {savedScenarios.map((s, i) => (
              <SavedScenarioCard key={i} scenario={s} currentCalc={currentCalc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SavedScenarioCard = ({ scenario, currentCalc }: { scenario: { name: string; inputs: AnalysisInputState }; currentCalc: ReturnType<typeof useAnalysisCalculations> }) => {
  const calc = useAnalysisCalculations(scenario.inputs);
  return (
    <div className="bg-secondary/50 rounded-lg p-3">
      <div className="font-medium text-sm mb-2">{scenario.name}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Kaufpreis</span>
          <div className="font-medium">{formatCurrency(scenario.inputs.kaufpreis)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Brutto</span>
          <div className="font-medium flex items-center gap-1">
            <DeltaIcon current={currentCalc.bruttoRendite} value={calc.bruttoRendite} />
            {calc.bruttoRendite.toFixed(2)}%
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">CF/M</span>
          <div className={`font-medium flex items-center gap-1 ${calc.monatsCashflow >= 0 ? "text-profit" : "text-loss"}`}>
            <DeltaIcon current={currentCalc.monatsCashflow} value={calc.monatsCashflow} />
            {formatCurrency(calc.monatsCashflow)}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">CoC</span>
          <div className={`font-medium flex items-center gap-1 ${calc.cashOnCash >= 0 ? "text-profit" : "text-loss"}`}>
            <DeltaIcon current={currentCalc.cashOnCash} value={calc.cashOnCash} />
            {calc.cashOnCash.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenarioComparison;
