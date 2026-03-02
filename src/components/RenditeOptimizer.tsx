/**
 * RENDITE-1: Rendite-Optimierer
 * 
 * Features:
 * - Scenario comparison (renovation vs. sale vs. hold)
 * - Break-even analysis
 * - ROI forecast
 * - Cashflow projection over 10/20/30 years
 */

import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp, Calculator, BarChart3, ArrowRight, RotateCcw,
  Building2, Hammer, DollarSign, PiggyBank, Target, Info
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar, ReferenceLine
} from "recharts";
import { formatCurrency, formatCurrencyCompact, safeDivide } from "@/lib/formatters";

interface ScenarioParams {
  purchasePrice: number;
  currentValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCreditRate: number;
  remainingDebt: number;
  interestRate: number;
  sqm: number;
  yearBuilt: number;
  // Renovation scenario
  renovationCost: number;
  rentIncreaseAfterReno: number;
  valueIncreaseAfterReno: number;
  // Market assumptions
  annualAppreciation: number;
  annualRentGrowth: number;
  inflationRate: number;
  // Sale scenario
  sellingCosts: number; // % of sale price
  capitalGainsTax: number; // % if applicable
  holdingPeriod: number; // years already held
}

const DEFAULT_PARAMS: ScenarioParams = {
  purchasePrice: 300000,
  currentValue: 350000,
  monthlyRent: 1200,
  monthlyExpenses: 300,
  monthlyCreditRate: 800,
  remainingDebt: 200000,
  interestRate: 3.5,
  sqm: 75,
  yearBuilt: 1990,
  renovationCost: 50000,
  rentIncreaseAfterReno: 200,
  valueIncreaseAfterReno: 80000,
  annualAppreciation: 2,
  annualRentGrowth: 1.5,
  inflationRate: 2,
  sellingCosts: 6,
  capitalGainsTax: 25,
  holdingPeriod: 5,
};

type ProjectionYear = {
  year: number;
  holdValue: number;
  holdEquity: number;
  holdCashflow: number;
  holdCumCashflow: number;
  holdROI: number;
  renoValue: number;
  renoEquity: number;
  renoCashflow: number;
  renoCumCashflow: number;
  renoROI: number;
  saleNetProceeds: number;
};

/** RENDITE-2: Project all three scenarios over N years */
function projectScenarios(params: ScenarioParams, years: number): ProjectionYear[] {
  const data: ProjectionYear[] = [];
  const { currentValue, monthlyRent, monthlyExpenses, monthlyCreditRate,
    remainingDebt, interestRate, renovationCost, rentIncreaseAfterReno,
    valueIncreaseAfterReno, annualAppreciation, annualRentGrowth,
    sellingCosts, capitalGainsTax, holdingPeriod, purchasePrice } = params;

  let holdVal = currentValue;
  let holdDebt = remainingDebt;
  let holdRent = monthlyRent;
  let holdCumCF = 0;

  let renoVal = currentValue + valueIncreaseAfterReno;
  let renoDebt = remainingDebt + renovationCost;
  let renoRent = monthlyRent + rentIncreaseAfterReno;
  let renoCumCF = -renovationCost; // Initial investment

  const mInterest = interestRate / 100 / 12;

  for (let y = 0; y <= years; y++) {
    const holdEq = holdVal - holdDebt;
    const renoEq = renoVal - renoDebt;
    const holdAnnualCF = y === 0 ? 0 : (holdRent - monthlyExpenses - monthlyCreditRate) * 12;
    const renoAnnualCF = y === 0 ? -renovationCost : (renoRent - monthlyExpenses - monthlyCreditRate) * 12;

    // Sale calculation
    const yearsHeld = holdingPeriod + y;
    const sellPrice = holdVal;
    const sellCosts = sellPrice * (sellingCosts / 100);
    const gain = sellPrice - purchasePrice;
    const taxOnGain = yearsHeld >= 10 ? 0 : Math.max(0, gain) * (capitalGainsTax / 100);
    const saleNet = sellPrice - sellCosts - taxOnGain - holdDebt;

    const totalInvested = purchasePrice - remainingDebt; // equity initially invested
    data.push({
      year: y,
      holdValue: Math.round(holdVal),
      holdEquity: Math.round(holdEq),
      holdCashflow: Math.round(holdAnnualCF),
      holdCumCashflow: Math.round(holdCumCF),
      holdROI: Math.round(safeDivide(holdCumCF + holdEq - totalInvested, totalInvested, 0) * 100) / 100,
      renoValue: Math.round(renoVal),
      renoEquity: Math.round(renoEq),
      renoCashflow: Math.round(renoAnnualCF),
      renoCumCashflow: Math.round(renoCumCF),
      renoROI: Math.round(safeDivide(renoCumCF + renoEq - totalInvested - renovationCost, totalInvested + renovationCost, 0) * 100) / 100,
      saleNetProceeds: Math.round(saleNet),
    });

    if (y >= years) break;

    // Annual growth
    holdVal *= (1 + annualAppreciation / 100);
    renoVal *= (1 + annualAppreciation / 100);
    holdRent *= (1 + annualRentGrowth / 100);
    renoRent *= (1 + annualRentGrowth / 100);

    // Debt reduction
    for (let m = 0; m < 12; m++) {
      if (holdDebt > 0) {
        const intPay = holdDebt * mInterest;
        const prinPay = Math.max(0, monthlyCreditRate - intPay);
        holdDebt = Math.max(0, holdDebt - prinPay);
      }
      if (renoDebt > 0) {
        const intPay = renoDebt * mInterest;
        const prinPay = Math.max(0, monthlyCreditRate - intPay);
        renoDebt = Math.max(0, renoDebt - prinPay);
      }
    }

    holdCumCF += holdAnnualCF;
    renoCumCF += renoAnnualCF;
  }

  return data;
}

