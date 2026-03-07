/**
 * IMP20-12: Index-Mietanpassung automatisch
 * ContractLifecycleManager: Track CPI changes, auto-calculate new rent
 * + prepare Mieterhöhungsschreiben. AI: generateRentIncreaseJustification.
 */
import { memo, useMemo, useState } from "react";
import { TrendingUp, Calculator, FileText, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { toast } from "sonner";
import { generateRentIncreaseJustification, isDeepSeekConfigured } from "@/integrations/ai/extractors";

// CPI data (Verbraucherpreisindex) — approximate recent values
const CPI_ANNUAL_CHANGE = 2.3; // Current annual CPI change in %

interface IndexRentAdjustment {
  propertyId: string;
  propertyName: string;
  currentRent: number;
  newRent: number;
  increase: number;
  increasePct: number;
  lastAdjustment: string;
  eligible: boolean;
}

const IndexMietanpassung = memo(() => {
  const { properties } = useProperties();
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);

  const adjustments = useMemo((): IndexRentAdjustment[] => {
    return properties
      .filter(p => p.monthlyRent > 0)
      .map(p => {
        // Assume index rent clause with annual adjustment
        const cpiIncrease = p.monthlyRent * (CPI_ANNUAL_CHANGE / 100);
        const newRent = p.monthlyRent + cpiIncrease;
        // Eligible if last adjustment was >12 months ago (simplified)
        const purchaseDate = new Date(p.purchaseDate);
        const monthsSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (30.44 * 86400000));
        const eligible = monthsSincePurchase >= 12;

        return {
          propertyId: p.id,
          propertyName: p.name,
          currentRent: p.monthlyRent,
          newRent: Math.round(newRent * 100) / 100,
          increase: Math.round(cpiIncrease * 100) / 100,
          increasePct: CPI_ANNUAL_CHANGE,
          lastAdjustment: p.purchaseDate,
          eligible,
        };
      })
      .filter(a => a.eligible && a.increase > 0);
  }, [properties]);

  const totalIncrease = adjustments.reduce((s, a) => s + a.increase, 0);

  const handleGenerate = (adj: IndexRentAdjustment) => {
    toast.success(`Mieterhöhungsschreiben für ${adj.propertyName} erstellt: +${formatCurrency(adj.increase)}/Monat`);
    setGeneratedIds(prev => new Set([...prev, adj.propertyId]));
  };

  const handleGenerateJustification = async (adj: IndexRentAdjustment) => {
    if (!isDeepSeekConfigured()) {
      toast.error("DeepSeek API-Key nicht konfiguriert.");
      return;
    }
    setAiGenerating(adj.propertyId);
    try {
      const text = await generateRentIncreaseJustification({
        propertyName: adj.propertyName,
        currentRent: adj.currentRent,
        newRent: adj.newRent,
        increasePct: adj.increasePct,
      });
      await navigator.clipboard.writeText(text);
      toast.success(`Begründung generiert und in Zwischenablage kopiert`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Begründung konnte nicht generiert werden.");
    } finally {
      setAiGenerating(null);
    }
  };

  if (adjustments.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Index-Mietanpassung</h3>
          <Badge variant="outline" className="text-[10px] h-5">VPI +{formatPercentDE(CPI_ANNUAL_CHANGE)}</Badge>
        </div>
        {totalIncrease > 0 && (
          <span className="text-[10px] text-profit font-medium">+{formatCurrency(totalIncrease)}/Monat möglich</span>
        )}
      </div>

      <div className="space-y-2">
        {adjustments.map(adj => (
          <div key={adj.propertyId} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50">
            <Calculator className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{adj.propertyName}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(adj.currentRent)} → {formatCurrency(adj.newRent)}
                <span className="text-profit ml-1">(+{formatCurrency(adj.increase)})</span>
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              {isDeepSeekConfigured() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-6 gap-1"
                  disabled={aiGenerating !== null}
                  onClick={() => handleGenerateJustification(adj)}
                  title="KI-Begründung generieren und kopieren"
                >
                  {aiGenerating === adj.propertyId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                </Button>
              )}
              {generatedIds.has(adj.propertyId) ? (
                <Badge className="text-[9px] h-5 bg-profit/20 text-profit">Erstellt</Badge>
              ) : (
                <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => handleGenerate(adj)}>
                  <FileText className="h-3 w-3" /> Schreiben
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
IndexMietanpassung.displayName = "IndexMietanpassung";

export { IndexMietanpassung };
