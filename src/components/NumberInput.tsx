import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | string;
  onChange: (value: number) => void;
  decimals?: boolean;
}

const parseGerman = (str: string): number => {
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const formatInteger = (intStr: string): string => {
  const digits = intStr.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, decimals = false, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLInputElement>) ?? inputRef;

    const [display, setDisplay] = React.useState("");
    const isFocused = React.useRef(false);

    const numToDisplay = React.useCallback((num: number): string => {
      if (num === 0 || isNaN(num)) return "";
      if (decimals) {
        const str = num.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 10 });
        return str;
      }
      return formatInteger(Math.round(num).toString());
    }, [decimals]);

    React.useEffect(() => {
      if (isFocused.current) return;
      const num = typeof value === "string" ? parseFloat(value as string) : (value as number);
      setDisplay(numToDisplay(num));
    }, [value, numToDisplay]);

    const handleFocus = () => {
      isFocused.current = true;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const caretPos = e.target.selectionStart ?? raw.length;

      if (decimals) {
        const cleaned = raw.replace(/[^\d,.]/g, "");
        const commaIdx = cleaned.indexOf(",");
        let intRaw: string;
        let decRaw: string | undefined;
        if (commaIdx >= 0) {
          intRaw = cleaned.slice(0, commaIdx);
          decRaw = cleaned.slice(commaIdx + 1).replace(/,/g, "");
        } else {
          intRaw = cleaned;
          decRaw = undefined;
        }
        const formattedInt = formatInteger(intRaw);
        const newDisplay = decRaw !== undefined ? `${formattedInt},${decRaw}` : formattedInt;
        const dotsBefore = (raw.slice(0, caretPos).match(/\./g) || []).length;
        const dotsAfter = (newDisplay.slice(0, caretPos).match(/\./g) || []).length;
        const newCaret = caretPos + (dotsAfter - dotsBefore);
        setDisplay(newDisplay);
        onChange(parseGerman(newDisplay));
        requestAnimationFrame(() => {
          const el = (combinedRef as React.RefObject<HTMLInputElement>).current;
          if (el) el.setSelectionRange(newCaret, newCaret);
        });
      } else {
        const digits = raw.replace(/\D/g, "");
        const formattedInt = formatInteger(digits);
        const extraDots = (formattedInt.match(/\./g) || []).length - (raw.slice(0, caretPos).match(/\./g) || []).length;
        const newCaret = Math.min(caretPos + extraDots, formattedInt.length);
        setDisplay(formattedInt);
        onChange(parseGerman(formattedInt));
        requestAnimationFrame(() => {
          const el = (combinedRef as React.RefObject<HTMLInputElement>).current;
          if (el) el.setSelectionRange(newCaret, newCaret);
        });
      }
    };

    const handleBlur = () => {
      isFocused.current = false;
      const num = parseGerman(display);
      setDisplay(numToDisplay(num));
      onChange(num);
    };

    return (
      <input
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={combinedRef}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
