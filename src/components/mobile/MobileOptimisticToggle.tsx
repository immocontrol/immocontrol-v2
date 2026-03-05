/**
 * MOB3-14: Mobile Optimistic Toggles
 * Instant UI feedback when toggling Todo status, Lead status, Rent status.
 * Auto-rollback on server error. No waiting for server response.
 * Safari-safe: uses CSS transitions for smooth state changes.
 */
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MobileOptimisticToggleProps {
  /** Current state */
  checked: boolean;
  /** Server-side update function (must throw on error) */
  onToggle: (newValue: boolean) => Promise<void>;
  /** Label text */
  label?: string;
  /** Visual variant */
  variant?: "checkbox" | "switch" | "status";
  /** Status labels for status variant */
  statusLabels?: { on: string; off: string };
  /** Status colors for status variant */
  statusColors?: { on: string; off: string };
  /** Error message on rollback */
  errorMessage?: string;
  disabled?: boolean;
  className?: string;
}

export const MobileOptimisticToggle = memo(function MobileOptimisticToggle({
  checked, onToggle, label, variant = "checkbox",
  statusLabels = { on: "Erledigt", off: "Offen" },
  statusColors = { on: "bg-emerald-500/15 text-emerald-600", off: "bg-secondary text-muted-foreground" },
  errorMessage = "Änderung fehlgeschlagen",
  disabled, className,
}: MobileOptimisticToggleProps) {
  const haptic = useHaptic();
  const [optimistic, setOptimistic] = useState(checked);
  const [syncing, setSyncing] = useState(false);
  const mountedRef = useRef(true);

  // Sync with prop changes
  useEffect(() => { setOptimistic(checked); }, [checked]);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const handleToggle = useCallback(async () => {
    if (disabled || syncing) return;
    const newValue = !optimistic;

    // Optimistic update — immediate UI change
    haptic.tap();
    setOptimistic(newValue);
    setSyncing(true);

    try {
      await onToggle(newValue);
      if (mountedRef.current) {
        haptic.success();
      }
    } catch {
      // Rollback
      if (mountedRef.current) {
        setOptimistic(!newValue);
        haptic.error();
        toast.error(errorMessage);
      }
    } finally {
      if (mountedRef.current) setSyncing(false);
    }
  }, [disabled, syncing, optimistic, haptic, onToggle, errorMessage]);

  if (variant === "switch") {
    return (
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={cn("flex items-center gap-2", disabled && "opacity-50", className)}
        role="switch"
        aria-checked={optimistic}
        aria-label={label}
      >
        <div className={cn(
          "relative w-10 h-6 rounded-full transition-colors duration-200",
          optimistic ? "bg-primary" : "bg-secondary",
        )}>
          <div className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            optimistic ? "translate-x-[18px]" : "translate-x-0.5",
            /* Safari: GPU compositing */
            "transform-gpu",
          )}>
            {syncing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground absolute top-1 left-1" />}
          </div>
        </div>
        {label && <span className="text-sm">{label}</span>}
      </button>
    );
  }

  if (variant === "status") {
    return (
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95",
          optimistic ? statusColors.on : statusColors.off,
          disabled && "opacity-50",
          className,
        )}
        aria-label={`${label || "Status"}: ${optimistic ? statusLabels.on : statusLabels.off}`}
      >
        {syncing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : optimistic ? (
          <Check className="h-3 w-3" />
        ) : null}
        {optimistic ? statusLabels.on : statusLabels.off}
      </button>
    );
  }

  // Checkbox variant (default)
  return (
    <button
      onClick={handleToggle}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 group",
        disabled && "opacity-50",
        className,
      )}
      role="checkbox"
      aria-checked={optimistic}
      aria-label={label}
    >
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
        optimistic
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/40 group-hover:border-primary/60",
      )}>
        {syncing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : optimistic ? (
          <Check className="h-3 w-3" />
        ) : null}
      </div>
      {label && (
        <span className={cn(
          "text-sm transition-all",
          optimistic && "line-through text-muted-foreground",
        )}>
          {label}
        </span>
      )}
    </button>
  );
});
