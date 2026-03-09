/**
 * INHALT-15: Steuer-Optimierungs-Assistent — Steuerspar-Tipps
 * Basierend auf eigenen Daten: Empfehlungen für Sonder-AfA, Erhaltungsaufwand,
 * optimale Verteilung von Renovierungskosten, Abschreibungspotenziale.
 */
import { memo, useMemo, useState } from "react";
import { Sparkles, TrendingDown, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { getAnnualAfa, getGebaeudeAnteil } from "@/lib/afaSanierung";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { isDeepSeekConfigured, suggestSteuerTipps } from "@/integrations/ai/extractors";

interface TaxTip {
  id: string;
  title: string;
  description: string;
  potentialSaving: number;
  category: "afa" | "zinsen" | "erhaltung" | "sonstiges";
  priority: "hoch" | "mittel" | "niedrig";
  legalReference: string;
}

const SteuerOptimierung = memo(() => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);
  const [taxRate, setTaxRate] = useState(42);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: loans = [] } = useQuery({
    queryKey: ["steueropt_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment, property_id");
      return (data || []) as Array<{
        id: string; remaining_balance: number; interest_rate: number;
        monthly_payment: number; property_id: string;
      }>;
    },
    enabled: !!user,
  });

  const tips = useMemo((): TaxTip[] => {
    if (properties.length === 0) return [];
    const result: TaxTip[] = [];

    // 1. Standard AfA check
    const totalAfA = properties.reduce((sum, p) => sum + getAnnualAfa({ purchasePrice: p.purchasePrice, yearBuilt: p.yearBuilt, buildingSharePercent: p.buildingSharePercent, restnutzungsdauer: p.restnutzungsdauer }), 0);
    if (totalAfA > 0) {
      result.push({
        id: "afa_standard",
        title: "Lineare AfA nutzen",
        description: `Sie können ${formatCurrency(totalAfA)}/Jahr als Abschreibung geltend machen. Das spart ${formatCurrency(totalAfA * taxRate / 100)} Steuern.`,
        potentialSaving: totalAfA * taxRate / 100,
        category: "afa",
        priority: "hoch",
        legalReference: "§7 Abs. 4 EStG",
      });
    }

    // 2. Sonder-AfA §7b EStG (new buildings after 2023)
    const newBuildings = properties.filter((p) => p.yearBuilt >= 2023);
    if (newBuildings.length > 0) {
      const sonderAfA = newBuildings.reduce((s, p) => s + getGebaeudeAnteil({ purchasePrice: p.purchasePrice, buildingSharePercent: p.buildingSharePercent }) * 0.05, 0);
      result.push({
        id: "sonder_afa",
        title: "Sonder-AfA §7b EStG prüfen",
        description: `${newBuildings.length} Neubau(ten) können ggf. 5% Sonder-AfA beanspruchen = ${formatCurrency(sonderAfA)}/Jahr zusätzlich.`,
        potentialSaving: sonderAfA * taxRate / 100,
        category: "afa",
        priority: "hoch",
        legalReference: "§7b EStG",
      });
    }

    // 3. Altbau-AfA 2,5%
    const altbauten = properties.filter((p) => p.yearBuilt < 1925);
    if (altbauten.length > 0) {
      result.push({
        id: "altbau_afa",
        title: "Erhöhte AfA für Altbauten",
        description: `${altbauten.length} Objekt(e) vor 1925 errichtet — 2,5% statt 2% AfA möglich.`,
        potentialSaving: altbauten.reduce((s, p) => s + getGebaeudeAnteil({ purchasePrice: p.purchasePrice, buildingSharePercent: p.buildingSharePercent }) * 0.005 * taxRate / 100, 0),
        category: "afa",
        priority: "mittel",
        legalReference: "§7 Abs. 4 Satz 2 EStG",
      });
    }

    // 4. Schuldzinsen absetzen
    const totalInterest = loans.reduce((s, l) => s + l.remaining_balance * l.interest_rate / 100, 0);
    if (totalInterest > 0) {
      result.push({
        id: "schuldzinsen",
        title: "Schuldzinsen als Werbungskosten",
        description: `${formatCurrency(totalInterest)}/Jahr Zinsen sind voll absetzbar als Werbungskosten.`,
        potentialSaving: totalInterest * taxRate / 100,
        category: "zinsen",
        priority: "hoch",
        legalReference: "§9 Abs. 1 Nr. 1 EStG",
      });
    }

    // 5. Erhaltungsaufwand vs. Herstellungskosten
    result.push({
      id: "erhaltung_vs_herstellung",
      title: "Erhaltungsaufwand sofort absetzen",
      description: "Renovierungen unter 4.000€ netto pro Maßnahme können als Erhaltungsaufwand sofort abgesetzt werden statt über Jahre abgeschrieben.",
      potentialSaving: 0,
      category: "erhaltung",
      priority: "mittel",
      legalReference: "§11 Abs. 2 EStG",
    });

    // 6. Verteilung auf 2-5 Jahre
    result.push({
      id: "verteilung_2_5",
      title: "Erhaltungsaufwand auf 2-5 Jahre verteilen",
      description: "Größere Erhaltungsaufwendungen können auf 2-5 Jahre gleichmäßig verteilt werden (§82b EStDV). Sinnvoll bei stark schwankenden Einkünften.",
      potentialSaving: 0,
      category: "erhaltung",
      priority: "niedrig",
      legalReference: "§82b EStDV",
    });

    // 7. Gewerblichkeit-Warnung
    if (properties.length >= 3) {
      result.push({
        id: "gewerblichkeit",
        title: "Drei-Objekt-Grenze beachten",
        description: `Mit ${properties.length} Objekten nähern Sie sich der Grenze zum gewerblichen Grundstückshandel. Bei Verkauf innerhalb von 5 Jahren nach Kauf droht Gewerbesteuer.`,
        potentialSaving: 0,
        category: "sonstiges",
        priority: "hoch",
        legalReference: "§15 EStG, BMF-Schreiben",
      });
    }

    // 8. Fahrtkosten
    result.push({
      id: "fahrtkosten",
      title: "Fahrtkosten zu Immobilien",
      description: "Fahrten zu Ihren Immobilien (Besichtigungen, Handwerkertermine, Eigentümerversammlungen) sind mit 0,30€/km absetzbar.",
      potentialSaving: properties.length * 24 * 0.3 * 50 * taxRate / 100, // ~24 Fahrten/Jahr * 50km avg
      category: "sonstiges",
      priority: "niedrig",
      legalReference: "§9 EStG",
    });

    return result.sort((a, b) => b.potentialSaving - a.potentialSaving);
  }, [properties, loans, taxRate]);

  if (properties.length === 0) return null;

  const totalSaving = tips.reduce((s, t) => s + t.potentialSaving, 0);
  const highPriority = tips.filter((t) => t.priority === "hoch").length;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Steuer-Optimierung</h3>
          {highPriority > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 text-profit">{highPriority} wichtig</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Total savings potential */}
      {totalSaving > 0 && (
        <div className="text-center p-2 rounded-lg bg-profit/5 border border-profit/20 mb-3">
          <p className="text-[10px] text-muted-foreground">Geschätztes Sparpotenzial/Jahr</p>
          <p className="text-lg font-bold text-profit">{formatCurrency(totalSaving)}</p>
          <p className="text-[10px] text-muted-foreground">bei {taxRate}% Grenzsteuersatz</p>
          {isDeepSeekConfigured() && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 gap-1 text-xs"
              disabled={aiLoading}
              onClick={async () => {
                setAiLoading(true);
                try {
                  const totalAfA = properties.reduce((s, p) => s + getAnnualAfa({ purchasePrice: p.purchasePrice, yearBuilt: p.yearBuilt, buildingSharePercent: p.buildingSharePercent, restnutzungsdauer: p.restnutzungsdauer }), 0);
                  const totalInterest = loans.reduce((s, l) => s + l.remaining_balance * l.interest_rate / 100, 0);
                  const text = await suggestSteuerTipps({
                    propertyCount: properties.length,
                    totalAfA,
                    totalInterest,
                    totalRent: stats.totalRent * 12,
                    taxRate,
                  });
                  if (text) toast.info(text, { duration: 8000 });
                } catch (e) {
                  handleError(e, { context: "ai", details: "steuerTipps", showToast: true });
                } finally {
                  setAiLoading(false);
                }
              }}
              aria-label="KI Steuer-Tipps"
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              KI Steuer-Tipps
            </Button>
          )}
        </div>
      )}

      {/* Tax tips */}
      <div className="space-y-1.5">
        {tips.slice(0, expanded ? undefined : 4).map((tip) => (
          <div key={tip.id} className={`p-2 rounded-lg border text-[10px] ${
            tip.priority === "hoch" ? "bg-profit/5 border-profit/20" :
            tip.priority === "mittel" ? "bg-primary/5 border-primary/20" :
            "bg-background/50 border-border/50"
          }`}>
            <div className="flex justify-between items-start mb-0.5">
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-profit shrink-0" />
                <span className="font-medium">{tip.title}</span>
              </div>
              {tip.potentialSaving > 0 && (
                <span className="text-profit font-bold shrink-0 ml-1">{formatCurrency(tip.potentialSaving)}</span>
              )}
            </div>
            {expanded && (
              <>
                <p className="text-muted-foreground mt-0.5">{tip.description}</p>
                <Badge variant="outline" className="text-[8px] h-4 mt-1">{tip.legalReference}</Badge>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
SteuerOptimierung.displayName = "SteuerOptimierung";

export { SteuerOptimierung };
