import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import type { AnalysisInputState, AnalysisCalcResult } from "@/hooks/useAnalysisCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

interface Props {
  inputs: AnalysisInputState;
  calc: AnalysisCalcResult;
}

const AmortizationChart = ({ inputs, calc }: Props) => {
  // Improvement 18: Configurable duration
  const [duration, setDuration] = useState(30);

  const data = useMemo(() => {
    let restschuld = calc.darlehen;
    const monatlicheRate = calc.monatlicheRate;
    const result = [];
    let totalZinsen = 0;

    for (let year = 0; year <= duration; year++) {
      const gezahlteZinsen = year === 0 ? 0 : restschuld * (inputs.zinssatz / 100);
      const gezahlteTilgung = year === 0 ? 0 : Math.min(monatlicheRate * 12 - gezahlteZinsen, restschuld);
      if (year > 0) totalZinsen += gezahlteZinsen;

      result.push({
        jahr: year,
        restschuld: Math.max(0, Math.round(restschuld)),
        zinsen: Math.round(gezahlteZinsen),
        tilgung: Math.round(gezahlteTilgung),
        eigenkapital: Math.round(calc.gesamtkosten - restschuld),
        totalZinsen: Math.round(totalZinsen),
      });

      if (year > 0) {
        restschuld = Math.max(0, restschuld - gezahlteTilgung);
      }
      if (restschuld <= 0) break;
    }
    return result;
  }, [inputs, calc, duration]);

  // Improvement 19: Summary stats
  const totalZinsenPaid = data[data.length - 1]?.totalZinsen || 0;
  const payoffYear = data.findIndex(d => d.restschuld <= 0);
  const finalRestschuld = data[data.length - 1]?.restschuld || 0;
  const totalPaid = calc.monatlicheRate * 12 * (data.length - 1);

  return (
    <div className="space-y-4">
      {/* Improvement 19: Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="gradient-card rounded-xl border border-border p-3 animate-fade-in">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Restschuld nach {duration}J</div>
          <div className="text-lg font-bold text-loss">{formatCurrency(finalRestschuld)}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 animate-fade-in [animation-delay:50ms]">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Zinsen gesamt</div>
          <div className="text-lg font-bold text-gold">{formatCurrency(totalZinsenPaid)}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 animate-fade-in [animation-delay:100ms]">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Gezahlt gesamt</div>
          <div className="text-lg font-bold">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 animate-fade-in [animation-delay:150ms]">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Voll getilgt</div>
          <div className="text-lg font-bold text-profit">
            {payoffYear > 0 ? `Jahr ${payoffYear}` : `> ${duration}J`}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Tilgungsverlauf</h2>
          {/* Improvement 18: Duration selector */}
          <div className="flex gap-1">
            {[10, 20, 30, 40].map(y => (
              <button
                key={y}
                onClick={() => setDuration(y)}
                className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                  duration === y ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {y}J
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <XAxis dataKey="jahr" axisLine={false} tickLine={false} tick={{ fill: "hsl(215,12%,52%)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215,12%,52%)", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === "restschuld" ? "Restschuld" : name === "eigenkapital" ? "Eigenkapital" : name]} contentStyle={{ backgroundColor: "hsl(220,18%,12%)", border: "1px solid hsl(220,14%,18%)", borderRadius: "8px", color: "hsl(210,20%,92%)", fontSize: "12px" }} />
              <Legend formatter={(v) => v === "restschuld" ? "Restschuld" : v === "eigenkapital" ? "Eigenkapital" : v} wrapperStyle={{ fontSize: "11px" }} />
              <Area type="monotone" dataKey="restschuld" stroke="hsl(0,72%,55%)" fill="hsl(0,72%,55%,0.15)" strokeWidth={2} />
              <Area type="monotone" dataKey="eigenkapital" stroke="hsl(152,60%,48%)" fill="hsl(152,60%,48%,0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3">Tilgungsplan (Jahresansicht)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left py-2 pr-4">Jahr</th>
              <th className="text-right py-2 px-2">Restschuld</th>
              <th className="text-right py-2 px-2">Zinsen</th>
              <th className="text-right py-2 px-2">Tilgung</th>
              <th className="text-right py-2 px-2">Eigenkapital</th>
              {/* Improvement 20: Cumulative interest */}
              <th className="text-right py-2 pl-2">Σ Zinsen</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.jahr} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 pr-4 font-medium">{row.jahr}</td>
                <td className="py-1.5 px-2 text-right text-loss">{formatCurrency(row.restschuld)}</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(row.zinsen)}</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(row.tilgung)}</td>
                <td className="py-1.5 px-2 text-right text-profit">{formatCurrency(row.eigenkapital)}</td>
                <td className="py-1.5 pl-2 text-right text-gold">{formatCurrency(row.totalZinsen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AmortizationChart;
