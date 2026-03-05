import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | string;
  onChange: (value: number) => void;
  decimals?: boolean;
}

/* FIX-1: Use global /,/g to replace ALL commas, not just the first one */
const parseGerman = (str: string): number => {
  const cleaned = str.replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const formatInteger = (intStr: string): string => {
  const digits = intStr.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/* BUG-10: Fix Tausendertrennzeichen — ensure dots are always visible during typing */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, decimals = false, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLInputElement>) ?? inputRef;

    const [display, setDisplay] = React.useState("");
    const isFocused = React.useRef(false);

    const numToDisplay = React.useCallback((num: number): string => {
      if (num === 0 || isNaN(num)) return "";
      if (decimals) {
        const str = parseFloat(num.toPrecision(15)).toString();
        const isNeg = str.startsWith("-");
        const absStr = isNeg ? str.slice(1) : str;
        const parts = absStr.includes(".") ? absStr.split(".") : [absStr, ""];
        const intFormatted = formatInteger(parts[0]);
        return (isNeg ? "-" : "") + (parts[1] ? `${intFormatted},${parts[1]}` : intFormatted);
      }
      return formatInteger(Math.round(num).toString());
    }, [decimals]);

    /* BUG-10: Sync display when value changes externally (not while user is typing) */
    React.useEffect(() => {
      if (isFocused.current) return;
      const num = typeof value === "string" ? parseFloat(String(value)) : (value as number);
      setDisplay(numToDisplay(num));
    }, [value, numToDisplay]);

    const handleFocus = () => {
      isFocused.current = true;
      /* BUG-10: On focus, ensure current display shows formatted number */
      if (!display && value) {
        const num = typeof value === "string" ? parseFloat(String(value)) : (value as number);
        if (num > 0) setDisplay(numToDisplay(num));
      }
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
        /* BUG-10: Calculate caret using digit-counting (same approach as integer branch) */
        const oldDotsBeforeCaret = (raw.slice(0, caretPos).match(/\./g) || []).length;
        const charsBeforeCaret = caretPos - oldDotsBeforeCaret; // digits + commas before caret
        let charsSeen = 0;
        let newCaret = 0;
        for (let i = 0; i < newDisplay.length; i++) {
          if (newDisplay[i] !== ".") {
            charsSeen++;
            if (charsSeen >= charsBeforeCaret) { newCaret = i + 1; break; }
          }
        }
        if (charsBeforeCaret === 0) newCaret = 0;
        if (charsSeen < charsBeforeCaret) newCaret = newDisplay.length;
        setDisplay(newDisplay);
        onChange(parseGerman(newDisplay));
        requestAnimationFrame(() => {
          const el = (combinedRef as React.RefObject<HTMLInputElement>).current;
          if (el) el.setSelectionRange(newCaret, newCaret);
        });
      } else {
        /* BUG-10: Integer mode — strip non-digits, format with dots, fix caret */
        const digits = raw.replace(/\D/g, "");
        const formattedInt = formatInteger(digits);
        /* Count dots before caret in old vs new to calculate offset */
        const oldDotsBeforeCaret = (raw.slice(0, caretPos).match(/\./g) || []).length;
        const digitsBeforeCaret = caretPos - oldDotsBeforeCaret;
        /* Find where that many digits are in the new formatted string */
        let digitsSeen = 0;
        let newCaret = 0;
        for (let i = 0; i < formattedInt.length; i++) {
          if (formattedInt[i] !== ".") {
            digitsSeen++;
            if (digitsSeen >= digitsBeforeCaret) { newCaret = i + 1; break; }
          }
        }
        if (digitsBeforeCaret === 0) newCaret = 0;
        if (digitsSeen < digitsBeforeCaret) newCaret = formattedInt.length;
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

    /* IMPROVE-41: Accessible number input with proper inputMode for mobile keyboards */
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
