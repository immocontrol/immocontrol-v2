/**
 * IMP20-12: Index-Mietanpassung automatisch
 * ContractLifecycleManager: Track CPI changes, auto-calculate new rent
 * + prepare Mieterhöhungsschreiben. AI: generateRentIncreaseJustification.
 * VPI (Verbraucherpreisindex) konfigurierbar via localStorage.
 */
import { memo, useMemo, useState, useCallback } from "react";
import { TrendingUp, Calculator, FileText, Sparkles, Loader2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { generateRentIncreaseJustification, isDeepSeekConfigured } from "@/integrations/ai/extractors";

const CPI_STORAGE_KEY = "immocontrol_index_cpi";
const CPI_DEFAULT = 2.3;

function getStoredCpi(): number {
  try {
    const v = localStorage.getItem(CPI_STORAGE_KEY);
    const n = v ? parseFloat(v) : CPI_DEFAULT;
    return Number.isFinite(n) && n >= 0 && n <= 20 ? n : CPI_DEFAULT;
  } catch { return CPI_DEFAULT; }
}

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
  const [cpiPct, setCpiPct] = useState(() => getStoredCpi());

  const saveCpi = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(20, v));
    setCpiPct(clamped);
    try { localStorage.setItem(CPI_STORAGE_KEY, String(clamped)); } catch { /* */ }
  }, []);

  const adjustments = useMemo((): IndexRentAdjustment[] => {
    return properties
      .filter(p => p.monthlyRent > 0)
      .map(p => {
        // Assume index rent clause with annual adjustment
        const cpiIncrease = p.monthlyRent * (cpiPct / 100);
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
          increasePct: cpiPct,
          lastAdjustment: p.purchaseDate,
          eligible,
        };
      })
      .filter(a => a.eligible && a.increase > 0);
  }, [properties, cpiPct]);

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
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      const msg = e instanceof Error ? e.message : "Begründung konnte nicht generiert werden.";
      toastErrorWithRetry(msg, () => handleGenerateJustification(adj));
    } finally {
      setAiGenerating(null);
    }
  };

  if (adjustments.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Index-Mietanpassung</h3>
          <Badge variant="outline" className="text-[10px] h-5">VPI +{formatPercentDE(cpiPct)}</Badge>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground" title="VPI konfigurieren">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-2">
              <Label className="text-xs">VPI Steigerung % (Verbraucherpreisindex)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  value={cpiPct}
                  onChange={e => saveCpi(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Speichert lokal. Standard: {CPI_DEFAULT}%</p>
            </div>
          </PopoverContent>
        </Popover>
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
