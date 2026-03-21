/**
 * MOB5-18: Mobile Comparison Slider
 * Before/after image slider for renovation photos.
 * Touch-drag to reveal before/after. Pinch-to-zoom support.
 */
import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileComparisonSliderProps {
  /** "Before" image URL */
  beforeSrc: string;
  /** "After" image URL */
  afterSrc: string;
  /** "Before" label */
  beforeLabel?: string;
  /** "After" label */
  afterLabel?: string;
  /** Initial slider position (0-100) */
  initialPosition?: number;
  /** Height of the slider */
  height?: number;
  /** Additional class */
  className?: string;
}

export const MobileComparisonSlider = memo(function MobileComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Vorher",
  afterLabel = "Nachher",
  initialPosition = 50,
  height = 300,
  className,
}: MobileComparisonSliderProps) {
  const isMobile = useIsMobile();
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(percent);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    updatePosition(e.touches[0].clientX);
  }, [isDragging, updatePosition]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX);
  }, [updatePosition]);

  // Track container width reactively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => setContainerWidth(el.offsetWidth);
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, updatePosition]);

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border select-none cursor-col-resize"
        style={{ height }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        role="slider"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Vorher/Nachher Vergleich"
      >
        {/* After image (full width, behind) */}
        <img
          src={afterSrc}
          alt={afterLabel}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Before image (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={beforeSrc}
            alt={beforeLabel}
            className="absolute inset-0 h-full object-cover"
            style={{ width: containerWidth || "100%", minWidth: containerWidth || "100%" }}
            draggable={false}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute bottom-0 top-0 z-10 w-0.5 bg-white shadow-md"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        >
          {/* Handle */}
          <div className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "h-10 w-10 rounded-full border-2 border-white bg-white shadow-xl",
            "flex items-center justify-center",
            isDragging && "scale-110",
            "transition-transform",
            isMobile && "w-12 h-12"
          )}>
            <div className="flex items-center gap-0.5">
              <svg width="6" height="12" viewBox="0 0 6 12" fill="none" className="text-gray-500">
                <path d="M5 1L1 6L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="6" height="12" viewBox="0 0 6 12" fill="none" className="text-gray-500">
                <path d="M1 1L5 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-3 left-3 z-20">
          <span className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            "bg-black/50 text-white backdrop-blur-sm",
            position < 15 && "opacity-0"
          )}>
            {beforeLabel}
          </span>
        </div>
        <div className="absolute top-3 right-3 z-20">
          <span className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            "bg-black/50 text-white backdrop-blur-sm",
            position > 85 && "opacity-0"
          )}>
            {afterLabel}
          </span>
        </div>
      </div>
    </div>
  );
});
