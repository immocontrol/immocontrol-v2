/**
 * MOB3-3: Mobile Swipe-to-Action on Lists
 * Swipe left/right on list rows for quick actions (delete, edit, call).
 * Safari-safe: uses touch events instead of pointer events for iOS compatibility.
 */
import { memo, useRef, useState, useCallback, type ReactNode } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  id: string;
  label: string;
  icon: ReactNode;
  color: string; // tailwind bg class e.g. "bg-destructive"
  textColor?: string;
  onAction: () => void;
}

interface MobileSwipeToActionProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  /** Threshold in px to trigger action reveal (default: 60) */
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

export const MobileSwipeToAction = memo(function MobileSwipeToAction({
  children, leftActions = [], rightActions = [], threshold = 60, className, disabled,
}: MobileSwipeToActionProps) {
  const haptic = useHaptic();
  const [offsetX, setOffsetX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const isHorizontal = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxLeft = leftActions.length * 72;
  const maxRight = rightActions.length * 72;

  const reset = useCallback(() => {
    setIsAnimating(true);
    setOffsetX(0);
    setTimeout(() => setIsAnimating(false), 300);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    isHorizontal.current = null;
    setIsAnimating(false);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || disabled) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;

    // Determine direction on first significant movement
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) return;

    // Prevent vertical scroll while swiping horizontally
    e.preventDefault();

    // Clamp offset
    let clamped = dx;
    if (dx > 0) clamped = Math.min(dx, leftActions.length > 0 ? maxLeft + 20 : 0);
    else clamped = Math.max(dx, rightActions.length > 0 ? -(maxRight + 20) : 0);

    // Rubber band effect past max
    if (Math.abs(clamped) > (clamped > 0 ? maxLeft : maxRight)) {
      const over = Math.abs(clamped) - (clamped > 0 ? maxLeft : maxRight);
      clamped = (clamped > 0 ? maxLeft : -maxRight) + (clamped > 0 ? 1 : -1) * Math.sqrt(over) * 3;
    }

    setOffsetX(clamped);
  }, [disabled, leftActions.length, rightActions.length, maxLeft, maxRight]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current || disabled) return;
    touchStart.current = null;

    if (Math.abs(offsetX) > threshold) {
      // Snap to reveal actions
      haptic.tap();
      setIsAnimating(true);
      setOffsetX(offsetX > 0 ? maxLeft : -maxRight);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      reset();
    }
  }, [offsetX, threshold, haptic, maxLeft, maxRight, reset, disabled]);

  const handleActionClick = useCallback((action: SwipeAction) => {
    haptic.medium();
    action.onAction();
    reset();
  }, [haptic, reset]);

  return (
    <div className={cn("relative overflow-hidden", className)} ref={containerRef} style={{ touchAction: "pan-x pan-y" }}>
      {/* Left actions (revealed on right swipe) */}
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-stretch">
          {leftActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center w-[72px] text-white text-[10px] font-medium gap-1",
                "active:opacity-80 transition-opacity",
                action.color,
              )}
              aria-label={action.label}
            >
              <span className="h-5 w-5 flex items-center justify-center">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Right actions (revealed on left swipe) */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex items-stretch">
          {rightActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center w-[72px] text-white text-[10px] font-medium gap-1",
                "active:opacity-80 transition-opacity",
                action.color,
              )}
              aria-label={action.label}
            >
              <span className="h-5 w-5 flex items-center justify-center">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "relative bg-background",
          isAnimating && "transition-transform duration-300 ease-out",
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
});
