/** FUNC-15: Anschlussfinanzierungs-Rechner (Refinancing Calculator)
 * Calculates new monthly payments and savings when refinancing at different rates. */
import { memo, useMemo, useState } from "react";
import { Calculator, TrendingDown, Landmark, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/NumberInput";

interface RefinancingCalculatorProps {
  /** Current remaining balance */
  currentBalance: number;
  /** Current interest rate (%) */
  currentRate: number;
  /** Current monthly payment */
  currentMonthlyPayment: number;
  /** Bank name for display */
  bankName: string;
}

const RefinancingCalculator = memo(({ currentBalance, currentRate, currentMonthlyPayment, bankName }: RefinancingCalculatorProps) => {
  const [newRate, setNewRate] = useState(3.0);
  const [newTerm, setNewTerm] = useState(15); // years
  const [showDetails, setShowDetails] = useState(false);

  const result = useMemo(() => {
    if (currentBalance <= 0 || newRate <= 0 || newTerm <= 0) return null;

    const monthlyRate = newRate / 100 / 12;
    const totalPayments = newTerm * 12;

    // Annuity formula
    const newMonthlyPayment = currentBalance * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
    const totalPaid = newMonthlyPayment * totalPayments;
    const totalInterest = totalPaid - currentBalance;
    const monthlySavings = currentMonthlyPayment - newMonthlyPayment;
    const annualSavings = monthlySavings * 12;

    // Remaining balance after fixed period
    let balance = currentBalance;
    for (let i = 0; i < totalPayments; i++) {
      const interest = balance * monthlyRate;
      balance = balance + interest - newMonthlyPayment;
    }

    return {
      newMonthlyPayment: Math.round(newMonthlyPayment * 100) / 100,
      monthlySavings: Math.round(monthlySavings * 100) / 100,
      annualSavings: Math.round(annualSavings * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      remainingBalance: Math.max(0, Math.round(balance * 100) / 100),
    };
  }, [currentBalance, currentMonthlyPayment, newRate, newTerm]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Anschlussfinanzierung</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{bankName}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Restschuld</Label>
          <p className="text-sm font-medium">{formatCurrency(currentBalance)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Aktuelle Rate</Label>
          <p className="text-sm font-medium">{formatCurrency(currentMonthlyPayment)}/M</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Neuer Zinssatz (%)</Label>
          <NumberInput value={newRate} onChange={setNewRate} min={0.1} max={15} step={0.1} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Laufzeit (Jahre)</Label>
          <NumberInput value={newTerm} onChange={setNewTerm} min={1} max={40} step={1} className="h-8 text-sm" />
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">Neue Rate</span>
            </div>
            <span className="text-sm font-bold">{formatCurrency(result.newMonthlyPayment)}/M</span>
          </div>

          {result.monthlySavings > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-profit/10">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3 w-3 text-profit" />
                <span className="text-xs text-profit font-medium">Ersparnis</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-profit">{formatCurrency(result.monthlySavings)}/M</p>
                <p className="text-[10px] text-profit">{formatCurrency(result.annualSavings)}/Jahr</p>
              </div>
            </div>
          )}

          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Details ausblenden" : "Details anzeigen"}
          </Button>

          {showDetails && (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gesamtzinsen</span>
                <span className="font-medium">{formatCurrency(result.totalInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gesamtkosten</span>
                <span className="font-medium">{formatCurrency(result.totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aktual. Zins vs Neu</span>
                <span className="font-medium">{currentRate.toFixed(2)}% → {newRate.toFixed(2)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
RefinancingCalculator.displayName = "RefinancingCalculator";

export { RefinancingCalculator };
