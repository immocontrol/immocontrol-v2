import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumberDE, parseNumberDE } from "@/lib/formatters";

interface NumberInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: number | string;
  onChange: (value: number) => void;
  suffix?: string;
}

/**
 * Number input with German thousand separators (1.000, 10.000, etc.)
 * Displays formatted value but stores raw number.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, suffix, ...props }, ref) => {
    const [display, setDisplay] = React.useState(() => {
      const num = typeof value === "string" ? parseFloat(value) : value;
      return !isNaN(num) && num !== undefined ? formatNumberDE(num) : "";
    });

    React.useEffect(() => {
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (!document.activeElement || document.activeElement !== internalRef.current) {
        setDisplay(!isNaN(num) && num !== undefined ? formatNumberDE(num) : "");
      }
    }, [value]);

    const internalRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => internalRef.current!);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow only digits, dots (thousand sep), commas (decimal sep), and minus
      const cleaned = raw.replace(/[^\d.,-]/g, "");
      setDisplay(cleaned);
      const parsed = parseNumberDE(cleaned);
      onChange(parsed);
    };

    const handleBlur = () => {
      const parsed = parseNumberDE(display);
      setDisplay(!isNaN(parsed) ? formatNumberDE(parsed) : "");
      onChange(parsed);
    };

    const handleFocus = () => {
      // On focus, show raw number for easier editing
      const parsed = parseNumberDE(display);
      if (parsed) {
        setDisplay(parsed.toString().replace(".", ","));
      }
    };

    return (
      <div className="relative">
        <input
          ref={internalRef}
          type="text"
          inputMode="decimal"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm tabular-nums",
            suffix && "pr-10",
            className,
          )}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
