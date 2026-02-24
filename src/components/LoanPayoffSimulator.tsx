import { useState, useMemo } from "react";
import { Calculator, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface LoanPayoffSimulatorProps {
  remainingBalance: number;
  interestRate: number;
  monthlyPayment: number;
  bankName?: string;
}

const LoanPayoffSimulator = ({ remainingBalance, interestRate, monthlyPayment, bankName }: LoanPayoffSimulatorProps) => {
  const [open, setOpen] = useState(false);
  const [extraPayment, setExtraPayment] = useState(0);

  const simulate = (extra: number) => {
    const monthlyRate = interestRate / 100 / 12;
    const payment = monthlyPayment + extra;
    if (payment <= 0 || monthlyRate <= 0) return { months: 0, totalInterest: 0, data: [] };

    let balance = remainingBalance;
    let totalInterest = 0;
    const data: { year: number; balance: number }[] = [];
    let months = 0;

    while (balance > 0 && months < 600) {
      const interest = balance * monthlyRate;
      totalInterest += interest;
      balance = balance + interest - payment;
      months++;
      if (months % 12 === 0) {
        data.push({ year: months / 12, balance: Math.max(0, balance) });
      }
    }

    return { months, totalInterest, data };
  };

  const base = useMemo(() => simulate(0), [remainingBalance, interestRate, monthlyPayment]);
  const withExtra = useMemo(() => simulate(extraPayment), [remainingBalance, interestRate, monthlyPayment, extraPayment]);

  const savedMonths = base.months - withExtra.months;
  const savedInterest = base.totalInterest - withExtra.totalInterest;

  const chartData = base.data.map((d, i) => ({
    year: d.year,
    base: Math.round(d.balance),
    extra: Math.round(withExtra.data[i]?.balance ?? 0),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
          <Calculator className="h-3.5 w-3.5" /> Tilgungssimulator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" /> Tilgungssimulator
          </DialogTitle>
          {bankName && <p className="text-xs text-muted-foreground">{bankName}</p>}
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="gradient-card rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Restschuld</p>
              <p className="text-sm font-bold mt-1">{formatCurrency(remainingBalance)}</p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rate/Monat</p>
              <p className="text-sm font-bold mt-1">{formatCurrency(monthlyPayment)}</p>
            </div>
            <div className="gradient-card rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Zinssatz</p>
              <p className="text-sm font-bold mt-1">{interestRate.toFixed(2)}%</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Zusätzliche Sondertilgung/Monat</Label>
            <NumberInput value={extraPayment} onChange={setExtraPayment} className="h-9 text-sm" placeholder="0" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="gradient-card rounded-lg border border-border p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Ohne Sondertilgung</p>
              <p className="text-sm font-bold">{Math.floor(base.months / 12)} J. {base.months % 12} M.</p>
              <p className="text-xs text-muted-foreground">Zinsen: {formatCurrency(base.totalInterest)}</p>
            </div>
            <div className={`rounded-lg border p-3 space-y-2 ${extraPayment > 0 ? "border-profit/30 bg-profit/5" : "gradient-card border-border"}`}>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mit Sondertilgung</p>
              <p className="text-sm font-bold">{Math.floor(withExtra.months / 12)} J. {withExtra.months % 12} M.</p>
              <p className="text-xs text-muted-foreground">Zinsen: {formatCurrency(withExtra.totalInterest)}</p>
            </div>
          </div>

          {extraPayment > 0 && savedMonths > 0 && (
            <div className="flex items-center gap-3 bg-profit/10 rounded-lg p-3 text-xs text-profit font-medium">
              <TrendingDown className="h-4 w-4 shrink-0" />
              <span>{savedMonths} Monate früher schuldenfrei · {formatCurrency(savedInterest)} Zinsen gespart</span>
            </div>
          )}

          {chartData.length > 1 && (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <XAxis dataKey="year" tick={{ fontSize: 10 }} tickFormatter={v => `${v}J`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number, name: string) => [formatCurrency(v), name === "base" ? "Ohne Sondert." : "Mit Sondert."]} />
                <Area type="monotone" dataKey="base" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" strokeWidth={1.5} fillOpacity={0.3} />
                {extraPayment > 0 && <Area type="monotone" dataKey="extra" stroke="hsl(var(--profit))" fill="hsl(var(--profit))" strokeWidth={2} fillOpacity={0.15} />}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoanPayoffSimulator;
