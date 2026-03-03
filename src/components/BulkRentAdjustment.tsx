/**
 * #11: Bulk-Aktionen für Mietanpassungen — Mehrere Mieter gleichzeitig anpassen
 */
import { useState, useMemo, useCallback } from "react";
import { Users, Percent, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, safeDivide } from "@/lib/formatters";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Tenant {
  id: string;
  name: string;
  property_id: string;
  monthly_rent: number;
  is_active: boolean;
}

export function BulkRentAdjustment() {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [adjustmentType, setAdjustmentType] = useState<"percent" | "fixed">("percent");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["all_tenants_bulk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, property_id, monthly_rent, is_active")
        .eq("is_active", true);
      return (data || []) as Tenant[];
    },
    enabled: !!user,
  });

  const propMap = useMemo(
    () => Object.fromEntries(properties.map(p => [p.id, p.name])),
    [properties]
  );

  const value = parseFloat(adjustmentValue) || 0;

  const preview = useMemo(() => {
    return tenants
      .filter(t => selectedIds.has(t.id))
      .map(t => {
        const currentRent = t.monthly_rent;
        const newRent = adjustmentType === "percent"
          ? currentRent * (1 + value / 100)
          : currentRent + value;
        const diff = newRent - currentRent;
        return {
          ...t,
          propertyName: propMap[t.property_id] || "Unbekannt",
          currentRent,
          newRent: Math.round(newRent * 100) / 100,
          diff: Math.round(diff * 100) / 100,
          diffPercent: safeDivide(diff, currentRent, 0) * 100,
        };
      });
  }, [tenants, selectedIds, adjustmentType, value, propMap]);

  const totalDiff = preview.reduce((s, p) => s + p.diff, 0);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === tenants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tenants.map(t => t.id)));
    }
  }, [tenants, selectedIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const applyAdjustments = useCallback(async () => {
    if (preview.length === 0 || value === 0) return;
    setIsApplying(true);
    try {
      for (const item of preview) {
        await supabase
          .from("tenants")
          .update({ monthly_rent: item.newRent } as never)
          .eq("id", item.id);
      }
      toast.success(`${preview.length} Mieten angepasst`);
      setSelectedIds(new Set());
      setShowPreview(false);
      setAdjustmentValue("");
    } catch {
      toast.error("Fehler bei der Mietanpassung");
    } finally {
      setIsApplying(false);
    }
  }, [preview, value]);

  if (tenants.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Mietanpassung (Bulk)
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {tenants.length} Mieter
        </span>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-3">
        <select
          value={adjustmentType}
          onChange={e => setAdjustmentType(e.target.value as "percent" | "fixed")}
          className="text-xs bg-secondary border border-border rounded px-2 py-1.5"
        >
          <option value="percent">Prozentual (%)</option>
          <option value="fixed">Festbetrag (EUR)</option>
        </select>
        <input
          type="number"
          value={adjustmentValue}
          onChange={e => setAdjustmentValue(e.target.value)}
          placeholder={adjustmentType === "percent" ? "z.B. 3.5" : "z.B. 25"}
          className="text-xs bg-background border border-border rounded px-2 py-1.5 w-24 focus:outline-none focus:ring-1 focus:ring-primary"
          step="0.1"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={toggleAll}
          className="text-xs h-8"
        >
          {selectedIds.size === tenants.length ? "Keine" : "Alle"}
        </Button>
      </div>

      {/* Tenant list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {tenants.map(t => (
          <label
            key={t.id}
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
              selectedIds.has(t.id) ? "bg-primary/5 border border-primary/20" : "hover:bg-secondary/50"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(t.id)}
              onChange={() => toggleOne(t.id)}
              className="rounded border-border"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{t.name}</p>
              <p className="text-[10px] text-muted-foreground">{propMap[t.property_id] || ""}</p>
            </div>
            <span className="text-xs font-medium tabular-nums shrink-0">
              {formatCurrency(t.monthly_rent)}
            </span>
          </label>
        ))}
      </div>

      {/* Preview */}
      {selectedIds.size > 0 && value !== 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium flex items-center gap-1">
              <Percent className="h-3 w-3 text-primary" />
              Vorschau: {selectedIds.size} Mieter
            </p>
            <span className={`text-xs font-bold ${totalDiff >= 0 ? "text-profit" : "text-loss"}`}>
              {totalDiff >= 0 ? "+" : ""}{formatCurrency(totalDiff)}/M
            </span>
          </div>

          {showPreview && (
            <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
              {preview.map(p => (
                <div key={p.id} className="flex items-center justify-between text-[10px] p-1.5 rounded bg-secondary/30">
                  <span className="truncate">{p.name}</span>
                  <span className="flex items-center gap-1 shrink-0 tabular-nums">
                    {formatCurrency(p.currentRent)}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-bold">{formatCurrency(p.newRent)}</span>
                    <span className={p.diff >= 0 ? "text-profit" : "text-loss"}>
                      ({p.diff >= 0 ? "+" : ""}{p.diffPercent.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs h-7 flex-1"
            >
              {showPreview ? "Ausblenden" : "Details anzeigen"}
            </Button>
            <Button
              size="sm"
              onClick={applyAdjustments}
              disabled={isApplying}
              className="text-xs h-7 flex-1"
            >
              {isApplying ? "Wird angepasst..." : (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Anwenden
                </>
              )}
            </Button>
          </div>

          {value > 20 && adjustmentType === "percent" && (
            <p className="text-[10px] text-gold flex items-center gap-1 mt-2">
              <AlertTriangle className="h-3 w-3" />
              Achtung: Mieterhöhungen über 20% können rechtlich problematisch sein (Kappungsgrenze).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BulkRentAdjustment;
