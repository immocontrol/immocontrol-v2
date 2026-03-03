import { useMemo, useState } from "react";
import { TrendingUp, Calendar } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PortfolioForecast = () => {
  const { properties, stats } = useProperties();
  const [years, setYears] = useState("5");
  const [appreciation, setAppreciation] = useState("2");

  const forecastData = useMemo(() => {
    const n = parseInt(years);
    const appRate = parseFloat(appreciation) / 100;
    const data = [];
    let value = stats.totalValue;
    let debt = stats.totalDebt;
    let equity = stats.equity;
    const annualCashflow = stats.totalCashflow * 12;
    const monthlyTilgung = properties.reduce((s, p) => {
      const tilgung = p.monthlyCreditRate - (p.remainingDebt * (p.interestRate / 100) / 12);
      return s + Math.max(0, tilgung);
    }, 0);

    for (let y = 0; y <= n; y++) {
      data.push({
        year: new Date().getFullYear() + y,
        label: `${new Date().getFullYear() + y}`,
        wert: Math.round(value),
        schulden: Math.round(debt),
        eigenkapital: Math.round(equity),
        cashflow: Math.round(annualCashflow * (y || 1)),
      });
      value *= (1 + appRate);
      debt = Math.max(0, debt - monthlyTilgung * 12);
      equity = value - debt;
    }
    return data;
  }, [properties, stats, years, appreciation]);

  if (properties.length === 0) return null;

  const lastYear = forecastData[forecastData.length - 1];
  const equityGrowth = stats.equity > 0 ? ((lastYear.eigenkapital - stats.equity) / stats.equity * 100) : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" /> Portfolio-Prognose
        </h3>
        <div className="flex items-center gap-2">
          <Select value={years} onValueChange={setYears}>
            <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Jahre</SelectItem>
              <SelectItem value="5">5 Jahre</SelectItem>
              <SelectItem value="10">10 Jahre</SelectItem>
              <SelectItem value="20">20 Jahre</SelectItem>
            </SelectContent>
          </Select>
          <Select value={appreciation} onValueChange={setAppreciation}>
            <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0% p.a.</SelectItem>
              <SelectItem value="1">1% p.a.</SelectItem>
              <SelectItem value="2">2% p.a.</SelectItem>
              <SelectItem value="3">3% p.a.</SelectItem>
              <SelectItem value="5">5% p.a.</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-secondary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">Wert {lastYear.label}</div>
          <div className="text-sm font-bold">{formatCurrencyCompact(lastYear.wert)}</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">EK {lastYear.label}</div>
          <div className="text-sm font-bold text-profit">{formatCurrencyCompact(lastYear.eigenkapital)}</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">EK-Wachstum</div>
          {/* IMP38-1: Fix sign display — show minus for negative growth */}
          <div className={`text-sm font-bold ${equityGrowth >= 0 ? "text-profit" : "text-loss"}`}>{equityGrowth >= 0 ? "+" : ""}{equityGrowth.toFixed(0)}%</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecastData}>
            <defs>
              <linearGradient id="colorWert" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorEK" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--profit))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
              formatter={(value: number, name: string) => [formatCurrency(value), name === "wert" ? "Portfoliowert" : name === "eigenkapital" ? "Eigenkapital" : "Schulden"]}
            />
            <Area type="monotone" dataKey="wert" stroke="hsl(var(--primary))" fill="url(#colorWert)" strokeWidth={2} />
            <Area type="monotone" dataKey="eigenkapital" stroke="hsl(var(--profit))" fill="url(#colorEK)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PortfolioForecast;
