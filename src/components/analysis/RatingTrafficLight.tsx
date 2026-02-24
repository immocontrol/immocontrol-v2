import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { AnalysisCalcResult } from "@/hooks/useAnalysisCalculations";

interface Props {
  calc: AnalysisCalcResult;
}

type Rating = "good" | "ok" | "bad";

const getRating = (calc: AnalysisCalcResult): { overall: Rating; score: number; items: { label: string; rating: Rating; detail: string; tip: string }[] } => {
  const items: { label: string; rating: Rating; detail: string; tip: string }[] = [];

  // Brutto-Rendite
  if (calc.bruttoRendite >= 6) items.push({ label: "Brutto-Rendite", rating: "good", detail: `${calc.bruttoRendite.toFixed(1)}% ≥ 6%`, tip: "Jahresmiete / Kaufpreis. Ab 6% gilt als attraktiv." });
  else if (calc.bruttoRendite >= 4) items.push({ label: "Brutto-Rendite", rating: "ok", detail: `${calc.bruttoRendite.toFixed(1)}% (4-6%)`, tip: "Jahresmiete / Kaufpreis. 4-6% ist akzeptabel." });
  else items.push({ label: "Brutto-Rendite", rating: "bad", detail: `${calc.bruttoRendite.toFixed(1)}% < 4%`, tip: "Jahresmiete / Kaufpreis. Unter 4% ist risikoreich." });

  // Improvement 1: Netto-Rendite added
  if (calc.nettoRendite >= 4) items.push({ label: "Netto-Rendite", rating: "good", detail: `${calc.nettoRendite.toFixed(1)}% ≥ 4%`, tip: "(Miete - Kosten) / Kaufpreis. Ab 4% sehr gut." });
  else if (calc.nettoRendite >= 2) items.push({ label: "Netto-Rendite", rating: "ok", detail: `${calc.nettoRendite.toFixed(1)}% (2-4%)`, tip: "(Miete - Kosten) / Kaufpreis. Solide Basis." });
  else items.push({ label: "Netto-Rendite", rating: "bad", detail: `${calc.nettoRendite.toFixed(1)}% < 2%`, tip: "(Miete - Kosten) / Kaufpreis. Zu niedrig für ein gutes Investment." });

  // Cashflow
  if (calc.monatsCashflow >= 200) items.push({ label: "Cashflow", rating: "good", detail: `${calc.monatsCashflow.toFixed(0)}€ ≥ 200€`, tip: "Miete minus alle Kosten und Kreditrate. Ab 200€/M ideal." });
  else if (calc.monatsCashflow >= 0) items.push({ label: "Cashflow", rating: "ok", detail: `${calc.monatsCashflow.toFixed(0)}€ (0-200€)`, tip: "Positiv aber knapp. Rücklagen einplanen." });
  else items.push({ label: "Cashflow", rating: "bad", detail: `${calc.monatsCashflow.toFixed(0)}€ < 0€`, tip: "Negativ = du zahlst monatlich drauf. Überprüfe Finanzierung." });

  // Mietmultiplikator
  if (calc.mietmultiplikator <= 20) items.push({ label: "Mietmultiplikator", rating: "good", detail: `${calc.mietmultiplikator.toFixed(1)}x ≤ 20x`, tip: "Kaufpreis / Jahresmiete. Unter 20 = schnelle Amortisation." });
  else if (calc.mietmultiplikator <= 25) items.push({ label: "Mietmultiplikator", rating: "ok", detail: `${calc.mietmultiplikator.toFixed(1)}x (20-25x)`, tip: "Kaufpreis / Jahresmiete. 20-25 ist marktüblich." });
  else items.push({ label: "Mietmultiplikator", rating: "bad", detail: `${calc.mietmultiplikator.toFixed(1)}x > 25x`, tip: "Kaufpreis / Jahresmiete. Über 25 = teuer eingekauft." });

  // Cash-on-Cash
  if (calc.cashOnCash >= 8) items.push({ label: "Cash-on-Cash", rating: "good", detail: `${calc.cashOnCash.toFixed(1)}% ≥ 8%`, tip: "Jährlicher Cashflow / Eigenkapital. Ab 8% exzellent." });
  else if (calc.cashOnCash >= 3) items.push({ label: "Cash-on-Cash", rating: "ok", detail: `${calc.cashOnCash.toFixed(1)}% (3-8%)`, tip: "Jährlicher Cashflow / Eigenkapital. Solide Rendite." });
  else items.push({ label: "Cash-on-Cash", rating: "bad", detail: `${calc.cashOnCash.toFixed(1)}% < 3%`, tip: "Jährlicher Cashflow / Eigenkapital. Unter 3% lohnt kaum." });

  // Improvement 2: Cashflow nach Steuer
  if (calc.cashflowNachSteuer >= 0) items.push({ label: "CF nach Steuer", rating: "good", detail: `${calc.cashflowNachSteuer.toFixed(0)}€/J ≥ 0€`, tip: "Cashflow abzüglich Steuern. Positiv = nachhaltig profitabel." });
  else if (calc.cashflowNachSteuer >= -2000) items.push({ label: "CF nach Steuer", rating: "ok", detail: `${calc.cashflowNachSteuer.toFixed(0)}€/J`, tip: "Leicht negativ, aber Wertsteigerung kann kompensieren." });
  else items.push({ label: "CF nach Steuer", rating: "bad", detail: `${calc.cashflowNachSteuer.toFixed(0)}€/J`, tip: "Deutlich negativ nach Steuer. Hohe laufende Belastung." });

  const goods = items.filter(i => i.rating === "good").length;
  const oks = items.filter(i => i.rating === "ok").length;
  const bads = items.filter(i => i.rating === "bad").length;
  const score = Math.round((goods * 100 + oks * 50) / items.length);
  const overall: Rating = goods >= 4 ? "good" : bads >= 4 ? "bad" : "ok";

  return { overall, score, items };
};

