import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { BUNDESLAENDER_GRUNDERWERBSTEUER, type AnalysisInputState } from "@/hooks/useAnalysisCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

interface Props {
  inputs: AnalysisInputState;
}

// Improvement 15: Shared helper to calculate cashflow from modified inputs
const calcCashflow = (inputs: AnalysisInputState) => {
  const gest = BUNDESLAENDER_GRUNDERWERBSTEUER[inputs.bundesland] || 5;
  const grunderwerbsteuer = inputs.kaufpreis * (gest / 100);
  const gesamtkosten = inputs.kaufpreis + grunderwerbsteuer + inputs.kaufpreis * (inputs.maklerProvision / 100) + inputs.kaufpreis * (inputs.notarKosten / 100);
  const darlehen = gesamtkosten - inputs.eigenkapital;
  const monatlicheRate = (darlehen * (inputs.zinssatz + inputs.tilgung)) / 100 / 12;
  const cashflow = inputs.monatlicheMiete - inputs.bewirtschaftungskosten - monatlicheRate;
  const bruttoRendite = inputs.kaufpreis > 0 ? (inputs.monatlicheMiete * 12 / inputs.kaufpreis) * 100 : 0;
  return { cashflow: Math.round(cashflow), rate: Math.round(monatlicheRate), bruttoRendite: Math.round(bruttoRendite * 100) / 100 };
};

const tooltipStyle = {
  backgroundColor: "hsl(220,18%,12%)",
  border: "1px solid hsl(220,14%,18%)",
  borderRadius: "8px",
  color: "hsl(210,20%,92%)",
  fontSize: "12px",
};
const tickStyle = { fill: "hsl(215,12%,52%)", fontSize: 11 };

const SensitivityAnalysis = ({ inputs }: Props) => {
  // Sensitivity: vary interest rate
  const interestData = useMemo(() => {
    const results = [];
    for (let rate = 1.0; rate <= 7.0; rate += 0.5) {
      const r = calcCashflow({ ...inputs, zinssatz: rate });
      results.push({ zinssatz: `${rate.toFixed(1)}%`, cashflow: r.cashflow, rate: r.rate, isCurrent: Math.abs(rate - inputs.zinssatz) < 0.01 });
    }
    return results;
  }, [inputs]);

  // Sensitivity: vary purchase price
  const priceData = useMemo(() => {
    const results = [];
    const basePrice = inputs.kaufpreis;
    for (let factor = 0.7; factor <= 1.3; factor += 0.1) {
      const price = Math.round(basePrice * factor);
      const r = calcCashflow({ ...inputs, kaufpreis: price });
      results.push({
        preis: `${(price / 1000).toFixed(0)}k`,
        cashflow: r.cashflow,
        rendite: r.bruttoRendite,
        isCurrent: Math.abs(factor - 1.0) < 0.01,
      });
    }
    return results;
  }, [inputs]);

  // Improvement 16: Rent sensitivity
  const rentData = useMemo(() => {
    const results = [];
    const baseRent = inputs.monatlicheMiete;
    for (let factor = 0.5; factor <= 1.5; factor += 0.1) {
      const rent = Math.round(baseRent * factor);
      const r = calcCashflow({ ...inputs, monatlicheMiete: rent });
      results.push({
        miete: `${rent}€`,
        cashflow: r.cashflow,
        rendite: inputs.kaufpreis > 0 ? Math.round((rent * 12 / inputs.kaufpreis) * 10000) / 100 : 0,
        isCurrent: Math.abs(factor - 1.0) < 0.05,
      });
    }
    return results;
  }, [inputs]);

  // Improvement 17: Break-even summary
  const breakEvenZins = useMemo(() => {
    for (let rate = 0.5; rate <= 10; rate += 0.1) {
      const r = calcCashflow({ ...inputs, zinssatz: rate });
      if (r.cashflow <= 0) return rate;
    }
    return null;
  }, [inputs]);

  const breakEvenPrice = useMemo(() => {
    for (let f = 1.0; f <= 2.0; f += 0.01) {
      const r = calcCashflow({ ...inputs, kaufpreis: Math.round(inputs.kaufpreis * f) });
      if (r.cashflow <= 0) return Math.round(inputs.kaufpreis * f);
    }
    return null;
  }, [inputs]);

  return (
    <div className="space-y-4">
      {/* Improvement 17: Break-even summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
          <div className="text-xs text-muted-foreground">Break-Even Zinssatz</div>
          <div className="text-xl font-bold text-gold">
            {breakEvenZins ? `${breakEvenZins.toFixed(1)}%` : "> 10%"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Ab diesem Zins wird der Cashflow negativ
            {breakEvenZins && <span className="ml-1">(Puffer: +{(breakEvenZins - inputs.zinssatz).toFixed(1)}%)</span>}
          </div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in [animation-delay:50ms]">
          <div className="text-xs text-muted-foreground">Max. Kaufpreis (CF ≥ 0)</div>
          <div className="text-xl font-bold text-gold">
            {breakEvenPrice ? formatCurrency(breakEvenPrice) : "> 2x KP"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Maximaler Kaufpreis bei aktuellem Zins
            {breakEvenPrice && <span className="ml-1">(+{((breakEvenPrice / inputs.kaufpreis - 1) * 100).toFixed(0)}%)</span>}
          </div>
        </div>
      </div>

      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-sm font-semibold mb-4">Zinssensitivität – Cashflow bei verschiedenen Zinssätzen</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={interestData}>
              <XAxis dataKey="zinssatz" axisLine={false} tickLine={false} tick={tickStyle} />
              <YAxis axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === "cashflow" ? "Cashflow/M" : "Rate/M"]} contentStyle={tooltipStyle} />
              <Legend formatter={(v) => v === "cashflow" ? "Cashflow/M" : "Kreditrate/M"} wrapperStyle={{ fontSize: "11px" }} />
              <ReferenceLine y={0} stroke="hsl(220,14%,22%)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="cashflow" stroke="hsl(152,60%,48%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="rate" stroke="hsl(0,72%,55%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-sm font-semibold mb-4">Preissensitivität – Cashflow & Rendite bei verschiedenen Kaufpreisen</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceData}>
              <XAxis dataKey="preis" axisLine={false} tickLine={false} tick={tickStyle} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={(v) => `${v}€`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend formatter={(v) => v === "cashflow" ? "Cashflow/M" : "Brutto-Rendite"} wrapperStyle={{ fontSize: "11px" }} />
              <ReferenceLine yAxisId="left" y={0} stroke="hsl(220,14%,22%)" strokeDasharray="3 3" />
              <Line yAxisId="left" type="monotone" dataKey="cashflow" stroke="hsl(152,60%,48%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="rendite" stroke="hsl(42,70%,55%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Improvement 16: Rent sensitivity chart */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-sm font-semibold mb-4">Mietsensitivität – Cashflow & Rendite bei verschiedenen Mieten</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rentData}>
              <XAxis dataKey="miete" axisLine={false} tickLine={false} tick={tickStyle} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={(v) => `${v}€`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend formatter={(v) => v === "cashflow" ? "Cashflow/M" : "Brutto-Rendite"} wrapperStyle={{ fontSize: "11px" }} />
              <ReferenceLine yAxisId="left" y={0} stroke="hsl(220,14%,22%)" strokeDasharray="3 3" />
              <Line yAxisId="left" type="monotone" dataKey="cashflow" stroke="hsl(152,60%,48%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="rendite" stroke="hsl(42,70%,55%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SensitivityAnalysis;
