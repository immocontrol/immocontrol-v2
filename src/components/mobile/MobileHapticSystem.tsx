/**
 * MOB3-15: Mobile Haptic Feedback System
 * Unified haptic patterns for all CRUD operations.
 * Wraps useHaptic with higher-level semantic actions.
 * Safari-safe: Vibration API not available on iOS Safari — graceful fallback.
 */
import { memo, useCallback, type ReactNode } from "react";
import { useHaptic } from "@/hooks/useHaptic";

/** Semantic haptic actions for CRUD operations */
export interface HapticActions {
  /** Item selected / toggled */
  onSelect: () => void;
  /** Item saved / created */
  onSave: () => void;
  /** Operation succeeded */
  onSuccess: () => void;
  /** Operation failed */
  onError: () => void;
  /** Item deleted */
  onDelete: () => void;
  /** Navigation / tab switch */
  onNavigate: () => void;
  /** Drag started */
  onDragStart: () => void;
  /** Drag dropped */
  onDrop: () => void;
}

/** Hook that provides semantic haptic actions */
export function useHapticActions(): HapticActions {
  const haptic = useHaptic();

  return {
    onSelect: useCallback(() => haptic.tap(), [haptic]),
    onSave: useCallback(() => haptic.medium(), [haptic]),
    onSuccess: useCallback(() => haptic.success(), [haptic]),
    onError: useCallback(() => haptic.error(), [haptic]),
    onDelete: useCallback(() => haptic.medium(), [haptic]),
    onNavigate: useCallback(() => haptic.tap(), [haptic]),
    onDragStart: useCallback(() => haptic.medium(), [haptic]),
    onDrop: useCallback(() => haptic.success(), [haptic]),
  };
}

/** Higher-order component that adds haptic feedback to any clickable element */
interface WithHapticProps {
  /** Haptic pattern to use */
  pattern: "tap" | "medium" | "success" | "error";
  /** Original onClick handler */
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export const WithHaptic = memo(function WithHaptic({
  pattern, onClick, children, className, disabled, ariaLabel,
}: WithHapticProps) {
  const haptic = useHaptic();

  const handleClick = useCallback(() => {
    if (disabled) return;
    haptic[pattern]();
    onClick?.();
  }, [disabled, haptic, pattern, onClick]);

  return (
    <div
      onClick={handleClick}
      className={className}
      role={onClick ? "button" : undefined}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {children}
    </div>
  );
});
