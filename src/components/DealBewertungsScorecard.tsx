/**
 * INHALT-16: Deal-Bewertungs-Scorecard — Standardisierte Objektbewertung
 * Für jedes potenzielle Investment: Rendite, Lage, Zustand, Finanzierbarkeit etc.
 * bewerten und vergleichen. Automatische Ampel-Empfehlung.
 */
import { memo, useState, useCallback, useMemo } from "react";
import { ClipboardList, Plus, Star, ChevronDown, ChevronUp, Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { toast } from "sonner";

interface DealCriterion {
  key: string;
  label: string;
  weight: number;
  score: number; // 1-10
}

interface DealEvaluation {
  id: string;
  name: string;
  address: string;
  price: number;
  sqm: number;
  monthlyRent: number;
  criteria: DealCriterion[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  rating: "A" | "B" | "C" | "D";
  createdAt: string;
}

const DEFAULT_CRITERIA: Omit<DealCriterion, "score">[] = [
  { key: "rendite", label: "Brutto-Rendite", weight: 2 },
  { key: "lage", label: "Lage / Mikrolage", weight: 2 },
  { key: "zustand", label: "Gebäudezustand", weight: 1.5 },
  { key: "mieter", label: "Mieterqualität", weight: 1 },
  { key: "finanzierung", label: "Finanzierbarkeit", weight: 1.5 },
  { key: "wertsteigerung", label: "Wertsteigerungspotenzial", weight: 1.5 },
  { key: "cashflow", label: "Cashflow nach Finanzierung", weight: 2 },
  { key: "sanierung", label: "Sanierungsbedarf", weight: 1 },
  { key: "vermietbarkeit", label: "Vermietbarkeit", weight: 1 },
  { key: "steuer", label: "Steuerliche Vorteile", weight: 0.5 },
];

const STORAGE_KEY = "immo_deal_evaluations";

const DealBewertungsScorecard = memo(() => {
  const [expanded, setExpanded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [evaluations, setEvaluations] = useState<DealEvaluation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });

  const [newDeal, setNewDeal] = useState({
    name: "",
    address: "",
    price: 0,
    sqm: 0,
    monthlyRent: 0,
    scores: {} as Record<string, number>,
  });

  const handleScoreChange = useCallback((key: string, value: number) => {
    setNewDeal((prev) => ({
      ...prev,
      scores: { ...prev.scores, [key]: value },
    }));
  }, []);

  const saveDeal = useCallback(() => {
    if (!newDeal.name) {
      toast.error("Bitte Objektname angeben");
      return;
    }

    const criteria: DealCriterion[] = DEFAULT_CRITERIA.map((c) => ({
      ...c,
      score: newDeal.scores[c.key] || 5,
    }));

    const totalScore = criteria.reduce((s, c) => s + c.score * c.weight, 0);
    const maxScore = criteria.reduce((s, c) => s + 10 * c.weight, 0);
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const rating: DealEvaluation["rating"] =
      percentage >= 80 ? "A" : percentage >= 60 ? "B" : percentage >= 40 ? "C" : "D";

    const evaluation: DealEvaluation = {
      id: crypto.randomUUID(),
      name: newDeal.name,
      address: newDeal.address,
      price: newDeal.price,
      sqm: newDeal.sqm,
      monthlyRent: newDeal.monthlyRent,
      criteria,
      totalScore,
      maxScore,
      percentage,
      rating,
      createdAt: new Date().toISOString(),
    };

    const updated = [evaluation, ...evaluations];
    setEvaluations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNewDeal({ name: "", address: "", price: 0, sqm: 0, monthlyRent: 0, scores: {} });
    setShowNew(false);
    toast.success(`Deal "${newDeal.name}" bewertet: Rating ${rating} (${percentage.toFixed(0)}%)`);
  }, [newDeal, evaluations]);

  const deleteDeal = useCallback((id: string) => {
    const updated = evaluations.filter((e) => e.id !== id);
    setEvaluations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Deal gelöscht");
  }, [evaluations]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Deal-Scorecard</h3>
          <Badge variant="outline" className="text-[10px] h-5">{evaluations.length} Deals</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNew(!showNew)} aria-label={showNew ? "Neuen Deal ausblenden" : "Neuen Deal bewerten"}>
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Liste einklappen" : "Alle Bewertungen anzeigen"}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* New deal form */}
      {showNew && (
        <div className="surface-section p-2 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-7 text-[10px]" placeholder="Objektname" value={newDeal.name} onChange={(e) => setNewDeal((p) => ({ ...p, name: e.target.value }))} />
            <Input className="h-7 text-[10px]" placeholder="Adresse" value={newDeal.address} onChange={(e) => setNewDeal((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input className="h-7 text-[10px]" type="number" placeholder="Kaufpreis €" value={newDeal.price || ""} onChange={(e) => setNewDeal((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
            <Input className="h-7 text-[10px]" type="number" placeholder="m²" value={newDeal.sqm || ""} onChange={(e) => setNewDeal((p) => ({ ...p, sqm: parseFloat(e.target.value) || 0 }))} />
            <Input className="h-7 text-[10px]" type="number" placeholder="Kaltmiete/M €" value={newDeal.monthlyRent || ""} onChange={(e) => setNewDeal((p) => ({ ...p, monthlyRent: parseFloat(e.target.value) || 0 }))} />
          </div>

          {/* Scoring */}
          <p className="text-[10px] font-semibold text-muted-foreground">Bewertung (1-10)</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {DEFAULT_CRITERIA.map((c) => (
              <div key={c.key} className="flex items-center gap-2">
                <Label className="text-[10px] w-32 shrink-0">{c.label}</Label>
                <Slider
                  value={[newDeal.scores[c.key] || 5]}
                  onValueChange={([v]) => handleScoreChange(c.key, v)}
                  min={1} max={10} step={1}
                  className="flex-1"
                />
                <span className="text-[10px] font-bold w-6 text-right">{newDeal.scores[c.key] || 5}</span>
              </div>
            ))}
          </div>

          {/* Auto-calculated metrics */}
          {newDeal.price > 0 && newDeal.monthlyRent > 0 && (
            <div className="grid grid-cols-2 gap-2 text-[10px] p-1.5 bg-primary/5 rounded">
              <div>
                <span className="text-muted-foreground">Brutto-Rendite:</span>
                <span className="font-bold ml-1">{formatPercentDE(newDeal.monthlyRent * 12 / newDeal.price * 100)}</span>
              </div>
              {newDeal.sqm > 0 && (
                <div>
                  <span className="text-muted-foreground">€/m²:</span>
                  <span className="font-bold ml-1">{formatCurrency(newDeal.price / newDeal.sqm)}</span>
                </div>
              )}
            </div>
          )}

          <Button size="sm" className="w-full text-[10px] h-7" onClick={saveDeal}>Deal bewerten</Button>
        </div>
      )}

      {/* Evaluated deals */}
      <div className="space-y-1.5">
        {evaluations.slice(0, expanded ? undefined : 3).map((deal) => (
          <div key={deal.id} className={`p-2 rounded-lg border text-[10px] ${
            deal.rating === "A" ? "bg-profit/5 border-profit/20" :
            deal.rating === "B" ? "bg-primary/5 border-primary/20" :
            deal.rating === "C" ? "bg-gold/5 border-gold/20" :
            "bg-loss/5 border-loss/20"
          }`}>
            <div className="flex justify-between items-start gap-2 min-w-0">
              <div className="min-w-0 text-wrap-safe break-words">
                <span className="font-medium" title={deal.name}>{deal.name}</span>
                {deal.address && <span className="text-muted-foreground ml-1" title={deal.address}>{deal.address}</span>}
              </div>
              <div className="flex items-center gap-1">
                <Badge className={`text-[10px] h-5 ${
                  deal.rating === "A" ? "bg-profit text-white" :
                  deal.rating === "B" ? "bg-primary text-white" :
                  deal.rating === "C" ? "bg-gold text-white" :
                  "bg-loss text-white"
                }`}>
                  {deal.rating} ({deal.percentage.toFixed(0)}%)
                </Badge>
                {expanded && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Deal löschen" onClick={() => deleteDeal(deal.id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {deal.price > 0 && <div><span className="text-muted-foreground">Preis</span><p className="font-medium">{formatCurrency(deal.price)}</p></div>}
              {deal.monthlyRent > 0 && <div><span className="text-muted-foreground">Kaltmiete/M</span><p className="font-medium">{formatCurrency(deal.monthlyRent)}</p></div>}
              {deal.price > 0 && deal.monthlyRent > 0 && (
                <div><span className="text-muted-foreground">Rendite</span><p className="font-medium">{formatPercentDE(deal.monthlyRent * 12 / deal.price * 100)}</p></div>
              )}
            </div>
            {/* Score bar */}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
              <div className={`h-full rounded-full transition-all ${
                deal.rating === "A" ? "bg-profit" : deal.rating === "B" ? "bg-primary" : deal.rating === "C" ? "bg-gold" : "bg-loss"
              }`} style={{ width: `${deal.percentage}%` }} />
            </div>
          </div>
        ))}
        {evaluations.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4 px-2">
            Noch keine Deals bewertet. Klicke auf <strong>+</strong>, um einen Deal mit Kriterien (Rendite, Lage, Zustand …) zu bewerten und ein A–D-Rating zu erhalten.
          </p>
        )}
      </div>
    </div>
  );
});
DealBewertungsScorecard.displayName = "DealBewertungsScorecard";

export { DealBewertungsScorecard };
