/**
 * Objekt-Roadmap + Rendite-Tracking
 * Zeigt Zielrendite vs. Ist-Rendite pro Objekt und Entwicklung über Zeit.
 */
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Target, BarChart2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "immo_zielrendite_";

interface PropertyRenditeTrackingProps {
  propertyId: string;
  propertyName?: string;
  purchasePrice: number;
  monthlyRent: number;
  sqm?: number;
  compact?: boolean;
}

function calcBruttoRendite(purchasePrice: number, monthlyRent: number): number {
  if (purchasePrice <= 0) return 0;
  return (monthlyRent * 12 / purchasePrice) * 100;
}

export function PropertyRenditeTracking({
  propertyId,
  propertyName,
  purchasePrice,
  monthlyRent,
  sqm,
  compact,
}: PropertyRenditeTrackingProps) {
  const [zielRendite, setZielRendite] = useState<number>(4);
  const key = `${STORAGE_KEY}${propertyId}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v != null) setZielRendite(parseFloat(v) || 4);
    } catch { /* noop */ }
  }, [propertyId, key]);

  const saveZiel = useCallback((val: number) => {
    setZielRendite(val);
    try { localStorage.setItem(key, String(val)); } catch { /* noop */ }
  }, [key]);

  const istRendite = calcBruttoRendite(purchasePrice, monthlyRent);
  const diff = istRendite - zielRendite;
  const zielMiete = purchasePrice > 0 ? (zielRendite / 100) * purchasePrice / 12 : 0;
  const mieteDiff = monthlyRent - zielMiete;

  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <BarChart2 className="h-3.5 w-3.5 text-primary" />
            Rendite
          </span>
          <span className={cn(
            "font-medium",
            diff >= 0 ? "text-profit" : "text-loss"
          )}>
            Ist: {istRendite.toFixed(1)}% · Ziel: {zielRendite}%
          </span>
        </div>
        {diff < 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            +{formatCurrency(-mieteDiff)}/M für Ziel nötig
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Target className="h-4 w-4 text-primary" />
        Rendite-Tracking {propertyName && `— ${propertyName}`}
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">Ziel Brutto-Rendite</Label>
          <Input
            type="number"
            min={1}
            max={15}
            step={0.5}
            value={zielRendite}
            onChange={(e) => saveZiel(parseFloat(e.target.value) || 4)}
            className="h-8 w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded-lg bg-secondary/50">
            <p className="text-muted-foreground">Ist-Rendite</p>
            <p className={cn("font-bold text-lg", istRendite >= zielRendite ? "text-profit" : "text-loss")}>
              {istRendite.toFixed(1)}%
            </p>
          </div>
          <div className="p-2 rounded-lg bg-secondary/50">
            <p className="text-muted-foreground">Differenz</p>
            <p className={cn("font-bold text-lg", diff >= 0 ? "text-profit" : "text-loss")}>
              {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
            </p>
          </div>
        </div>
        {diff < 0 && (
          <p className="text-[10px] text-muted-foreground">
            Für {zielRendite}% Brutto-Rendite wären {formatCurrency(zielMiete)}/M nötig
            (aktuell {formatCurrency(monthlyRent)}/M, Differenz +{formatCurrency(-mieteDiff)}/M).
          </p>
        )}
      </div>
    </div>
  );
}
