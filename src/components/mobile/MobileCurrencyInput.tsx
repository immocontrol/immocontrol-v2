/**
 * MOB6-7: Mobile Currency Input
 * Specialized currency input with auto-formatting (EUR), thousand separators and calculator mode.
 * Touch-optimized with large number pad and quick amount buttons.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Euro, Calculator, Delete, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileCurrencyInputProps {
  /** Current value in cents (integer) */
  value?: number;
  /** Value change handler (value in cents) */
  onChange?: (cents: number) => void;
  /** Label */
  label?: string;
  /** Placeholder */
  placeholder?: string;
  /** Currency symbol */
  currency?: string;
  /** Quick amount presets in EUR */
  quickAmounts?: number[];
  /** Minimum value in cents */
  min?: number;
  /** Maximum value in cents */
  max?: number;
  /** Show built-in calculator */
  showCalculator?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional class */
  className?: string;
}

function formatCents(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

function parseCurrencyString(str: string): number {
  // Handle German format: 1.234,56
  const cleaned = str.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export const MobileCurrencyInput = memo(function MobileCurrencyInput({
  value = 0,
  onChange,
  label,
  placeholder = "0,00",
  currency = "€",
  quickAmounts = [50, 100, 250, 500, 1000],
  min,
  max,
  showCalculator = true,
  disabled = false,
  error,
  className,
}: MobileCurrencyInputProps) {
  const isMobile = useIsMobile();
  const [displayValue, setDisplayValue] = useState(formatCents(value));
  const [isCalcMode, setIsCalcMode] = useState(false);
  const [calcExpression, setCalcExpression] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCents(value));
    }
  }, [value, isFocused]);

  const commitValue = useCallback((cents: number) => {
    let clamped = cents;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    onChange?.(clamped);
    setDisplayValue(formatCents(clamped));
  }, [onChange, min, max]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow typing with German number format
    if (/^[\d.,\s]*$/.test(raw)) {
      setDisplayValue(raw);
    }
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const cents = parseCurrencyString(displayValue);
    commitValue(cents);
  }, [displayValue, commitValue]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Select all on focus
    setTimeout(() => inputRef.current?.select(), 10);
  }, []);

  const handleQuickAmount = useCallback((euros: number) => {
    commitValue(euros * 100);
  }, [commitValue]);

  // Calculator functions
  const handleCalcInput = useCallback((char: string) => {
    setCalcExpression(prev => prev + char);
  }, []);

  const handleCalcClear = useCallback(() => {
    setCalcExpression("");
  }, []);

  const handleCalcDelete = useCallback(() => {
    setCalcExpression(prev => prev.slice(0, -1));
  }, []);

  const handleCalcEval = useCallback(() => {
    try {
      // Safe eval — only allow numbers and operators
      const sanitized = calcExpression.replace(/[^0-9+\-*/.,()]/g, "").replace(",", ".");
      if (!sanitized) return;
      const result = Function(`"use strict"; return (${sanitized})`)() as number;
      if (typeof result === "number" && isFinite(result)) {
        commitValue(Math.round(result * 100));
        setCalcExpression("");
        setIsCalcMode(false);
      }
    } catch {
      // Invalid expression
    }
  }, [calcExpression, commitValue]);

  return (
    <div className={cn("w-full", className)}>
      {/* Label */}
      {label && (
        <label className="block text-xs font-medium mb-1.5">{label}</label>
      )}

      {/* Input field */}
      <div className={cn(
        "relative flex items-center border rounded-xl transition-all",
        isFocused && "ring-2 ring-primary/20 border-primary",
        error && "border-red-400 ring-red-100",
        disabled && "opacity-50 bg-muted"
      )}>
        <span className="pl-3 text-sm font-medium text-muted-foreground">{currency}</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex-1 px-2 py-3 bg-transparent text-right text-lg font-semibold",
            "focus:outline-none",
            isMobile && "min-h-[48px] text-base"
          )}
          aria-label={label || "Betrag"}
        />
        {showCalculator && (
          <button
            onClick={() => setIsCalcMode(prev => !prev)}
            className={cn(
              "p-2 mr-1 rounded-lg hover:bg-muted transition-colors",
              isCalcMode && "bg-primary/10 text-primary"
            )}
            aria-label="Taschenrechner"
            type="button"
          >
            <Calculator className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[10px] text-red-600 mt-1">{error}</p>
      )}

      {/* Quick amounts */}
      {!isCalcMode && quickAmounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {quickAmounts.map(amount => (
            <button
              key={amount}
              onClick={() => handleQuickAmount(amount)}
              disabled={disabled}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs border",
                "hover:bg-muted active:bg-muted/80 transition-colors",
                value === amount * 100 && "bg-primary/10 border-primary text-primary",
                isMobile && "min-h-[36px]"
              )}
              type="button"
            >
              {new Intl.NumberFormat("de-DE").format(amount)} {currency}
            </button>
          ))}
        </div>
      )}

      {/* Calculator mode */}
      {isCalcMode && (
        <div className="mt-2 rounded-xl border bg-background overflow-hidden">
          {/* Expression display */}
          <div className="px-3 py-2 bg-muted/50 border-b">
            <p className="text-sm font-mono text-right min-h-[20px]">
              {calcExpression || "0"}
            </p>
          </div>

          {/* Calculator pad */}
          <div className="grid grid-cols-4 gap-px bg-border">
            {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ",", "C", "+"].map(key => (
              <button
                key={key}
                onClick={() => {
                  if (key === "C") handleCalcClear();
                  else handleCalcInput(key);
                }}
                className={cn(
                  "py-3 text-sm font-medium bg-background",
                  "hover:bg-muted active:bg-muted/80 transition-colors",
                  ["/", "*", "-", "+"].includes(key) && "bg-primary/5 text-primary",
                  key === "C" && "text-red-600",
                  isMobile && "min-h-[48px]"
                )}
                type="button"
              >
                {key}
              </button>
            ))}
            {/* Bottom row */}
            <button
              onClick={handleCalcDelete}
              className={cn(
                "py-3 bg-background hover:bg-muted transition-colors col-span-2",
                isMobile && "min-h-[48px]"
              )}
              type="button"
            >
              <Delete className="w-4 h-4 mx-auto" />
            </button>
            <button
              onClick={handleCalcEval}
              className={cn(
                "py-3 bg-primary text-primary-foreground font-medium text-sm col-span-2",
                "hover:bg-primary/90 transition-colors",
                isMobile && "min-h-[48px]"
              )}
              type="button"
            >
              <Check className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