const ratingConfig = {
  good: { icon: CheckCircle2, color: "text-profit", bg: "bg-profit/10", barColor: "bg-profit", label: "Gut" },
  ok: { icon: AlertTriangle, color: "text-gold", bg: "bg-gold/10", barColor: "bg-gold", label: "Mittel" },
  bad: { icon: XCircle, color: "text-loss", bg: "bg-loss/10", barColor: "bg-loss", label: "Schwach" },
};

const RatingTrafficLight = ({ calc }: Props) => {
  const { overall, score, items } = getRating(calc);
  const config = ratingConfig[overall];
  const Icon = config.icon;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Bewertung: {config.label}</div>
          <div className="text-xs text-muted-foreground">Basierend auf {items.length} Kennzahlen</div>
        </div>
        {/* Improvement 3: Score badge */}
        <div className={`text-lg font-bold ${config.color}`}>
          {score}
          <span className="text-xs font-normal text-muted-foreground">/100</span>
        </div>
      </div>

      {/* Improvement 4: Score progress bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const ic = ratingConfig[item.rating];
          const ItemIcon = ic.icon;
          return (
            <div key={item.label} className="flex items-center gap-2 text-sm group">
              <ItemIcon className={`h-3.5 w-3.5 ${ic.color} shrink-0`} />
              <span className="text-muted-foreground">{item.label}</span>
              {/* Improvement 5: Tooltip for each KPI */}
              <div className="relative ml-auto flex items-center gap-1.5">
                <span className="text-xs font-medium">{item.detail}</span>
                <div className="relative">
                  <Info className="h-3 w-3 text-muted-foreground/50 cursor-help peer" />
                  <div className="absolute right-0 bottom-full mb-1 w-52 bg-popover text-popover-foreground text-[10px] p-2 rounded-lg shadow-lg border border-border opacity-0 pointer-events-none peer-hover:opacity-100 peer-hover:pointer-events-auto transition-opacity z-50">
                    {item.tip}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RatingTrafficLight;
