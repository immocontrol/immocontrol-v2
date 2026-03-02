import { Info, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import type { AnalysisInputState } from "@/hooks/useAnalysisCalculations";
import type { AnalysisCalcResult } from "@/hooks/useAnalysisCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number) => `${value.toFixed(2)}%`;

interface Props {
  inputs: AnalysisInputState;
  calc: AnalysisCalcResult;
}

const AnalysisResults = ({ inputs, calc }: Props) => {
  // Improvement 6: EK payback period
  const ekPayback = calc.jahresCashflow > 0 ? inputs.eigenkapital / calc.jahresCashflow : Infinity;
  // Improvement 7: Debt-Service-Coverage-Ratio
  const nettoMiete = (inputs.monatlicheMiete - inputs.bewirtschaftungskosten) * 12;
  const jahresRate = calc.monatlicheRate * 12;
  const dscr = jahresRate > 0 ? nettoMiete / jahresRate : 0;
  // Improvement 8: EK share safe check
  const ekAnteil = calc.gesamtkosten > 0 ? (inputs.eigenkapital / calc.gesamtkosten) * 100 : 0;
  // Improvement 9: Nebenkosten percentage
  const nebenkostenPct = inputs.kaufpreis > 0 ? (calc.kaufnebenkosten / inputs.kaufpreis) * 100 : 0;

  return (
    <>
      {/* Kaufnebenkosten */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:100ms]" role="region" aria-label="Kaufnebenkosten">
        <h2 className="text-sm font-semibold mb-3 flex items-center justify-between">
          Kaufnebenkosten
          {/* Improvement 9 */}
          <span className="text-xs font-normal text-muted-foreground">{nebenkostenPct.toFixed(1)}% vom KP</span>
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grunderwerbsteuer</span>
            <span>{formatCurrency(calc.grunderwerbsteuer)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Makler</span>
            <span>{formatCurrency(calc.makler)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Notar & Grundbuch</span>
            <span>{formatCurrency(calc.notar)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-semibold">
            <span>Nebenkosten gesamt</span>
            <span className="text-gold">{formatCurrency(calc.kaufnebenkosten)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Gesamtkosten</span>
            <span>{formatCurrency(calc.gesamtkosten)}</span>
          </div>
        </div>
      </div>

      {/* Rendite */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:200ms]" role="region" aria-label="Renditekennzahlen">
        <h2 className="text-sm font-semibold mb-3">Renditekennzahlen</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Brutto-Rendite</div>
            <div className={`text-2xl font-bold ${calc.bruttoRendite >= 5 ? "text-profit" : calc.bruttoRendite >= 3 ? "text-gold" : "text-loss"}`}>{formatPercent(calc.bruttoRendite)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Netto-Rendite</div>
            <div className={`text-2xl font-bold ${calc.nettoRendite >= 3 ? "text-profit" : calc.nettoRendite >= 1.5 ? "text-gold" : "text-loss"}`}>{formatPercent(calc.nettoRendite)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Cash-on-Cash</div>
            <div className={`text-2xl font-bold ${calc.cashOnCash >= 5 ? "text-profit" : calc.cashOnCash >= 0 ? "text-gold" : "text-loss"}`}>
              {formatPercent(calc.cashOnCash)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Mietmultiplikator</div>
            <div className={`text-2xl font-bold ${calc.mietmultiplikator <= 20 ? "text-profit" : calc.mietmultiplikator <= 25 ? "text-gold" : "text-loss"}`}>{calc.mietmultiplikator.toFixed(1)}x</div>
          </div>
        </div>
        {inputs.quadratmeter > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-border">
            <div>
              <div className="text-xs text-muted-foreground">Preis/m²</div>
              <div className="text-lg font-bold">{formatCurrency(calc.preisProQm)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Miete/m²</div>
              <div className="text-lg font-bold">{formatCurrency(calc.mieteProQm)}</div>
            </div>
          </div>
        )}
        {/* Improvement 10: DSCR */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            DSCR
            <span className="relative group">
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              <span className="absolute left-0 bottom-full mb-1 w-48 bg-popover text-popover-foreground text-[10px] p-2 rounded-lg shadow-lg border border-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                Debt Service Coverage Ratio: Nettomiete / Kreditrate. Ab 1.2 gilt als sicher.
              </span>
            </span>
          </span>
          <span className={`font-bold ${dscr >= 1.2 ? "text-profit" : dscr >= 1.0 ? "text-gold" : "text-loss"}`}>
            {dscr.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Cashflow - Improvement 11: Visual waterfall */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:300ms]" role="region" aria-label="Monatlicher Cashflow">
        <h2 className="text-sm font-semibold mb-3">Monatlicher Cashflow</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Mieteinnahmen</span>
            <span className="text-profit font-medium">+{formatCurrency(inputs.monatlicheMiete)}</span>
          </div>
          {/* Improvement 11: Mini bar chart */}
          <div className="h-1.5 bg-profit/20 rounded-full">
            <div className="h-full bg-profit rounded-full" style={{ width: "100%" }} />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Bewirtschaftung</span>
            <span className="text-loss">-{formatCurrency(inputs.bewirtschaftungskosten)}</span>
          </div>
          <div className="h-1.5 bg-loss/20 rounded-full">
            <div className="h-full bg-loss rounded-full" style={{ width: `${inputs.monatlicheMiete > 0 ? Math.min(100, (inputs.bewirtschaftungskosten / inputs.monatlicheMiete) * 100) : 0}%` }} />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Kreditrate</span>
            <span className="text-loss">-{formatCurrency(calc.monatlicheRate)}</span>
          </div>
          <div className="h-1.5 bg-loss/20 rounded-full">
            <div className="h-full bg-loss rounded-full" style={{ width: `${inputs.monatlicheMiete > 0 ? Math.min(100, (calc.monatlicheRate / inputs.monatlicheMiete) * 100) : 0}%` }} />
          </div>

          <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
            <span>Cashflow / Monat</span>
            <span className={calc.monatsCashflow >= 0 ? "text-profit" : "text-loss"}>
              {formatCurrency(calc.monatsCashflow)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Cashflow / Jahr</span>
            <span className={calc.jahresCashflow >= 0 ? "text-profit" : "text-loss"}>
              {formatCurrency(calc.jahresCashflow)}
            </span>
          </div>

          {/* Improvement 6: EK payback */}
          {ekPayback !== Infinity && ekPayback > 0 && (
            <div className="flex justify-between text-xs pt-1.5 border-t border-border/50 text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> EK-Rückfluss
              </span>
              <span className="font-medium text-foreground">{ekPayback.toFixed(1)} Jahre</span>
            </div>
          )}
        </div>
      </div>

      {/* Steuer */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:400ms]" role="region" aria-label="Steuerliche Betrachtung">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          Steuerliche Betrachtung
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">AfA / Jahr</span>
            <span>{formatCurrency(calc.afaJaehrlich)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Steuerl. Ergebnis</span>
            <span className={calc.steuerlichesErgebnis <= 0 ? "text-profit" : ""}>{formatCurrency(calc.steuerlichesErgebnis)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Steuereffekt / Jahr</span>
            <span className={calc.steuerEffekt < 0 ? "text-profit" : "text-loss"}>
              {formatCurrency(calc.steuerEffekt)}
            </span>
          </div>
          {/* Improvement 12: Monthly after-tax */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Steuereffekt / Monat</span>
            <span className={calc.steuerEffekt / 12 < 0 ? "text-profit" : "text-loss"}>
              {formatCurrency(calc.steuerEffekt / 12)}
            </span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
            <span>CF nach Steuer / Jahr</span>
            <span className={calc.cashflowNachSteuer >= 0 ? "text-profit" : "text-loss"}>
              {formatCurrency(calc.cashflowNachSteuer)}
            </span>
          </div>
          {/* Improvement 12: monthly */}
          <div className="flex justify-between text-muted-foreground">
            <span>CF nach Steuer / Monat</span>
            <span className={calc.cashflowNachSteuer >= 0 ? "text-profit" : "text-loss"}>
              {formatCurrency(calc.cashflowNachSteuer / 12)}
            </span>
          </div>
        </div>
      </div>

      {/* Finanzierung */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:450ms]" role="region" aria-label="Finanzierung">
        <h2 className="text-sm font-semibold mb-3">Finanzierung</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Darlehensbetrag</span>
            <span className="font-medium">{formatCurrency(calc.darlehen)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monatliche Rate</span>
            <span className="font-medium">{formatCurrency(calc.monatlicheRate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Eigenkapital-Anteil</span>
            <span className="font-medium">{ekAnteil.toFixed(1)}%</span>
          </div>
          {/* Improvement 13: LTV */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Beleihungsauslauf (LTV)</span>
            <span className={`font-medium ${(calc.darlehen / inputs.kaufpreis * 100) <= 80 ? "text-profit" : "text-loss"}`}>
              {inputs.kaufpreis > 0 ? (calc.darlehen / inputs.kaufpreis * 100).toFixed(1) : 0}%
            </span>
          </div>
          {/* Improvement 14: Visual EK/FK split */}
          <div className="pt-2">
            <div className="flex text-[10px] justify-between text-muted-foreground mb-1">
              <span>EK {ekAnteil.toFixed(0)}%</span>
              <span>FK {(100 - ekAnteil).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-loss/20 rounded-full overflow-hidden">
              <div className="h-full bg-profit rounded-l-full" style={{ width: `${Math.min(100, ekAnteil)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AnalysisResults;
