/**
 * MOB6-17: Mobile Quick Calculator
 * Immobilien quick calculator with yield, annuity, and closing costs calculations.
 * Compact, touch-optimized with instant results.
 */
import { useState, useMemo, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calculator, TrendingUp, Euro, Percent, Home, ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type CalcMode = "rendite" | "annuitaet" | "nebenkosten";

interface MobileQuickCalculatorProps {
  /** Default calculation mode */
  defaultMode?: CalcMode;
  /** Pre-fill purchase price */
  defaultPrice?: number;
  /** Closing costs percentages per state */
  closingCostsConfig?: {
    grunderwerbsteuer: number;
    notar: number;
    grundbuch: number;
    makler: number;
  };
  /** Additional class */
  className?: string;
}

const modeLabels: Record<CalcMode, string> = {
  rendite: "Rendite",
  annuitaet: "Annuität",
  nebenkosten: "Kaufnebenkosten",
};

const modeIcons: Record<CalcMode, React.ReactNode> = {
  rendite: <TrendingUp className="w-4 h-4" />,
  annuitaet: <Euro className="w-4 h-4" />,
  nebenkosten: <Home className="w-4 h-4" />,
};

function formatEuro(val: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
}

function formatPercent(val: number): string {
  return new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);
}

export const MobileQuickCalculator = memo(function MobileQuickCalculator({
  defaultMode = "rendite",
  defaultPrice = 200000,
  closingCostsConfig = {
    grunderwerbsteuer: 6.0, // Berlin
    notar: 1.5,
    grundbuch: 0.5,
    makler: 3.57,
  },
  className,
}: MobileQuickCalculatorProps) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<CalcMode>(defaultMode);
  const [showDetails, setShowDetails] = useState(false);

  // Rendite inputs
  const [purchasePrice, setPurchasePrice] = useState(defaultPrice);
  const [monthlyRent, setMonthlyRent] = useState(800);
  const [operatingCosts, setOperatingCosts] = useState(200);

  // Annuität inputs
  const [loanAmount, setLoanAmount] = useState(160000);
  const [interestRate, setInterestRate] = useState(3.5);
  const [repaymentRate, setRepaymentRate] = useState(2.0);
  const [loanTerm, setLoanTerm] = useState(10);

  // Calculations
  const renditeResult = useMemo(() => {
    const annualRent = monthlyRent * 12;
    const annualNet = (monthlyRent - operatingCosts) * 12;
    const totalCostsPercent = closingCostsConfig.grunderwerbsteuer + closingCostsConfig.notar +
      closingCostsConfig.grundbuch + closingCostsConfig.makler;
    const totalCosts = purchasePrice * (totalCostsPercent / 100);
    const totalInvestment = purchasePrice + totalCosts;

    const bruttoRendite = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;
    const nettoRendite = totalInvestment > 0 ? (annualNet / totalInvestment) * 100 : 0;
    const mietmultiplikator = monthlyRent > 0 ? purchasePrice / annualRent : 0;

    return {
      bruttoRendite,
      nettoRendite,
      mietmultiplikator,
      annualRent,
      annualNet,
      totalCosts,
      totalInvestment,
    };
  }, [purchasePrice, monthlyRent, operatingCosts, closingCostsConfig]);

  const annuitaetResult = useMemo(() => {
    const monthlyRate = (interestRate + repaymentRate) / 100 / 12 * loanAmount;
    const monthlyInterest = interestRate / 100 / 12 * loanAmount;
    const monthlyRepayment = monthlyRate - monthlyInterest;
    const annualRate = monthlyRate * 12;

    // Remaining debt after term
    let remaining = loanAmount;
    for (let m = 0; m < loanTerm * 12; m++) {
      const interest = remaining * (interestRate / 100 / 12);
      const repayment = monthlyRate - interest;
      remaining -= repayment;
      if (remaining <= 0) { remaining = 0; break; }
    }

    const totalInterest = (monthlyRate * loanTerm * 12) - (loanAmount - remaining);

    return {
      monthlyRate,
      monthlyInterest,
      monthlyRepayment,
      annualRate,
      remainingDebt: Math.max(0, remaining),
      totalInterest,
    };
  }, [loanAmount, interestRate, repaymentRate, loanTerm]);

  const nebenkostenResult = useMemo(() => {
    const grunderwerbsteuer = purchasePrice * (closingCostsConfig.grunderwerbsteuer / 100);
    const notar = purchasePrice * (closingCostsConfig.notar / 100);
    const grundbuch = purchasePrice * (closingCostsConfig.grundbuch / 100);
    const makler = purchasePrice * (closingCostsConfig.makler / 100);
    const total = grunderwerbsteuer + notar + grundbuch + makler;

    return {
      grunderwerbsteuer,
      notar,
      grundbuch,
      makler,
      total,
      totalPercent: purchasePrice > 0 ? (total / purchasePrice) * 100 : 0,
      totalCost: purchasePrice + total,
    };
  }, [purchasePrice, closingCostsConfig]);

  const renderInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    options: { suffix?: string; min?: number; max?: number; step?: number } = {}
  ) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-muted-foreground">{label}</label>
        <span className="text-[10px] font-medium">
          {options.suffix === "€" ? formatEuro(value) : options.suffix === "%" ? `${value}%` : value}
        </span>
      </div>
      <input
        type="range"
        min={options.min ?? 0}
        max={options.max ?? 100}
        step={options.step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
      />
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      {/* Mode selector */}
      <div className="flex rounded-xl border overflow-hidden mb-3">
        {(Object.keys(modeLabels) as CalcMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
              mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              isMobile && "min-h-[44px]"
            )}
          >
            {modeIcons[m]}
            {!isMobile && modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Rendite mode */}
      {mode === "rendite" && (
        <div className="space-y-4">
          <div className="space-y-3">
            {renderInput("Kaufpreis", purchasePrice, setPurchasePrice, { suffix: "€", min: 50000, max: 2000000, step: 10000 })}
            {renderInput("Kaltmiete / Monat", monthlyRent, setMonthlyRent, { suffix: "€", min: 100, max: 5000, step: 50 })}
            {renderInput("Nebenkosten / Monat", operatingCosts, setOperatingCosts, { suffix: "€", min: 0, max: 2000, step: 25 })}
          </div>

          {/* Results */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-primary/5 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Brutto-Rendite</p>
              <p className={cn("text-base font-bold", renditeResult.bruttoRendite >= 5 ? "text-green-600" : "text-foreground")}>
                {renditeResult.bruttoRendite.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl bg-primary/5 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Netto-Rendite</p>
              <p className={cn("text-base font-bold", renditeResult.nettoRendite >= 3.5 ? "text-green-600" : "text-foreground")}>
                {renditeResult.nettoRendite.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl bg-primary/5 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Faktor</p>
              <p className={cn("text-base font-bold", renditeResult.mietmultiplikator <= 20 ? "text-green-600" : "text-foreground")}>
                {renditeResult.mietmultiplikator.toFixed(1)}x
              </p>
            </div>
          </div>

          {/* Details */}
          <button
            onClick={() => setShowDetails(prev => !prev)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Details
          </button>
          {showDetails && (
            <div className="space-y-1 text-[10px] bg-muted/30 rounded-lg p-2">
              <div className="flex justify-between"><span>Jahresmiete (brutto):</span><span className="font-medium">{formatEuro(renditeResult.annualRent)}</span></div>
              <div className="flex justify-between"><span>Jahresmiete (netto):</span><span className="font-medium">{formatEuro(renditeResult.annualNet)}</span></div>
              <div className="flex justify-between"><span>Kaufnebenkosten:</span><span className="font-medium">{formatEuro(renditeResult.totalCosts)}</span></div>
              <div className="flex justify-between font-medium"><span>Gesamtinvestition:</span><span>{formatEuro(renditeResult.totalInvestment)}</span></div>
            </div>
          )}
        </div>
      )}

      {/* Annuität mode */}
      {mode === "annuitaet" && (
        <div className="space-y-4">
          <div className="space-y-3">
            {renderInput("Darlehensbetrag", loanAmount, setLoanAmount, { suffix: "€", min: 10000, max: 2000000, step: 10000 })}
            {renderInput("Sollzins", interestRate, setInterestRate, { suffix: "%", min: 0.5, max: 10, step: 0.1 })}
            {renderInput("Tilgung", repaymentRate, setRepaymentRate, { suffix: "%", min: 0.5, max: 10, step: 0.1 })}
            {renderInput("Zinsbindung (Jahre)", loanTerm, setLoanTerm, { min: 5, max: 30, step: 1 })}
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-primary/5 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Monatsrate</p>
              <p className="text-base font-bold">{formatEuro(annuitaetResult.monthlyRate)}</p>
            </div>
            <div className="rounded-xl bg-primary/5 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Restschuld</p>
              <p className="text-base font-bold">{formatEuro(annuitaetResult.remainingDebt)}</p>
            </div>
          </div>

          {showDetails || true ? (
            <div className="space-y-1 text-[10px] bg-muted/30 rounded-lg p-2">
              <div className="flex justify-between"><span>davon Zinsen / Monat:</span><span className="font-medium">{formatEuro(annuitaetResult.monthlyInterest)}</span></div>
              <div className="flex justify-between"><span>davon Tilgung / Monat:</span><span className="font-medium">{formatEuro(annuitaetResult.monthlyRepayment)}</span></div>
              <div className="flex justify-between"><span>Jahresrate:</span><span className="font-medium">{formatEuro(annuitaetResult.annualRate)}</span></div>
              <div className="flex justify-between"><span>Zinsen gesamt ({loanTerm} J.):</span><span className="font-medium">{formatEuro(annuitaetResult.totalInterest)}</span></div>
            </div>
          ) : null}
        </div>
      )}

      {/* Nebenkosten mode */}
      {mode === "nebenkosten" && (
        <div className="space-y-4">
          <div className="space-y-3">
            {renderInput("Kaufpreis", purchasePrice, setPurchasePrice, { suffix: "€", min: 50000, max: 2000000, step: 10000 })}
          </div>

          {/* Breakdown */}
          <div className="space-y-1.5">
            {[
              { label: "Grunderwerbsteuer", rate: closingCostsConfig.grunderwerbsteuer, value: nebenkostenResult.grunderwerbsteuer },
              { label: "Notar", rate: closingCostsConfig.notar, value: nebenkostenResult.notar },
              { label: "Grundbuch", rate: closingCostsConfig.grundbuch, value: nebenkostenResult.grundbuch },
              { label: "Makler", rate: closingCostsConfig.makler, value: nebenkostenResult.makler },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <span className="text-xs">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({item.rate}%)</span>
                </div>
                <span className="text-xs font-medium">{formatEuro(item.value)}</span>
              </div>
            ))}

            {/* Total */}
            <div className="flex items-center justify-between py-2 border-t-2 font-semibold">
              <span className="text-xs">Kaufnebenkosten gesamt</span>
              <span className="text-xs text-primary">{formatEuro(nebenkostenResult.total)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs">Gesamtkosten inkl. Kaufpreis</span>
              <span className="text-sm font-bold">{formatEuro(nebenkostenResult.totalCost)}</span>
            </div>
          </div>

          {/* Visual bar */}
          <div className="rounded-full h-3 bg-muted overflow-hidden flex">
            <div className="bg-blue-500 h-full" style={{ width: `${(closingCostsConfig.grunderwerbsteuer / nebenkostenResult.totalPercent) * 100}%` }} title="Grunderwerbsteuer" />
            <div className="bg-green-500 h-full" style={{ width: `${(closingCostsConfig.notar / nebenkostenResult.totalPercent) * 100}%` }} title="Notar" />
            <div className="bg-amber-500 h-full" style={{ width: `${(closingCostsConfig.grundbuch / nebenkostenResult.totalPercent) * 100}%` }} title="Grundbuch" />
            <div className="bg-purple-500 h-full" style={{ width: `${(closingCostsConfig.makler / nebenkostenResult.totalPercent) * 100}%` }} title="Makler" />
          </div>
          <div className="flex flex-wrap gap-2 text-[9px]">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />GrESt</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" />Notar</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />Grundbuch</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" />Makler</span>
          </div>
        </div>
      )}
    </div>
  );
});
