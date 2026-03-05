/**
 * MOB4-8: Mobile Floating Label Inputs
 * Material Design floating labels that save vertical space.
 * Label moves up when input is focused or has value.
 */
import { useState, useCallback, useRef, memo, forwardRef, type InputHTMLAttributes } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileFloatingLabelInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  /** Label text */
  label: string;
  /** Error message */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Prefix icon */
  icon?: React.ReactNode;
  /** Suffix element */
  suffix?: React.ReactNode;
  /** Whether to use floating label on desktop too */
  floatOnDesktop?: boolean;
}

export const MobileFloatingLabelInput = memo(forwardRef<HTMLInputElement, MobileFloatingLabelInputProps>(
  function MobileFloatingLabelInput(
    {
      label,
      error,
      helperText,
      icon,
      suffix,
      floatOnDesktop = false,
      className,
      value,
      defaultValue,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) {
    const isMobile = useIsMobile();
    const useFloating = isMobile || floatOnDesktop;
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasValue = value !== undefined ? Boolean(value) : Boolean(defaultValue);
    const isActive = isFocused || hasValue;

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    }, [onFocus]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    }, [onBlur]);

    const handleLabelClick = useCallback(() => {
      const input = (ref as React.RefObject<HTMLInputElement>)?.current ?? inputRef.current;
      input?.focus();
    }, [ref]);

    if (!useFloating) {
      // Standard layout for desktop
      return (
        <div className={cn("space-y-1.5", className)}>
          <label className="text-sm font-medium text-foreground">{label}</label>
          <div className="relative">
            {icon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {icon}
              </div>
            )}
            <input
              ref={ref ?? inputRef}
              value={value}
              defaultValue={defaultValue}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                icon && "pl-9",
                suffix && "pr-9",
                error && "border-destructive focus-visible:ring-destructive"
              )}
              onFocus={handleFocus}
              onBlur={handleBlur}
              {...props}
            />
            {suffix && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {suffix}
              </div>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {helperText && !error && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
      );
    }

    // Floating label layout for mobile
    return (
      <div className={cn("relative", className)}>
        <div
          className={cn(
            "relative rounded-lg border bg-background transition-colors",
            isFocused && "border-primary ring-1 ring-primary",
            error && "border-destructive",
            !isFocused && !error && "border-input"
          )}
        >
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref ?? inputRef}
            value={value}
            defaultValue={defaultValue}
            className={cn(
              "w-full h-14 bg-transparent px-3 pt-5 pb-1 text-sm outline-none",
              icon && "pl-10",
              suffix && "pr-10"
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder=""
            {...props}
          />

          {/* Floating label */}
          <label
            onClick={handleLabelClick}
            className={cn(
              "absolute left-3 transition-all duration-200 pointer-events-none",
              icon && "left-10",
              isActive
                ? "top-1.5 text-[10px] font-medium"
                : "top-1/2 -translate-y-1/2 text-sm",
              isFocused ? "text-primary" : "text-muted-foreground",
              error && "text-destructive"
            )}
          >
            {label}
          </label>

          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {suffix}
            </div>
          )}
        </div>

        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
));

/** Floating label textarea variant */
export const MobileFloatingLabelTextarea = memo(forwardRef<
  HTMLTextAreaElement,
  {
    label: string;
    error?: string;
    helperText?: string;
    value?: string;
    defaultValue?: string;
    className?: string;
    rows?: number;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  }
>(function MobileFloatingLabelTextarea(
  { label, error, helperText, value, defaultValue, className, rows = 3, onChange, onFocus, onBlur },
  ref
) {
  const isMobile = useIsMobile();
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined ? Boolean(value) : Boolean(defaultValue);
  const isActive = isFocused || hasValue;

  if (!isMobile) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <label className="text-sm font-medium text-foreground">{label}</label>
        <textarea
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          rows={rows}
          onChange={onChange}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "border-destructive"
          )}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {helperText && !error && <p className="text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "relative rounded-lg border bg-background transition-colors",
          isFocused && "border-primary ring-1 ring-primary",
          error && "border-destructive",
          !isFocused && !error && "border-input"
        )}
      >
        <textarea
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          rows={rows}
          onChange={onChange}
          className="w-full bg-transparent px-3 pt-6 pb-2 text-sm outline-none resize-y min-h-[80px]"
          onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
          placeholder=""
        />
        <label
          className={cn(
            "absolute left-3 transition-all duration-200 pointer-events-none",
            isActive
              ? "top-1.5 text-[10px] font-medium"
              : "top-3 text-sm",
            isFocused ? "text-primary" : "text-muted-foreground",
            error && "text-destructive"
          )}
        >
          {label}
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}));
