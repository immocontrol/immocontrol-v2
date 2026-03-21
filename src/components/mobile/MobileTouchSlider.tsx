/**
 * MOB-12: Touch-optimierte Slider & Controls
 * All sliders with enlarged touch target (min 44px), haptic feedback
 * on value change, and value label directly at the thumb.
 */
import { memo, useState, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface MobileTouchSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  /** Format function for the value display */
  formatValue?: (value: number) => string;
  /** Show markers at specific intervals */
  markers?: number[];
  /** Color theme */
  color?: "primary" | "profit" | "loss" | "gold";
  className?: string;
  id?: string;
}

export const MobileTouchSlider = memo(function MobileTouchSlider({
  value, onChange, min, max, step = 1,
  label, formatValue, markers, color = "primary",
  className, id,
}: MobileTouchSliderProps) {
  const haptic = useHaptic();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastHapticValue = useRef(value);

  const range = max - min;
  const percentage = range > 0 ? ((value - min) / range) * 100 : 0;

  const displayValue = formatValue ? formatValue(value) : String(value);

  const colorClasses = {
    primary: "bg-primary",
    profit: "bg-profit",
    loss: "bg-loss",
    gold: "bg-gold",
  };

  const thumbColorClasses = {
    primary: "border-primary bg-primary shadow-primary/30",
    profit: "border-profit bg-profit shadow-profit/30",
    loss: "border-loss bg-loss shadow-loss/30",
    gold: "border-gold bg-gold shadow-gold/30",
  };

  const getValueFromPosition = useCallback((clientX: number): number => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    const raw = min + pct * range;
    // Snap to step
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, stepped));
  }, [value, min, max, range, step]);

  const updateValue = useCallback((newValue: number) => {
    // Haptic feedback at significant changes
    if (Math.abs(newValue - lastHapticValue.current) >= step * 5) {
      haptic.tap();
      lastHapticValue.current = newValue;
    }
    onChange(newValue);
  }, [haptic, onChange, step]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    const newValue = getValueFromPosition(e.touches[0].clientX);
    updateValue(newValue);
  }, [getValueFromPosition, updateValue]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const newValue = getValueFromPosition(e.touches[0].clientX);
    updateValue(newValue);
  }, [isDragging, getValueFromPosition, updateValue]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    haptic.tap();
  }, [haptic]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    const newValue = getValueFromPosition(e.clientX);
    updateValue(newValue);

    const handleMouseMove = (ev: MouseEvent) => {
      const val = getValueFromPosition(ev.clientX);
      updateValue(val);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [getValueFromPosition, updateValue]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium">{label}</label>
          <span className="text-sm font-bold text-foreground">{displayValue}</span>
        </div>
      )}

      {/* Slider track */}
      <div
        ref={trackRef}
        className="relative py-4 cursor-pointer touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        tabIndex={0}
        id={id}
      >
        {/* Track background */}
        <div className="h-2 bg-secondary rounded-full relative">
          {/* Filled portion */}
          <div
            className={cn("h-full rounded-full transition-all", colorClasses[color])}
            style={{ width: `${percentage}%` }}
          />

          {/* Markers */}
          {markers && markers.map((marker) => {
            const markerPct = range > 0 ? ((marker - min) / range) * 100 : 0;
            return (
              <div
                key={marker}
                className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-border rounded-full"
                style={{ left: `${markerPct}%` }}
              />
            );
          })}
        </div>

        {/* Thumb with value label */}
        <div
          className={cn(
            "absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-xl transition-transform duration-base ease-out-modern",
            thumbColorClasses[color],
            isDragging && "scale-125 shadow-xl",
          )}
          style={{ left: `${percentage}%` }}
        >
          {/* Value tooltip on drag */}
          {isDragging && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
              {displayValue}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
            </div>
          )}
        </div>
      </div>

      {/* Min/Max labels */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
});
