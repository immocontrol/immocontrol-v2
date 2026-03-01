import { useState, useMemo, useCallback } from "react";
import { TrendingUp, Sliders, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface SimParams {
  startCapital: number;
  monthlyInvestment: number;
  annualReturn: number;
  annualAppreciation: number;
  inflationRate: number;
  taxRate: number;
  years: number;
  rentYield: number;
  leverageRatio: number;
  maintenancePct: number;
}

const DEFAULT_PARAMS: SimParams = {
  startCapital: 50000,
  monthlyInvestment: 1000,
  annualReturn: 5,
  annualAppreciation: 2,
  inflationRate: 2,
  taxRate: 25,
  years: 20,
  rentYield: 4,
  leverageRatio: 75,
  maintenancePct: 1,
};

interface DataPoint {
  year: number;
  label: string;
  portfolioValue: number;
  equity: number;
  totalInvested: number;
  rentalIncome: number;
  netWorth: number;
}

function simulate(params: SimParams): DataPoint[] {
  const data: DataPoint[] = [];
  const {
    startCapital, monthlyInvestment, annualReturn, annualAppreciation,
    inflationRate, taxRate, years, rentYield, leverageRatio, maintenancePct,
  } = params;

  const leverage = leverageRatio / 100;
  const initialPropertyValue = startCapital / (1 - leverage);
  const initialDebt = initialPropertyValue * leverage;
  const monthlyAppreciation = annualAppreciation / 100 / 12;
  const monthlyRentYield = rentYield / 100 / 12;
  const monthlyMaintenance = maintenancePct / 100 / 12;
  const monthlyInflation = inflationRate / 100 / 12;
  const interestRate = annualReturn / 100 / 12;
  const tax = taxRate / 100;

  let propertyValue = initialPropertyValue;
  let debt = initialDebt;
  let totalInvested = startCapital;
  let cumulativeRent = 0;
  let cumulativeCashflow = 0;

  for (let y = 0; y <= years; y++) {
    const equity = propertyValue - debt;
    const netWorth = equity + cumulativeCashflow;

    data.push({
      year: y,
      label: `Jahr ${y}`,
      portfolioValue: Math.round(propertyValue),
      equity: Math.round(equity),
      totalInvested: Math.round(totalInvested),
      rentalIncome: Math.round(cumulativeRent),
      netWorth: Math.round(netWorth),
    });

    if (y >= years) break;

    /* Simulate 12 months */
    for (let m = 0; m < 12; m++) {
      /* Property appreciation */
      propertyValue *= (1 + monthlyAppreciation);

      /* Rental income (after maintenance) */
      const grossRent = propertyValue * monthlyRentYield;
      const maintenance = propertyValue * monthlyMaintenance;
      const netRent = grossRent - maintenance;
      const afterTaxRent = netRent * (1 - tax);
      cumulativeRent += afterTaxRent;

      /* Monthly investment reduces debt or adds to portfolio */
      const monthlyPayment = monthlyInvestment;
      if (debt > 0) {
        const interestPayment = debt * interestRate;
        const principalPayment = Math.min(debt, monthlyPayment - interestPayment);
        debt = Math.max(0, debt - principalPayment);
        cumulativeCashflow += afterTaxRent - interestPayment;
      } else {
        /* Debt paid off — reinvest into property value */
        propertyValue += monthlyPayment * 0.8; /* 80% efficiency reinvestment */
        cumulativeCashflow += afterTaxRent;
      }

      totalInvested += monthlyInvestment;

      /* Inflation adjustment on property value (already in appreciation) */
      propertyValue *= (1 + monthlyInflation * 0.1); /* Partial inflation hedge */
    }
  }

  return data;
}

export function HockeyStickSimulator() {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);

  const data = useMemo(() => simulate(params), [params]);

  const updateParam = useCallback(<K extends keyof SimParams>(key: K, value: SimParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setParams(DEFAULT_PARAMS), []);

  const lastPoint = data[data.length - 1];
  const firstPoint = data[0];
  const totalReturn = firstPoint.totalInvested > 0
    ? ((lastPoint.netWorth - firstPoint.totalInvested) / firstPoint.totalInvested * 100)
    : 0;

  /* Detect hockey stick inflection point — where growth accelerates */
  const inflectionYear = useMemo(() => {
    for (let i = 2; i < data.length; i++) {
      const prevGrowth = data[i - 1].netWorth - data[i - 2].netWorth;
      const currGrowth = data[i].netWorth - data[i - 1].netWorth;
      if (currGrowth > prevGrowth * 1.5 && currGrowth > 10000) return data[i].year;
    }
    return null;
  }, [data]);

  const exportCSV = useCallback(() => {
    const headers = "Jahr,Portfoliowert,Eigenkapital,Investiert,Mieteinnahmen,Nettovermögen\n";
    const rows = data.map(d =>
      `${d.year},${d.portfolioValue},${d.equity},${d.totalInvested},${d.rentalIncome},${d.netWorth}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hockey-stick-simulation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Hockey Stick Simulator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Hockey Stick Simulator
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Simuliere den exponentiellen Vermögensaufbau deines Immobilienportfolios
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nettovermögen</p>
              <p className="text-sm font-bold text-profit mt-1">{formatCurrencyCompact(lastPoint.netWorth)}</p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Portfoliowert</p>
              <p className="text-sm font-bold mt-1">{formatCurrencyCompact(lastPoint.portfolioValue)}</p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gesamtrendite</p>
              <p className={`text-sm font-bold mt-1 ${totalReturn >= 0 ? "text-profit" : "text-loss"}`}>{totalReturn.toFixed(0)}%</p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mieteinnahmen</p>
              <p className="text-sm font-bold mt-1">{formatCurrencyCompact(lastPoint.rentalIncome)}</p>
            </div>
          </div>

          {inflectionYear !== null && (
            <div className="flex items-center gap-2 bg-primary/10 rounded-lg p-3 text-xs font-medium text-primary">
              <TrendingUp className="h-4 w-4 shrink-0" />
              Hockey Stick Effekt ab Jahr {inflectionYear} — exponentielles Wachstum beginnt
            </div>
          )}

          {/* Chart */}
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--profit))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={55} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                  formatter={(v: number, name: string) => {
                    const labels: Record<string, string> = {
                      netWorth: "Nettovermögen",
                      portfolioValue: "Portfoliowert",
                      totalInvested: "Investiert",
                      equity: "Eigenkapital",
                    };
                    return [formatCurrency(v), labels[name] || name];
                  }}
                />
                {inflectionYear !== null && (
                  <ReferenceLine x={`Jahr ${inflectionYear}`} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ value: "Hockey Stick", fontSize: 10, fill: "hsl(var(--primary))" }} />
                )}
                <Area type="monotone" dataKey="totalInvested" stroke="hsl(var(--muted-foreground))" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                <Area type="monotone" dataKey="portfolioValue" stroke="hsl(var(--primary))" fill="url(#colorPortfolio)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="netWorth" stroke="hsl(var(--profit))" fill="url(#colorNetWorth)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sliders */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" /> Parameter anpassen
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Startkapital</Label>
                  <span className="text-xs font-medium">{formatCurrency(params.startCapital)}</span>
                </div>
                <Slider value={[params.startCapital]} min={10000} max={500000} step={5000} onValueChange={v => updateParam("startCapital", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Monatliche Investition</Label>
                  <span className="text-xs font-medium">{formatCurrency(params.monthlyInvestment)}</span>
                </div>
                <Slider value={[params.monthlyInvestment]} min={100} max={5000} step={100} onValueChange={v => updateParam("monthlyInvestment", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Wertsteigerung p.a.</Label>
                  <span className="text-xs font-medium">{params.annualAppreciation}%</span>
                </div>
                <Slider value={[params.annualAppreciation]} min={0} max={10} step={0.5} onValueChange={v => updateParam("annualAppreciation", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Mietrendite p.a.</Label>
                  <span className="text-xs font-medium">{params.rentYield}%</span>
                </div>
                <Slider value={[params.rentYield]} min={1} max={10} step={0.5} onValueChange={v => updateParam("rentYield", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Zinssatz (Darlehen)</Label>
                  <span className="text-xs font-medium">{params.annualReturn}%</span>
                </div>
                <Slider value={[params.annualReturn]} min={1} max={8} step={0.25} onValueChange={v => updateParam("annualReturn", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Fremdkapitalquote</Label>
                  <span className="text-xs font-medium">{params.leverageRatio}%</span>
                </div>
                <Slider value={[params.leverageRatio]} min={0} max={90} step={5} onValueChange={v => updateParam("leverageRatio", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Steuersatz</Label>
                  <span className="text-xs font-medium">{params.taxRate}%</span>
                </div>
                <Slider value={[params.taxRate]} min={0} max={45} step={1} onValueChange={v => updateParam("taxRate", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Inflation</Label>
                  <span className="text-xs font-medium">{params.inflationRate}%</span>
                </div>
                <Slider value={[params.inflationRate]} min={0} max={6} step={0.5} onValueChange={v => updateParam("inflationRate", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Instandhaltung p.a.</Label>
                  <span className="text-xs font-medium">{params.maintenancePct}%</span>
                </div>
                <Slider value={[params.maintenancePct]} min={0} max={5} step={0.5} onValueChange={v => updateParam("maintenancePct", v[0])} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">Simulationsdauer</Label>
                  <span className="text-xs font-medium">{params.years} Jahre</span>
                </div>
                <Slider value={[params.years]} min={5} max={40} step={1} onValueChange={v => updateParam("years", v[0])} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HockeyStickSimulator;
