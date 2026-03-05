/**
 * MOB2-5: Smart Number Pad für Finanzfelder
 * Dedicated number pad for financial inputs with quick-value buttons.
 * Buttons for +100, +1k, +10k, +100k and common rental amounts.
 */
import { memo, useState, useCallback } from "react";
import { Euro, Delete, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

type NumberPadMode = "price" | "rent" | "generic";

interface MobileSmartNumberPadProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  /** Initial value */
  initialValue?: number;
  /** Label shown above the display */
  label?: string;
  /** Mode determines which quick-value buttons to show */
  mode?: NumberPadMode;
  /** Min/max constraints */
  min?: number;
  max?: number;
}

const QUICK_VALUES: Record<NumberPadMode, { label: string; value: number }[]> = {
  price: [
    { label: "+10k", value: 10000 },
    { label: "+50k", value: 50000 },
    { label: "+100k", value: 100000 },
    { label: "+500k", value: 500000 },
  ],
  rent: [
    { label: "+50", value: 50 },
    { label: "+100", value: 100 },
    { label: "+250", value: 250 },
    { label: "+500", value: 500 },
  ],
  generic: [
    { label: "+100", value: 100 },
    { label: "+1k", value: 1000 },
    { label: "+10k", value: 10000 },
    { label: "+100k", value: 100000 },
  ],
};

const PRESET_VALUES: Record<NumberPadMode, { label: string; value: number }[]> = {
  price: [
    { label: "100k", value: 100000 },
    { label: "200k", value: 200000 },
    { label: "350k", value: 350000 },
    { label: "500k", value: 500000 },
  ],
  rent: [
    { label: "500€", value: 500 },
    { label: "750€", value: 750 },
    { label: "1.000€", value: 1000 },
    { label: "1.500€", value: 1500 },
  ],
  generic: [],
};

export const MobileSmartNumberPad = memo(function MobileSmartNumberPad({
  open, onClose, onConfirm, initialValue = 0, label = "Betrag", mode = "generic", min = 0, max = 99999999,
}: MobileSmartNumberPadProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [display, setDisplay] = useState(initialValue > 0 ? String(initialValue) : "");

  const numericValue = parseFloat(display) || 0;

  const appendDigit = useCallback((digit: string) => {
    haptic.tap();
    setDisplay(prev => {
      if (digit === "." && prev.includes(".")) return prev;
      if (prev === "0" && digit !== ".") return digit;
      const next = prev + digit;
      const val = parseFloat(next);
      if (!isNaN(val) && val <= max) return next;
      return prev;
    });
  }, [haptic, max]);

  const deleteLast = useCallback(() => {
    haptic.tap();
    setDisplay(prev => prev.slice(0, -1));
  }, [haptic]);

  const clear = useCallback(() => {
    haptic.medium();
    setDisplay("");
  }, [haptic]);

  const addQuickValue = useCallback((amount: number) => {
    haptic.tap();
    setDisplay(prev => {
      const current = parseFloat(prev) || 0;
      const next = Math.min(current + amount, max);
      return String(next);
    });
  }, [haptic, max]);

  const setPreset = useCallback((value: number) => {
    haptic.tap();
    setDisplay(String(value));
  }, [haptic]);

  const handleConfirm = useCallback(() => {
    const val = Math.max(min, Math.min(max, numericValue));
    haptic.success();
    onConfirm(val);
    onClose();
  }, [numericValue, min, max, haptic, onConfirm, onClose]);

  if (!open || !isMobile) return null;

  const quickValues = QUICK_VALUES[mode];
  const presets = PRESET_VALUES[mode];

  return (
    <div className="fixed inset-0 z-[300] bg-background flex flex-col animate-fade-in">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="text-sm text-muted-foreground">Abbrechen</button>
        <span className="text-sm font-semibold">{label}</span>
        <button onClick={handleConfirm} className="text-sm font-semibold text-primary">Fertig</button>
      </div>

      {/* Display */}
      <div className="shrink-0 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <Euro className="h-6 w-6 text-muted-foreground" />
          <span className="text-4xl font-bold tabular-nums">
            {display || "0"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{formatCurrency(numericValue)}</p>
      </div>

      {/* Quick add buttons */}
      {quickValues.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 px-4 pb-3 overflow-x-auto">
          {quickValues.map(qv => (
            <button
              key={qv.label}
              onClick={() => addQuickValue(qv.value)}
              className="shrink-0 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium active:scale-95 transition-transform"
            >
              {qv.label}
            </button>
          ))}
        </div>
      )}

      {/* Preset values */}
      {presets.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 px-4 pb-3 overflow-x-auto">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => setPreset(p.value)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all",
                numericValue === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Number pad grid */}
      <div className="flex-1" />
      <div className="shrink-0 grid grid-cols-3 gap-px bg-border mx-4 mb-4 rounded-2xl overflow-hidden">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map(key => (
          <button
            key={key}
            onClick={() => {
              if (key === "del") deleteLast();
              else appendDigit(key);
            }}
            onDoubleClick={() => { if (key === "del") clear(); }}
            className="bg-background h-14 flex items-center justify-center text-lg font-medium active:bg-secondary transition-colors"
            aria-label={key === "del" ? "Löschen" : key}
          >
            {key === "del" ? <Delete className="h-5 w-5" /> : key}
          </button>
        ))}
      </div>

      {/* Confirm button */}
      <div className="shrink-0 px-4 pb-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Check className="h-5 w-5" /> {formatCurrency(numericValue)} bestätigen
        </button>
      </div>
    </div>
  );
});
