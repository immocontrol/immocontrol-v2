/**
 * MOB5-15: Mobile Confirm Swipe
 * Swipe-to-confirm for dangerous actions (delete, cancel contract, etc.).
 * Replaces confirmation dialogs with a more intentional physical gesture.
 */
import { useState, useRef, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight, AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileConfirmSwipeProps {
  /** Label for the action */
  label: string;
  /** Description of what will happen */
  description?: string;
  /** Callback when swipe is completed */
  onConfirm: () => void | Promise<void>;
  /** Variant for visual styling */
  variant?: "destructive" | "warning" | "default";
  /** Disabled state */
  disabled?: boolean;
  /** Additional class */
  className?: string;
}

export const MobileConfirmSwipe = memo(function MobileConfirmSwipe({
  label,
  description,
  onConfirm,
  variant = "destructive",
  disabled = false,
  className,
}: MobileConfirmSwipeProps) {
  const isMobile = useIsMobile();
  const [dragX, setDragX] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const trackWidthRef = useRef(0);
  const dragXRef = useRef(0);

  const THUMB_SIZE = 48;
  const CONFIRM_THRESHOLD = 0.85; // 85% of track width

  const variantStyles = {
    destructive: {
      track: "bg-red-100 dark:bg-red-950/30",
      fill: "bg-red-500",
      thumb: "bg-red-600 text-white",
      text: "text-red-700 dark:text-red-300",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    warning: {
      track: "bg-orange-100 dark:bg-orange-950/30",
      fill: "bg-orange-500",
      thumb: "bg-orange-600 text-white",
      text: "text-orange-700 dark:text-orange-300",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    default: {
      track: "bg-primary/10",
      fill: "bg-primary",
      thumb: "bg-primary text-primary-foreground",
      text: "text-primary",
      icon: <ChevronRight className="w-4 h-4" />,
    },
  };

  const styles = variantStyles[variant];

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isConfirming || isConfirmed) return;
    startXRef.current = e.touches[0].clientX;
    if (trackRef.current) {
      trackWidthRef.current = trackRef.current.offsetWidth - THUMB_SIZE;
    }
  }, [disabled, isConfirming, isConfirmed]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || isConfirming || isConfirmed) return;
    const delta = e.touches[0].clientX - startXRef.current;
    const clamped = Math.max(0, Math.min(delta, trackWidthRef.current));
    dragXRef.current = clamped;
    setDragX(clamped);
  }, [disabled, isConfirming, isConfirmed]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isConfirming || isConfirmed) return;

    const progress = dragXRef.current / trackWidthRef.current;

    if (progress >= CONFIRM_THRESHOLD) {
      // Confirmed!
      setDragX(trackWidthRef.current);
      setIsConfirming(true);

      try {
        await onConfirm();
        setIsConfirmed(true);
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(50);
      } catch {
        // Reset on error
        setDragX(0);
      } finally {
        setIsConfirming(false);
      }
    } else {
      // Spring back
      setDragX(0);
    }
  }, [disabled, isConfirming, isConfirmed, onConfirm]);

  // Mouse events for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || isConfirming || isConfirmed) return;
    startXRef.current = e.clientX;
    if (trackRef.current) {
      trackWidthRef.current = trackRef.current.offsetWidth - THUMB_SIZE;
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startXRef.current;
      const clamped = Math.max(0, Math.min(delta, trackWidthRef.current));
      dragXRef.current = clamped;
      setDragX(clamped);
    };

    const handleMouseUp = async () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      const progress = dragXRef.current / trackWidthRef.current;
      if (progress >= CONFIRM_THRESHOLD) {
        setDragX(trackWidthRef.current);
        setIsConfirming(true);
        try {
          await onConfirm();
          setIsConfirmed(true);
        } catch {
          setDragX(0);
        } finally {
          setIsConfirming(false);
        }
      } else {
        setDragX(0);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [disabled, isConfirming, isConfirmed, onConfirm]);

  const progress = trackWidthRef.current > 0 ? dragX / trackWidthRef.current : 0;

  return (
    <div className={cn("w-full", className)}>
      {description && (
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
      )}

      {/* Swipe track */}
      <div
        ref={trackRef}
        className={cn(
          "relative h-14 rounded-full overflow-hidden",
          styles.track,
          disabled && "opacity-40 cursor-not-allowed",
          isConfirmed && "bg-green-100 dark:bg-green-950/30",
          isMobile && "h-14"
        )}
      >
        {/* Fill behind thumb */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-colors",
            isConfirmed ? "bg-green-500" : styles.fill,
            dragX === 0 && "transition-all duration-300"
          )}
          style={{
            width: isConfirmed ? "100%" : `${dragX + THUMB_SIZE}px`,
            opacity: isConfirmed ? 0.3 : Math.max(0.1, progress * 0.3),
          }}
        />

        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn(
            "text-xs font-medium transition-opacity",
            isConfirmed ? "text-green-700 dark:text-green-300" : styles.text,
            progress > 0.3 && "opacity-30"
          )}>
            {isConfirmed ? "Bestätigt!" : isConfirming ? "Wird ausgeführt..." : label}
          </span>
        </div>

        {/* Chevrons hint */}
        {!isConfirmed && !isConfirming && dragX === 0 && (
          <div className="absolute right-16 inset-y-0 flex items-center pointer-events-none">
            <div className="flex gap-0.5 animate-pulse">
              <ChevronRight className={cn("w-3 h-3", styles.text, "opacity-30")} />
              <ChevronRight className={cn("w-3 h-3", styles.text, "opacity-50")} />
              <ChevronRight className={cn("w-3 h-3", styles.text, "opacity-70")} />
            </div>
          </div>
        )}

        {/* Draggable thumb */}
        <div
          className={cn(
            "absolute top-1 bottom-1 rounded-full flex items-center justify-center shadow-md",
            "cursor-grab active:cursor-grabbing select-none",
            isConfirmed ? "bg-green-600 text-white" : styles.thumb,
            dragX === 0 && "transition-all duration-300"
          )}
          style={{
            left: `${4 + dragX}px`,
            width: `${THUMB_SIZE - 8}px`,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          {isConfirmed ? (
            <Check className="w-5 h-5" />
          ) : isConfirming ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            styles.icon
          )}
        </div>
      </div>
    </div>
  );
});
