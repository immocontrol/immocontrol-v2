import { useMemo, useState, useEffect } from "react";
import { TrendingDown, CalendarDays, Download, Target, TrendingUp } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getISOWeek } from "@/lib/formatters";
import { Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Line, ComposedChart, ReferenceLine } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Loan {
  id: string;
  property_id: string;
  monthly_payment: number;
  remaining_balance: number;
}

const CashForecast = () => {
  const { user } = useAuth();
  const { properties, stats, loading } = useProperties();
  const [forecastWeeks, setForecastWeeks] = useState<13 | 26 | 52>(13);
  const [scenario, setScenario] = useState<"normal" | "optimistic" | "pessimistic">("normal");

  useEffect(() => { document.title = "Cashforecast – ImmoControl"; }, []);

  const { data: loans = [] } = useQuery({
    queryKey: queryKeys.loans.all,
    queryFn: async () => {
      const { data, error } = await supabase.from("loans").select("id, property_id, monthly_payment, remaining_balance").order("created_at");
      if (error) throw error;
      return (data || []) as Loan[];
    },
    enabled: !!user,
  });

  const forecastData = useMemo(() => {
    const today = new Date();
    const scenarioMultiplier = scenario === "optimistic" ? 1.05 : scenario === "pessimistic" ? 0.90 : 1.0;
    const expenseMultiplier = scenario === "optimistic" ? 0.95 : scenario === "pessimistic" ? 1.10 : 1.0;
    const totalMonthlyExpenses = properties.reduce((s, p) => s + p.monthlyExpenses, 0) * expenseMultiplier;
    const weeklyExpenses = totalMonthlyExpenses / 4.33;
    const totalMonthlyLoanPayments = loans.reduce((s, l) => s + l.monthly_payment, 0);
    const weeklyLoanPayments = totalMonthlyLoanPayments / 4.33;

    let cumulativeCashflow = 0;
    const result: { week: string; label: string; einnahmen: number; ausgaben: number; netto: number; kumulativ: number; }[] = [];

    for (let i = 0; i < forecastWeeks; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const isRentWeek = i % 4 === 0;
      const weekIncome = isRentWeek ? stats.totalRent * scenarioMultiplier : 0;
      const weekExpense = weeklyExpenses + weeklyLoanPayments;
      const weekNet = weekIncome - weekExpense;
      cumulativeCashflow += weekNet;

      result.push({
        week: `KW${getISOWeek(weekStart)}`,
        label: `${weekStart.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} – ${weekEnd.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`,
        einnahmen: Math.round(weekIncome),
        ausgaben: Math.round(-weekExpense),
        netto: Math.round(weekNet),
        kumulativ: Math.round(cumulativeCashflow),
      });
    }
    return result;
  }, [properties, stats, loans, forecastWeeks, scenario]);

  const totalIncome13W = forecastData.reduce((s, w) => s + w.einnahmen, 0);
  const totalExpenses13W = forecastData.reduce((s, w) => s + Math.abs(w.ausgaben), 0);
  const netCashflow13W = totalIncome13W - totalExpenses13W;
  const lowestPoint = forecastData.length > 0 ? Math.min(...forecastData.map(w => w.kumulativ)) : 0;

  // Feature: Break-even week
  const breakEvenWeek = forecastData.findIndex((w, i) => i > 0 && forecastData[i - 1].kumulativ < 0 && w.kumulativ >= 0);

  // Feature: CSV Export
  const exportCashForecastCSV = () => {
    const headers = ["Woche", "Zeitraum", "Einnahmen", "Ausgaben", "Netto", "Kumulativ"];
    const rows = forecastData.map(w => [w.week, w.label, w.einnahmen, Math.abs(w.ausgaben), w.netto, w.kumulativ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashforecast_${forecastWeeks}w_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportiert!");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 shimmer rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 shimmer rounded-xl" />)}
        </div>
        <div className="h-80 shimmer rounded-xl" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <CalendarDays className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Kein Cashforecast verfügbar</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Füge zuerst Objekte zu deinem Portfolio hinzu, um einen Cashforecast zu generieren.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Cashforecast
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {forecastWeeks}-Wochen-Vorschau · {properties.length} Objekte · {loans.length} Darlehen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scenario} onValueChange={v => setScenario(v as "normal" | "optimistic" | "pessimistic")}>
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="optimistic">Optimistisch (+5%)</SelectItem>
              <SelectItem value="pessimistic">Pessimistisch (-10%)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={exportCashForecastCSV}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Select value={String(forecastWeeks)} onValueChange={v => setForecastWeeks(Number(v) as 13 | 26 | 52)}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="13">13 Wochen</SelectItem>
              <SelectItem value="26">26 Wochen</SelectItem>
              <SelectItem value="52">52 Wochen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Einnahmen {forecastWeeks}W</p>
          <p className="text-xl font-bold mt-1 text-profit">{formatCurrency(totalIncome13W)}</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ausgaben {forecastWeeks}W</p>
          <p className="text-xl font-bold mt-1 text-loss">{formatCurrency(totalExpenses13W)}</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Netto {forecastWeeks}W</p>
          <p className={`text-xl font-bold mt-1 ${netCashflow13W >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrency(netCashflow13W)}
          </p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tiefster Punkt</p>
          <p className={`text-xl font-bold mt-1 ${lowestPoint >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrency(lowestPoint)}
          </p>
          {lowestPoint < 0 && (
            <p className="text-[10px] text-loss mt-0.5 flex items-center gap-0.5">
              <TrendingDown className="h-3 w-3" /> Liquiditätsengpass möglich
            </p>
          )}
        </div>
        {/* Feature: Break-even indicator */}
        {breakEvenWeek > 0 && (
          <div className="gradient-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Break-Even</p>
            <p className="text-xl font-bold mt-1 text-profit flex items-center gap-1">
              <Target className="h-4 w-4" /> {forecastData[breakEvenWeek]?.week}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Nach {breakEvenWeek} Wochen positiv
            </p>
          </div>
        )}
      </div>

      {/* Main Chart */}
      <div className="gradient-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-4">Wöchentlicher Cashflow</h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={forecastData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <RTooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(_, p) => p?.[0]?.payload?.label || ""}
              formatter={(v: number, name: string) => [formatCurrency(v), name === "einnahmen" ? "Einnahmen" : name === "ausgaben" ? "Ausgaben" : name === "kumulativ" ? "Kumulativ" : "Netto"]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Bar dataKey="einnahmen" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
            <Bar dataKey="ausgaben" fill="hsl(var(--loss))" radius={[4, 4, 0, 0]} opacity={0.6} />
            <Line type="monotone" dataKey="kumulativ" stroke="hsl(var(--gold))" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Einnahmen</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-loss" /> Ausgaben</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gold rounded" /> Kumulativer Cashflow</span>
        </div>
      </div>

      {/* Detail Table */}
      <div className="gradient-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-3">Wochendetails</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Woche</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Zeitraum</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Einnahmen</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Ausgaben</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Netto</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Kumulativ</th>
              </tr>
            </thead>
            <tbody>
              {forecastData.map((w, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 font-medium">{w.week}</td>
                  <td className="py-2 text-muted-foreground">{w.label}</td>
                  <td className="py-2 text-right text-profit font-medium">{w.einnahmen > 0 ? formatCurrency(w.einnahmen) : "–"}</td>
                  <td className="py-2 text-right text-loss">{formatCurrency(Math.abs(w.ausgaben))}</td>
                  <td className={`py-2 text-right font-semibold ${w.netto >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(w.netto)}</td>
                  <td className={`py-2 text-right font-semibold ${w.kumulativ >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(w.kumulativ)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2" colSpan={2}>Gesamt {forecastWeeks} Wochen</td>
                <td className="py-2 text-right text-profit">{formatCurrency(totalIncome13W)}</td>
                <td className="py-2 text-right text-loss">{formatCurrency(totalExpenses13W)}</td>
                <td className={`py-2 text-right ${netCashflow13W >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(netCashflow13W)}</td>
                <td className={`py-2 text-right ${forecastData[forecastData.length - 1]?.kumulativ >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(forecastData[forecastData.length - 1]?.kumulativ || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Assumptions */}
      <div className="gradient-card rounded-xl border border-border p-4">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Annahmen</h4>
        <ul className="text-[11px] text-muted-foreground space-y-1">
          <li>• Mieteinnahmen werden monatlich angenommen (alle 4 Wochen)</li>
          <li>• Bewirtschaftungskosten und Darlehensraten werden gleichmäßig auf Wochen verteilt</li>
          <li>• Basiert auf aktuellen Mieteinnahmen: {formatCurrency(stats.totalRent)}/Monat</li>
          <li>• Darlehensraten: {formatCurrency(loans.reduce((s, l) => s + l.monthly_payment, 0))}/Monat</li>
        </ul>
      </div>
    </div>
  );
};

export default CashForecast;