type TimeHorizon = 10 | 20 | 30;

export default function RenditeOptimizer() {
  const [params, setParams] = useState<ScenarioParams>(DEFAULT_PARAMS);
  const [horizon, setHorizon] = useState<TimeHorizon>(20);
  const [tab, setTab] = useState("comparison");

  const data = useMemo(() => projectScenarios(params, horizon), [params, horizon]);

  const last = data[data.length - 1];
  const first = data[0];

  /** RENDITE-3: Break-even analysis — when does renovation pay off vs hold? */
  const breakEvenYear = useMemo(() => {
    for (let i = 1; i < data.length; i++) {
      if (data[i].renoCumCashflow > data[i].holdCumCashflow) return data[i].year;
    }
    return null;
  }, [data]);

  /** RENDITE-4: Best scenario identification */
  const bestScenario = useMemo(() => {
    const holdTotal = last.holdEquity + last.holdCumCashflow;
    const renoTotal = last.renoEquity + last.renoCumCashflow;
    const saleTotal = first.saleNetProceeds;
    if (saleTotal > holdTotal && saleTotal > renoTotal) return "sale";
    if (renoTotal > holdTotal) return "renovation";
    return "hold";
  }, [last, first]);

  const updateParam = useCallback(<K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setParams(DEFAULT_PARAMS), []);

  /** RENDITE-5: Key metrics */
  const metrics = useMemo(() => {
    const monthlyCF = params.monthlyRent - params.monthlyExpenses - params.monthlyCreditRate;
    const grossYield = safeDivide(params.monthlyRent * 12, params.currentValue, 0) * 100;
    const netYield = safeDivide(monthlyCF * 12, params.currentValue, 0) * 100;
    const cashOnCash = safeDivide(monthlyCF * 12, params.purchasePrice - params.remainingDebt, 0) * 100;
    const pricePerSqm = safeDivide(params.currentValue, params.sqm, 0);
    const rentPerSqm = safeDivide(params.monthlyRent, params.sqm, 0);
    return { monthlyCF, grossYield, netYield, cashOnCash, pricePerSqm, rentPerSqm };
  }, [params]);

  const scenarioColors = {
    hold: "hsl(var(--primary))",
    reno: "hsl(var(--profit))",
    sale: "hsl(var(--gold))",
  };

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Rendite-Optimierer</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(horizon)} onValueChange={v => setHorizon(Number(v) as TimeHorizon)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 Jahre</SelectItem>
              <SelectItem value="20">20 Jahre</SelectItem>
              <SelectItem value="30">30 Jahre</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Cashflow/M", value: formatCurrency(metrics.monthlyCF), color: metrics.monthlyCF >= 0 ? "text-profit" : "text-loss" },
          { label: "Brutto-Rendite", value: `${metrics.grossYield.toFixed(1)}%`, color: "text-primary" },
          { label: "Netto-Rendite", value: `${metrics.netYield.toFixed(1)}%`, color: "text-primary" },
          { label: "Cash-on-Cash", value: `${metrics.cashOnCash.toFixed(1)}%`, color: "text-primary" },
          { label: "€/m²", value: formatCurrency(metrics.pricePerSqm), color: "text-muted-foreground" },
          { label: "Miete/m²", value: `${metrics.rentPerSqm.toFixed(2)} €`, color: "text-muted-foreground" },
        ].map((m, i) => (
          <div key={i} className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
            <p className={`text-xs font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Best Scenario Banner */}
      <div className={`rounded-lg border p-3 flex items-center gap-3 ${
        bestScenario === "hold" ? "border-primary/30 bg-primary/5" :
        bestScenario === "renovation" ? "border-profit/30 bg-profit/5" :
        "border-gold/30 bg-gold/5"
      }`}>
        <Target className="h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            Empfehlung: {bestScenario === "hold" ? "Halten" : bestScenario === "renovation" ? "Sanieren" : "Verkaufen"}
          </p>
          <p className="text-xs text-muted-foreground">
            {bestScenario === "hold" && `Halten bringt ${formatCurrency(last.holdEquity + last.holdCumCashflow)} Gesamtrendite über ${horizon} Jahre`}
            {bestScenario === "renovation" && `Sanierung amortisiert sich ${breakEvenYear ? `in Jahr ${breakEvenYear}` : "langfristig"} — ${formatCurrency(last.renoEquity + last.renoCumCashflow)} Gesamtrendite`}
            {bestScenario === "sale" && `Sofortiger Verkauf bringt netto ${formatCurrency(first.saleNetProceeds)}`}
          </p>
        </div>
      </div>

      {/* Input Parameters (collapsed by default) */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          Parameter anpassen
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {[
            { label: "Kaufpreis", key: "purchasePrice" as const, suffix: "€" },
            { label: "Aktueller Wert", key: "currentValue" as const, suffix: "€" },
            { label: "Miete/Monat", key: "monthlyRent" as const, suffix: "€" },
            { label: "Kosten/Monat", key: "monthlyExpenses" as const, suffix: "€" },
            { label: "Kreditrate/M", key: "monthlyCreditRate" as const, suffix: "€" },
            { label: "Restschuld", key: "remainingDebt" as const, suffix: "€" },
            { label: "Zinssatz", key: "interestRate" as const, suffix: "%" },
            { label: "m²", key: "sqm" as const, suffix: "" },
            { label: "Sanierungskosten", key: "renovationCost" as const, suffix: "€" },
            { label: "Mietplus nach Sani", key: "rentIncreaseAfterReno" as const, suffix: "€/M" },
            { label: "Wertplus nach Sani", key: "valueIncreaseAfterReno" as const, suffix: "€" },
            { label: "Wertsteigerung/J", key: "annualAppreciation" as const, suffix: "%" },
          ].map(({ label, key, suffix }) => (
            <div key={key}>
              <Label className="text-[10px]">{label} {suffix && `(${suffix})`}</Label>
              <Input
                type="number"
                value={params[key] || ""}
                onChange={e => updateParam(key, Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      </details>

      {/* Charts */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="comparison" className="text-xs gap-1">
            <BarChart3 className="h-3 w-3" /> Vergleich
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="text-xs gap-1">
            <DollarSign className="h-3 w-3" /> Cashflow
          </TabsTrigger>
          <TabsTrigger value="equity" className="text-xs gap-1">
            <TrendingUp className="h-3 w-3" /> Eigenkapital
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="mt-3">
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                {
                  name: "Halten",
                  total: last.holdEquity + last.holdCumCashflow,
                  equity: last.holdEquity,
                  cashflow: last.holdCumCashflow,
                },
                {
                  name: "Sanieren",
                  total: last.renoEquity + last.renoCumCashflow,
                  equity: last.renoEquity,
                  cashflow: last.renoCumCashflow,
                },
                {
                  name: "Verkaufen",
                  total: first.saleNetProceeds,
                  equity: first.saleNetProceeds,
                  cashflow: 0,
                },
              ]}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} />
                <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="equity" stackId="a" fill="hsl(var(--primary))" name="Eigenkapital" radius={[0, 0, 0, 0]} />
                <Bar dataKey="cashflow" stackId="a" fill="hsl(var(--profit))" name="Cashflow" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-3">
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} tickFormatter={v => `J${v}`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} />
                <RechartsTooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={v => `Jahr ${v}`} />
                <Area type="monotone" dataKey="holdCumCashflow" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Halten" />
                <Area type="monotone" dataKey="renoCumCashflow" stroke="hsl(var(--profit))" fill="hsl(var(--profit))" fillOpacity={0.1} name="Sanieren" />
                {breakEvenYear && <ReferenceLine x={breakEvenYear} stroke="hsl(var(--gold))" strokeDasharray="5 5" label={{ value: "Break-Even", fontSize: 10 }} />}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {breakEvenYear && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Break-Even der Sanierung in Jahr {breakEvenYear} — danach übersteigt die Sanierung den Halten-Cashflow
            </p>
          )}
        </TabsContent>

        <TabsContent value="equity" className="mt-3">
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} tickFormatter={v => `J${v}`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} />
                <RechartsTooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={v => `Jahr ${v}`} />
                <Area type="monotone" dataKey="holdEquity" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Halten EK" />
                <Area type="monotone" dataKey="renoEquity" stroke="hsl(var(--profit))" fill="hsl(var(--profit))" fillOpacity={0.15} name="Sanieren EK" />
                <ReferenceLine y={first.saleNetProceeds} stroke="hsl(var(--gold))" strokeDasharray="5 5" label={{ value: `Verkauf: ${formatCurrencyCompact(first.saleNetProceeds)}`, fontSize: 10 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
