/**
 * MOB-8: Numerische Tastatur-Optimierung
 * All money/number inputs get inputMode="decimal" instead of type="number".
 * Custom quick-value buttons for common amounts (+100, +1000, +10000).
 */
import { memo, useState, useCallback, useRef } from "react";
import { Plus, Minus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MobileNumericInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  /** Currency symbol (default: "€") */
  currency?: string;
  /** Quick increment buttons */
  increments?: number[];
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Decimal places (default: 2 for currency) */
  decimals?: number;
  className?: string;
  id?: string;
}

export const MobileNumericInput = memo(function MobileNumericInput({
  value, onChange, label, placeholder, currency = "€",
  increments = [100, 1000, 10000], min, max,
  decimals = 2, className, id,
}: MobileNumericInputProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const clamp = useCallback((v: number): number => {
    let result = v;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  }, [min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    /* FIX-1: Use global /,/g to replace ALL commas */
    const raw = e.target.value.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    } else if (raw === "" || raw === "-") {
      onChange(0);
    }
  }, [onChange, clamp]);

  const handleIncrement = useCallback((amount: number) => {
    haptic.tap();
    onChange(clamp(value + amount));
  }, [haptic, onChange, value, clamp]);

  const handleDecrement = useCallback((amount: number) => {
    haptic.tap();
    onChange(clamp(value - amount));
  }, [haptic, onChange, value, clamp]);

  const displayValue = isFocused && value === 0
    ? ""
    : value.toLocaleString("de-DE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      });

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Main input with currency prefix */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
          {currency}
        </span>
        <Input
          ref={inputRef}
          id={id}
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          value={displayValue}
          onChange={handleChange}
          onFocus={(e) => {
            setIsFocused(true);
            requestAnimationFrame(() => e.target.select());
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || "0,00"}
          className={cn(
            "pl-8 text-right text-base font-semibold",
            isMobile && "h-12 text-lg",
          )}
          aria-label={label}
        />
      </div>

      {/* Quick increment/decrement buttons — mobile only */}
      {isMobile && increments.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {increments.map((inc) => (
            <div key={inc} className="flex rounded-lg overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => handleDecrement(inc)}
                className="flex items-center gap-0.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary active:scale-95 transition-all"
                aria-label={`${inc} abziehen`}
              >
                <Minus className="h-3 w-3" />
                {inc >= 1000 ? `${inc / 1000}k` : inc}
              </button>
              <div className="w-px bg-border" />
              <button
                type="button"
                onClick={() => handleIncrement(inc)}
                className="flex items-center gap-0.5 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 active:scale-95 transition-all"
                aria-label={`${inc} hinzufügen`}
              >
                <Plus className="h-3 w-3" />
                {inc >= 1000 ? `${inc / 1000}k` : inc}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
